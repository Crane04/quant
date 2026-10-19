import { Types } from "mongoose";
import { Course } from "../models/Course";
import { DocumentFile } from "../models/DocumentFile";
import { DriveImport, DriveImportDoc } from "../models/DriveImport";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { getDocumentFileType } from "./officeDocumentValidationService";
import { LIVE_UNIVERSITY, normalizeUniversity } from "./accessService";
import { ingestDocument, UploadDocumentBody } from "./documentIngestService";
import { findOrCreateCourse } from "./courseService";
import {
  DriveFile,
  downloadDriveFile,
  isExportedAsPdf,
  listDriveFiles,
  parseDriveLink,
} from "./googleDriveService";

// Files downloaded + validated at once. Validation (PDF rendering for
// fingerprints/thumbnails) is the slow part, so this is kept modest.
const CONCURRENCY = 4;
// Same cap as direct uploads (middleware/upload.ts).
const MAX_FILE_BYTES = 50 * 1024 * 1024;

type Category = UploadDocumentBody["category"];
type ItemStatus = DriveImportDoc["items"][number]["status"];

/** "MEE 301", "mee-301", "MEE_301" -> "MEE301". */
const normalizeCode = (code: string) => code.replace(/[^a-z0-9]/gi, "").toUpperCase();

// Spellings seen in shared folders for the catalogue's 3-letter prefixes.
const PREFIX_ALIASES: Record<string, string> = { CHEM: "CHM", MATH: "MAT" };

/** Every course-code-shaped token in a string, e.g. "MEE301 & MEE 305 notes" -> [MEE301, MEE305]. */
function codesIn(text: string): string[] {
  return [...text.matchAll(/(?<![a-z])([a-z]{3,4})[\s._-]*(\d{3})(?!\d)/gi)].map(
    (m) => {
      const prefix = m[1].toUpperCase();
      return `${PREFIX_ALIASES[prefix] ?? prefix}${m[2]}`;
    },
  );
}

/** From the file name and its folders, e.g. "2024/25 PQ/ECE201 a.jpg" -> past_question. */
function categoryFromName(name: string, path = ""): Category {
  const text = `${path} ${name}`;
  if (/past\s*q|\bpq\b|question|exam\s*paper/i.test(text)) return "past_question";
  if (/summar/i.test(text)) return "exam_summary";
  return "lecture_note";
}

const titleFromName = (name: string) =>
  name.replace(/\.(pdf|docx|pptx)$/i, "").trim() || name;

const isSupported = (file: DriveFile) =>
  isExportedAsPdf(file.mimeType) || Boolean(getDocumentFileType(file.mimeType));

export async function startDriveImport(
  url: string,
  category: Category | "auto",
  adminId: string,
) {
  const link = parseDriveLink(url);
  if (!link) throw ApiError.badRequest("That doesn't look like a Google Drive link");

  // Listed up front so a bad or private link fails the request itself.
  const { name, files } = await listDriveFiles(link);
  if (files.length === 0) throw ApiError.badRequest("That Drive folder is empty");

  const unique = [...new Map(files.map((f) => [f.id, f])).values()];
  const job = await DriveImport.create({
    url,
    folderName: name,
    category,
    createdBy: adminId,
    items: unique.map((f) => ({
      driveFileId: f.id,
      name: f.name,
      path: f.path,
      mimeType: f.mimeType,
    })),
  });

  runImport(job._id, unique, category, adminId).catch(async (err) => {
    logger.error("Drive import failed", {
      importId: job._id.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
    await DriveImport.updateOne(
      { _id: job._id },
      { status: "failed", error: "Import stopped unexpectedly", finishedAt: new Date() },
    );
  });

  return job;
}

function setItem(
  importId: Types.ObjectId,
  driveFileId: string,
  update: { status: ItemStatus; reason?: string; courseCode?: string; document?: Types.ObjectId },
) {
  const $set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined) $set[`items.$.${key}`] = value;
  }
  return DriveImport.updateOne({ _id: importId, "items.driveFileId": driveFileId }, { $set });
}

