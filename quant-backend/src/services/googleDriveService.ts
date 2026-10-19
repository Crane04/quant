import { createSign } from "crypto";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

// Drive API v3. Works for anything shared as "Anyone with the link", which is
// how course material folders get passed around.
const DRIVE_API = "https://www.googleapis.com/drive/v3";

const FOLDER_MIME = "application/vnd.google-apps.folder";

// Native Google Docs/Slides have no file bytes, so they're exported to PDF.
const EXPORT_AS_PDF = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
]);

export type DriveLink = { kind: "folder" | "file"; id: string };

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Folder path inside the pasted folder, e.g. "MEE301/Week 2". */
  path: string;
};

/**
 * Accepts the link shapes Drive hands out: /drive/folders/ID, /drive/u/0/folders/ID,
 * /file/d/ID/view, /open?id=ID, and docs.google.com/{document,presentation}/d/ID.
 */
export function parseDriveLink(url: string): DriveLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(parsed.hostname)) return null;

  const folder = parsed.pathname.match(/\/folders\/([\w-]{10,})/);
  if (folder) return { kind: "folder", id: folder[1] };

  const file = parsed.pathname.match(/\/d\/([\w-]{10,})/);
  if (file) return { kind: "file", id: file[1] };

  const id = parsed.searchParams.get("id");
  if (id && /^[\w-]{10,}$/.test(id)) {
    // /open?id= is used for both; the metadata lookup tells them apart.
    return { kind: "file", id };
  }
  return null;
}

// Signed in as a service account when one is configured: anonymous (API-key)
// downloads get throttled after a few hundred MB. A service account can still
// read anything shared as "Anyone with the link" — no extra sharing needed.
type ServiceAccount = { client_email: string; private_key: string; token_uri: string };

let serviceAccount: ServiceAccount | null | undefined;
function getServiceAccount(): ServiceAccount | null {
  if (serviceAccount === undefined) {
    serviceAccount = env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
      ? JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf8"))
      : null;
  }
  return serviceAccount ?? null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** OAuth access token from a self-signed JWT (service-account flow). */
async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) {
    logger.error("Google service account sign-in failed", { status: res.status, body: await res.text() });
    throw ApiError.internal("Couldn't sign in to Google Drive with the service account");
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function authFor(): Promise<{ headers: Record<string, string>; params: Record<string, string> }> {
  const sa = getServiceAccount();
  if (sa) return { headers: { Authorization: `Bearer ${await accessToken(sa)}` }, params: {} };
  if (env.GOOGLE_API_KEY) return { headers: {}, params: { key: env.GOOGLE_API_KEY } };
  throw ApiError.internal(
    "Google Drive isn't configured (GOOGLE_SERVICE_ACCOUNT_JSON_B64 or GOOGLE_API_KEY) — Drive import is unavailable",
  );
}

// Google's abuse throttle ("Sorry… automated queries" page, or a rate-limit
// error) is temporary, so those are retried with growing pauses.
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 90_000];
const isThrottled = (status: number, body: string) =>
  status === 429 ||
  (status === 403 && /<title>Sorry|rateLimitExceeded|userRateLimitExceeded|quotaExceeded/.test(body));

async function driveFetch(path: string, params: Record<string, string>) {
  for (let attempt = 0; ; attempt++) {
    const auth = await authFor();
    const query = new URLSearchParams({ ...params, ...auth.params, supportsAllDrives: "true" });
    const res = await fetch(`${DRIVE_API}${path}?${query}`, { headers: auth.headers });
    if (res.ok) return res;

    const body = await res.text();
    if (isThrottled(res.status, body)) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw ApiError.badRequest("Google is rate-limiting downloads right now — paste the link again later to pick up the rest");
    }
    // Credential problems also come back as 400/401/403; don't blame the folder's sharing for them.
    if (res.status === 401 || /API_KEY|keyInvalid|accessNotConfigured|SERVICE_DISABLED/.test(body)) {
      logger.error("Google Drive credentials rejected", { status: res.status, body });
      throw ApiError.internal(
        "Google rejected our Drive credentials — check the Google Drive API is enabled for them",
      );
    }
    if (res.status === 404 || res.status === 403) {
      throw ApiError.badRequest(
        "Couldn't open that Drive link. Make sure it's shared as \"Anyone with the link\".",
      );
    }
    throw new Error(`Drive API ${res.status}: ${body.slice(0, 500)}`);
  }
}

type RawFile = { id: string; name: string; mimeType: string; size?: string };

const toDriveFile = (f: RawFile, path: string): DriveFile => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  size: f.size ? Number(f.size) : undefined,
  path,
});

export async function getDriveItem(id: string): Promise<RawFile> {
  const res = await driveFetch(`/files/${id}`, {
    fields: "id,name,mimeType,size",
  });
  return res.json() as Promise<RawFile>;
}

async function listChildren(folderId: string): Promise<RawFile[]> {
  const files: RawFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await driveFetch("/files", {
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      ...(pageToken && { pageToken }),
    });
    const page = (await res.json()) as {
      files: RawFile[];
      nextPageToken?: string;
    };
    files.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

/** Every file under the link, subfolders included. A file link lists itself. */
export async function listDriveFiles(
  link: DriveLink,
): Promise<{ name: string; files: DriveFile[] }> {
  const root = await getDriveItem(link.id);
  if (root.mimeType !== FOLDER_MIME) {
    return { name: root.name, files: [toDriveFile(root, "")] };
  }

  const files: DriveFile[] = [];
  const queue: { id: string; path: string }[] = [{ id: root.id, path: "" }];
  while (queue.length) {
    const folder = queue.shift()!;
    for (const child of await listChildren(folder.id)) {
      if (child.mimeType === FOLDER_MIME) {
        queue.push({
          id: child.id,
          path: folder.path ? `${folder.path}/${child.name}` : child.name,
        });
      } else {
        files.push(toDriveFile(child, folder.path));
      }
    }
  }
  return { name: root.name, files };
}

export function isExportedAsPdf(mimeType: string): boolean {
  return EXPORT_AS_PDF.has(mimeType);
}

/** File bytes, with Google Docs/Slides exported to PDF. */
export async function downloadDriveFile(
  file: Pick<DriveFile, "id" | "mimeType">,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = isExportedAsPdf(file.mimeType)
    ? await driveFetch(`/files/${file.id}/export`, {
        mimeType: "application/pdf",
      })
    : await driveFetch(`/files/${file.id}`, { alt: "media" });
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: isExportedAsPdf(file.mimeType) ? "application/pdf" : file.mimeType,
  };
}
