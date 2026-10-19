import { createHash, randomUUID } from "crypto";
import { Types } from "mongoose";
import { DocumentFile } from "../models/DocumentFile";
import { Course } from "../models/Course";
import { ApiError } from "../utils/ApiError";
import { findOrCreateCourse } from "./courseService";
import { uploadBuffer, uploadFile, deleteFile } from "./storageService";
import { PdfValidationError } from "./pdfValidationService";
import {
  inspectPdfBuffer,
  shouldRejectForScanQuality,
} from "./pdfBlankDetectionService";
import { findSuspectedDuplicate } from "./pdfDuplicateDetectionService";
import {
  hasPossibleSplitUploadPattern,
  POSSIBLE_SPLIT_UPLOAD_PATTERN,
} from "./splitUploadReviewService";
import { generatePdfThumbnail } from "./pdfThumbnailService";
import { logger } from "../utils/logger";
import {
  getDocumentFileType,
  OfficeDocumentValidationError,
  validateOfficeDocumentBuffer,
} from "./officeDocumentValidationService";

export type IngestFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export type UploadDocumentBody = {
  title: string;
  category: "lecture_note" | "exam_summary" | "past_question" | "other";
  courseId?: string;
  courseCode?: string;
  courseTitle?: string;
  university?: string;
  department?: string;
  level?: string;
  session?: string;
  semester?: "first" | "second";
  creditUnits?: number;
  tags?: string;
};

type ValidationFlag = {
  type:
    | "POTENTIAL_DUPLICATE"
    | "POOR_SCAN_QUALITY"
    | "POSSIBLE_SPLIT_UPLOAD_PATTERN"
    | "NEEDS_COURSE";
  reason?: string;
  matchedDocumentId?: Types.ObjectId;
  score?: number;
};