// Department for a new course, by code prefix.
const PREFIX_DEPARTMENTS: Record<string, string> = {
  ASE: "Aerospace Engineering",
  CHE: "Chemical Engineering",
  CHM: "Chemistry",
  CPE: "Computer Engineering",
  CSC: "Computer Science",
  ECE: "Electronics and Computer Engineering",
  EEE: "Electrical and Electronics Engineering",
  ENT: "Entrepreneurship",
  GET: "General Engineering",
  GNS: "General Studies",
  MAT: "Mathematics",
  MEE: "Mechanical Engineering",
  PHY: "Physics",
};

type CourseRef = { _id: Types.ObjectId; code: string };
type CatalogueCourse = CourseRef & {
  university: string;
  department: string;
  creditUnits: number;
  session: string;
};

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** "1st Semester", "SECOND SEMESTER" in the path, else odd/even course number. */
function semesterFor(code: string, path: string): "first" | "second" {
  if (/\b(1st|first)\s*sem/i.test(path)) return "first";
  if (/\b(2nd|second)\s*sem/i.test(path)) return "second";
  return Number(code.slice(-1)) % 2 === 1 ? "first" : "second";
}

/**
 * A course for a code the catalogue doesn't have, so its files have somewhere
 * to go. Only plain 3-letter codes ("CSC111"): longer prefixes are as likely to
 * be words in a file name ("HEAT 103"). Titled with the code until an admin
 * renames it; the import lists every course it created.
 */
async function createCourseFor(
  code: string,
  path: string,
  catalogue: CatalogueCourse[],
): Promise<CourseRef | null> {
  const match = code.match(/^([A-Z]{3})(\d{3})$/);
  if (!match) return null;
  const [, prefix, number] = match;
  const samePrefix = catalogue.filter((c) => normalizeCode(c.code).startsWith(prefix));

  const course = await findOrCreateCourse({
    code,
    title: `${prefix} ${number}`,
    university: LIVE_UNIVERSITY,
    // The catalogue's departments are mostly "General" plus ad-hoc spellings
    // ("Mech", "ECE"), so the known name wins and the catalogue is the fallback.
    department:
      PREFIX_DEPARTMENTS[prefix] ??
      mostCommon(samePrefix.map((c) => c.department).filter((d) => d !== "General")) ??
      "General",
    level: `${number[0]}00`,
    creditUnits: mostCommon(samePrefix.map((c) => c.creditUnits)) ?? 2,
    session: mostCommon(catalogue.map((c) => c.session)) ?? "2025/2026",
    semester: semesterFor(code, path),
  });
  return { _id: course._id, code: course.code };
}

