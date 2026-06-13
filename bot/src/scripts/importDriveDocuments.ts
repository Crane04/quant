import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { PDFDocument } from "../models/Document";
import { createDocumentFromBuffer } from "../services/documentService";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

type ImportCandidate = {
  id: string;
  name: string;
  path: string[];
  title: string;
  courseCode: string;
  courseName: string;
  faculty: string;
  department: string;
  level: string;
  semester: string;
  tags: string;
};

const DEFAULT_ROOT_FOLDER_ID = "1pAr6_0bQHPUTnj1FEDJjeQa-WlB0Wykm";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const PDF_MIME_TYPE = "application/pdf";
const COURSE_CODE_PATTERN = /\b([A-Z]{2,4})\s*[-_]?\s*(\d{3})\b/i;
const VALID_LEVELS = new Set(["100", "200", "300", "400", "500"]);

const getArg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const folderId =
  getArg("folder") || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || DEFAULT_ROOT_FOLDER_ID;
const dryRun = hasFlag("dry-run") || process.env.DRIVE_IMPORT_DRY_RUN === "true";
const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
const defaultFaculty = process.env.DRIVE_IMPORT_FACULTY || "Engineering";
const defaultDepartment = process.env.DRIVE_IMPORT_DEPARTMENT || "Electrical and Computer Engineering";
const maxFileSizeBytes = Number(process.env.DRIVE_IMPORT_MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024);

const driveFetch = async (url: URL): Promise<Response> => {
  if (apiKey) url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed (${response.status}): ${await response.text()}`);
  }

  return response;
};

const listFolder = async (id: string): Promise<DriveFile[]> => {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${id}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await driveFetch(url);
    const data = (await response.json()) as { nextPageToken?: string; files?: DriveFile[] };
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
};

const walkFolder = async (id: string, path: string[] = []): Promise<DriveFileWithPath[]> => {
  const files = await listFolder(id);
  const discovered: DriveFileWithPath[] = [];

  for (const file of files) {
    if (file.mimeType === FOLDER_MIME_TYPE) {
      discovered.push(...(await walkFolder(file.id, [...path, file.name])));
      continue;
    }

    discovered.push({ ...file, path });
  }

  return discovered;
};

type DriveFileWithPath = DriveFile & {
  path: string[];
};

const cleanTitle = (name: string): string => {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const inferLevel = (path: string[], name: string): string | null => {
  const text = [...path, name].join(" ");
  const match = text.match(/\b([1-5])00\s*(?:lvl|level|l)?\b/i);
  return match ? `${match[1]}00` : null;
};

const inferSemester = (path: string[], courseCode: string): "first" | "second" => {
  const text = path.join(" ").toLowerCase();
  if (/\b(2nd|second)\b/.test(text)) return "second";
  if (/\b(1st|first)\b/.test(text)) return "first";

  const courseNumber = Number(courseCode.match(/\d{3}/)?.[0]);
  return courseNumber % 2 === 0 ? "second" : "first";
};

const inferCourseCode = (path: string[], name: string): string | null => {
  const text = [name, ...path.slice().reverse()].join(" ");
  const match = text.match(COURSE_CODE_PATTERN);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : null;
};

const buildTags = (path: string[], name: string): string => {
  const tags = new Set<string>();
  const text = [...path, name].join(" ").toLowerCase();

  if (/\bpq\b|past question|past questions/.test(text)) tags.add("past question");
  if (/lecture|note/.test(text)) tags.add("lecture note");
  if (/textbook|hibbeler|mechanics/.test(text)) tags.add("textbook");

  path
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .forEach((part) => tags.add(part));

  return Array.from(tags).join(", ");
};

const toCandidate = (file: DriveFileWithPath): ImportCandidate | null => {
  if (file.mimeType !== PDF_MIME_TYPE && !file.name.toLowerCase().endsWith(".pdf")) return null;

  const courseCode = inferCourseCode(file.path, file.name);
  const level = inferLevel(file.path, file.name);

  if (!courseCode || !level || !VALID_LEVELS.has(level)) return null;

  const title = cleanTitle(file.name);

  return {
    id: file.id,
    name: file.name,
    path: file.path,
    title,
    courseCode,
    courseName: title.includes(courseCode) ? courseCode : title,
    faculty: defaultFaculty,
    department: defaultDepartment,
    level,
    semester: inferSemester(file.path, courseCode),
    tags: buildTags(file.path, file.name),
  };
};

const downloadPdf = async (id: string): Promise<Buffer> => {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${id}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const response = await driveFetch(url);
  return Buffer.from(await response.arrayBuffer());
};

const importCandidate = async (candidate: ImportCandidate): Promise<"created" | "skipped"> => {
  const existing = await PDFDocument.exists({
    $or: [
      { sourceDriveFileId: candidate.id },
      {
        title: candidate.title,
        courseCode: candidate.courseCode,
        level: candidate.level,
        semester: candidate.semester,
      },
    ],
  });

  if (existing) return "skipped";

  if (dryRun) return "created";

  const buffer = await downloadPdf(candidate.id);

  if (buffer.byteLength > maxFileSizeBytes) {
    throw new Error(
      `File is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB; current import limit is ${(
        maxFileSizeBytes /
        1024 /
        1024
      ).toFixed(1)} MB`
    );
  }

  await createDocumentFromBuffer({
    title: candidate.title,
    courseCode: candidate.courseCode,
    courseName: candidate.courseName,
    faculty: candidate.faculty,
    department: candidate.department,
    level: candidate.level,
    semester: candidate.semester,
    tags: candidate.tags,
    buffer,
    fileSize: buffer.byteLength,
    sourceDriveFileId: candidate.id,
  });

  return "created";
};

const main = async (): Promise<void> => {
  if (!apiKey && !accessToken) {
    throw new Error("Set GOOGLE_DRIVE_API_KEY or GOOGLE_DRIVE_ACCESS_TOKEN before importing.");
  }

  console.log(`Scanning Google Drive folder ${folderId}${dryRun ? " (dry run)" : ""}...`);
  const files = await walkFolder(folderId);
  const candidates = files.map(toCandidate).filter((file): file is ImportCandidate => Boolean(file));
  const skippedForMetadata = files.length - candidates.length;

  console.log(`Found ${files.length} file(s), ${candidates.length} importable PDF(s).`);
  if (skippedForMetadata > 0) {
    console.log(`${skippedForMetadata} file(s) were skipped because metadata could not be inferred.`);
  }

  if (!dryRun) await connectDB();

  let created = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const label = `${candidate.path.join(" / ")} / ${candidate.name}`;
    try {
      const result = dryRun ? "created" : await importCandidate(candidate);

      if (result === "created") {
        created += 1;
        console.log(`${dryRun ? "Would import" : "Imported"}: ${label}`);
      } else {
        skipped += 1;
        console.log(`Skipped existing: ${label}`);
      }
    } catch (error) {
      console.error(`Failed: ${label} - ${formatError(error)}`);
    }
  }

  console.log(`Done. ${dryRun ? "Would import" : "Imported"} ${created}; skipped ${skipped}.`);
};

main()
  .catch((error) => {
    console.error(formatError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