export function getFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function duplicateDocumentError(doc: {
  _id: Types.ObjectId;
  title: string;
}) {
  return ApiError.conflict("This material has already been uploaded", {
    documentId: doc._id.toString(),
    title: doc.title,
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * The full upload pipeline — exact-duplicate check, PDF/Office validation,
 * near-duplicate flags, storage, thumbnail — shared by direct uploads and the
 * Google Drive import.
 */
export async function ingestDocument(
  file: IngestFile,
  body: UploadDocumentBody,
  uploadedByType: "Admin" | "Student",
  uploadedBy: string,
  // withoutCourse: save with no course for an admin to assign (Drive imports
  // that couldn't work one out). Pending until then.
  source: { driveFileId?: string; withoutCourse?: boolean } = {},
) {

  const fileType = getDocumentFileType(file.mimetype);
  if (!fileType)
    throw ApiError.badRequest("Supported file types are PDF, DOCX, and PPTX");

  const fileHash = getFileHash(file.buffer);
  const existing = await DocumentFile.findOne({ fileHash }).select("_id title");
  if (existing) throw duplicateDocumentError(existing);

  let scanQualityStatus: "clear" | "review" | undefined;
  let pageCount: number | undefined;
  let pageFingerprints: string[] | undefined;

  if (fileType === "pdf") {
    try {
      const inspection = await inspectPdfBuffer(file.buffer);
      if (inspection.isBlank) {
        throw ApiError.badRequest(
          "The uploaded PDF appears to contain only blank pages.",
        );
      }
      if (shouldRejectForScanQuality(inspection.scanQuality)) {
        throw ApiError.badRequest(
          "The uploaded PDF scan quality is too poor. Please upload a clearer scan.",
        );
      }
      scanQualityStatus = inspection.scanQuality.status;
      pageCount = inspection.pageCount;
      pageFingerprints = inspection.pageFingerprints;
    } catch (error) {
      if (error instanceof PdfValidationError) {
        if (error.failure === "password-protected") {
          throw ApiError.badRequest(
            "This PDF is password-protected. Please upload an unlocked PDF.",
          );
        }

        throw ApiError.badRequest("The uploaded file is not a valid PDF.");
      }

      throw error;
    }
  } else {
    try {
      await validateOfficeDocumentBuffer(file.buffer, fileType);
    } catch (error) {
      if (error instanceof OfficeDocumentValidationError) {
        const documentName = fileType === "docx" ? "Word" : "PowerPoint";
        throw ApiError.badRequest(
          `The uploaded ${documentName} document is invalid or corrupted.`,
        );
      }

      throw error;
    }
  }

  const course = source.withoutCourse
    ? null
    : body.courseId
    ? await Course.findById(body.courseId)
    : await findOrCreateCourse({
        code: body.courseCode!,
        title: body.courseTitle!,
        university: body.university!,
        department: body.department!,
        level: body.level!,
        session: body.session!,
        semester: body.semester!,
        creditUnits: body.creditUnits!,
      });
  if (!course && !source.withoutCourse) throw ApiError.notFound("Course not found");

  // Both checks compare within a course, so they wait until one is assigned.
  const suspectedDuplicate =
    course && fileType === "pdf" && pageFingerprints
      ? await findSuspectedDuplicate(course._id, pageFingerprints)
      : undefined;
  const possibleSplitUpload =
    course &&
    fileType === "pdf" &&
    uploadedByType === "Student" &&
    pageCount !== undefined &&
    (await hasPossibleSplitUploadPattern({
      courseId: course._id,
      uploaderId: uploadedBy,
      category: body.category,
      pageCount,
    }));
  const validationFlags: ValidationFlag[] = [];
  if (fileType === "pdf" && scanQualityStatus === "review") {
    validationFlags.push({
      type: "POOR_SCAN_QUALITY",
      reason: "One or more pages need scan-quality review.",
    });
  }
  if (suspectedDuplicate) {
    validationFlags.push({
      type: "POTENTIAL_DUPLICATE",
      reason: "High visual page overlap with an existing document.",
      matchedDocumentId: suspectedDuplicate.documentId,
      score: suspectedDuplicate.similarity,
    });
  }
  if (possibleSplitUpload) {
    validationFlags.push({
      type: POSSIBLE_SPLIT_UPLOAD_PATTERN,
      reason: "Several small uploads for this course were submitted recently.",
    });
  }
  if (!course) {
    validationFlags.push({
      type: "NEEDS_COURSE",
      reason: "No course code in the file or folder name. Assign a course, then approve.",
    });
  }
  const requiresDeterministicReview = validationFlags.length > 0;

  const { url, key } = await uploadFile(
    file.buffer,
    file.originalname,
    file.mimetype,
  );

  let thumbnail: { url: string; key: string } | undefined;
  if (fileType === "pdf") {
    let thumbnailKey: string | undefined;
    try {
      const thumbnailBuffer = await generatePdfThumbnail(file.buffer);
      thumbnailKey = `thumbnails/${randomUUID()}.png`;
      thumbnail = await uploadBuffer(
        thumbnailBuffer,
        thumbnailKey,
        "image/png",
      );
    } catch (error) {
      if (thumbnailKey) {
        try {
          await deleteFile(thumbnailKey);
        } catch (cleanupError) {
          logger.warn("Failed to clean up document thumbnail", {
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : "unknown",
          });
        }
      }
      logger.warn("Failed to create document thumbnail", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // Existing Admin PDF uploads remain auto-approved. Office uploads cannot receive
  // PDF-only inspection in V1, so they always enter normal Admin review.
  const status =
    fileType !== "pdf" || suspectedDuplicate || !course || uploadedByType === "Student"
      ? "pending"
      : "approved";

  let doc;
  try {
    doc = await DocumentFile.create({
      ...(course && { course: course._id }),
      title: body.title,
      category: body.category,
      fileUrl: url,
      fileType,
      fileHash,
      ...(fileType === "pdf" && pageCount && { pageCount }),
      ...(fileType === "pdf" && pageFingerprints && { pageFingerprints }),
      validation: {
        status: requiresDeterministicReview ? "flagged" : "clear",
        flags: validationFlags,
        ...(requiresDeterministicReview && { checkedAt: new Date() }),
      },
      ...(thumbnail && {
        thumbnailUrl: thumbnail.url,
        thumbnailStorageKey: thumbnail.key,
      }),
      sizeBytes: file.size,
      storageKey: key,
      tags: parseTags(body.tags),
      ...(source.driveFileId && { driveFileIds: [source.driveFileId] }),
      uploadedByType,
      uploadedBy,
      status,
    });
  } catch (error) {
    // The unique hash index closes the find-then-create race. Remove the R2
    // object created by the losing request before returning the duplicate.
    await deleteFile(key);
    if (thumbnail?.key) await deleteFile(thumbnail.key);
    if (isDuplicateKeyError(error)) {
      const duplicate = await DocumentFile.findOne({ fileHash }).select(
        "_id title",
      );
      if (duplicate) throw duplicateDocumentError(duplicate);
    }
    throw error;
  }

  return doc.populate("course");
}