async function runImport(
  importId: Types.ObjectId,
  files: DriveFile[],
  category: Category | "auto",
  adminId: string,
) {
  // Shared folders are LASU material, and the same code also exists under test
  // or other schools. Most recent course per code wins across sessions.
  const courses = await Course.find(
    {},
    { code: 1, university: 1, department: 1, creditUnits: 1, session: 1 },
  )
    .sort({ createdAt: -1 })
    .lean();
  const catalogue = courses.filter(
    (c) => normalizeUniversity(c.university) === LIVE_UNIVERSITY,
  ) as CatalogueCourse[];
  const courseByCode = new Map<string, CourseRef>();
  for (const course of catalogue) {
    const code = normalizeCode(course.code);
    if (!courseByCode.has(code)) courseByCode.set(code, course);
  }
  const createdCourses: CourseRef[] = [];

  const alreadyImported = new Set(
    (
      await DocumentFile.find(
        { driveFileIds: { $in: files.map((f) => f.id) } },
        { driveFileIds: 1 },
      ).lean()
    ).flatMap((d) => d.driveFileIds ?? []),
  );

  // Everything that can be decided without downloading is settled first.
  const toDownload: { file: DriveFile; course: CourseRef | null }[] = [];
  for (const file of files) {
    if (alreadyImported.has(file.id)) {
      await setItem(importId, file.id, { status: "duplicate", reason: "Already imported" });
      continue;
    }
    if (!isSupported(file)) {
      await setItem(importId, file.id, {
        status: "unsupported",
        reason: "Only PDF, Word, PowerPoint, Google Docs and Google Slides are imported",
      });
      continue;
    }
    // File name first; the folder path is the fallback ("MEE301/week 2.pdf").
    const codes = [...codesIn(file.name), ...codesIn(file.path)];
    let course = codes.map((code) => courseByCode.get(code)).find(Boolean);
    const newCode = codes.find((code) => /^[A-Z]{3}\d{3}$/.test(code));
    if (!course && newCode) {
      course = (await createCourseFor(newCode, file.path, catalogue)) ?? undefined;
      if (course) {
        courseByCode.set(newCode, course);
        createdCourses.push(course);
      }
    }
    // No code to go on: still imported, but pending with no course for an
    // admin to assign on the Documents page.
    toDownload.push({ file, course: course ?? null });
  }

  if (createdCourses.length) {
    await DriveImport.updateOne(
      { _id: importId },
      { createdCourses: createdCourses.map((c) => ({ code: c.code, course: c._id })) },
    );
  }

  let next = 0;
  const worker = async () => {
    while (next < toDownload.length) {
      const { file, course } = toDownload[next++];
      const result = await importFile(file, course?._id ?? null, category, adminId);
      await setItem(importId, file.id, {
        ...(course
          ? result
          : result.status === "imported"
          ? { ...result, status: "unassigned", reason: "Saved without a course — assign one in Documents" }
          : result),
        courseCode: course?.code,
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await DriveImport.updateOne(
    { _id: importId },
    { status: "completed", finishedAt: new Date(), $unset: { error: 1 } },
  );
}

async function importFile(
  file: DriveFile,
  courseId: Types.ObjectId | null,
  category: Category | "auto",
  adminId: string,
): Promise<{ status: ItemStatus; reason?: string; document?: Types.ObjectId }> {
  if (file.size && file.size > MAX_FILE_BYTES) {
    return { status: "failed", reason: "Larger than the 50MB upload limit" };
  }
  try {
    const { buffer, mimeType } = await downloadDriveFile(file);
    if (buffer.length > MAX_FILE_BYTES) {
      return { status: "failed", reason: "Larger than the 50MB upload limit" };
    }

    const doc = await ingestDocument(
      { buffer, mimetype: mimeType, originalname: file.name, size: buffer.length },
      {
        title: titleFromName(file.name),
        category: category === "auto" ? categoryFromName(file.name, file.path) : category,
        ...(courseId && { courseId: courseId.toString() }),
      },
      "Admin",
      adminId,
      { driveFileId: file.id, withoutCourse: !courseId },
    );
    return { status: "imported", document: doc._id };
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      // Same bytes already in the library. Remember this Drive copy too, so the
      // next import of this folder skips it without downloading.
      const existingId = (err.details as { documentId?: string } | undefined)?.documentId;
      if (existingId) {
        await DocumentFile.updateOne(
          { _id: existingId },
          { $addToSet: { driveFileIds: file.id } },
        );
      }
      return {
        status: "duplicate",
        reason: "Same file is already in the library",
        ...(existingId && { document: new Types.ObjectId(existingId) }),
      };
    }
    if (err instanceof ApiError && err.statusCode < 500) {
      return { status: "failed", reason: err.message };
    }
    logger.error("Drive file import failed", {
      driveFileId: file.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: "failed", reason: "Unexpected error while importing" };
  }
}

// Every finished file bumps updatedAt, and one file (download + retries +
// validation) never takes this long — so a running import this quiet has died.
const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Imports run in-process, so a restart orphans them. Judged by inactivity, not
 * just "running": during a deploy the new instance boots while the old one is
 * still finishing its imports. Called on boot and before imports are listed.
 */
export async function failInterruptedImports(): Promise<void> {
  await DriveImport.updateMany(
    { status: "running", updatedAt: { $lt: new Date(Date.now() - STALE_AFTER_MS) } },
    {
      status: "failed",
      error: "Interrupted by a server restart. Paste the link again; files already imported will be skipped.",
      finishedAt: new Date(),
    },
  );
}

export function summarize(job: Pick<DriveImportDoc, "items">) {
  const counts: Record<string, number> = {};
  for (const item of job.items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return { total: job.items.length, ...counts };
}
