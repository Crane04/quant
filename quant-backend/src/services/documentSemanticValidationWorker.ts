import { Types } from "mongoose";
import { CourseDoc } from "../models/Course";
import { DocumentFile } from "../models/DocumentFile";
import { getFileBuffer } from "./storageService";
import {
  isGroqVisionConfigured,
  type SemanticValidationResult,
  validateDocumentSemantics,
} from "./groqDocumentVisionService";
import { renderSemanticSamplePages } from "./pdfSemanticSampleService";
import { logger } from "../utils/logger";

export const SEMANTIC_VALIDATION_POLL_INTERVAL_MS = 30 * 1000;
export const SEMANTIC_VALIDATION_STALE_PROCESSING_MS = 10 * 60 * 1000;
export const SEMANTIC_VALIDATION_RETRY_DELAY_MS = 5 * 60 * 1000;
export const EXHAUSTED_VALIDATION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_SEMANTIC_VALIDATION_ATTEMPTS = 3;
export const MIN_CONFIDENCE_FOR_CLEAR_SEMANTIC_VALIDATION = 0.65;

const SEMANTIC_RETRY_REASON =
  "Automatic semantic validation could not be completed; manual review is required.";
let lastExhaustedValidationSweepAt = 0;
let isSemanticValidationWorkerRunning = false;

type ClaimedDocument = {
  _id: Types.ObjectId;
  category: "lecture_note" | "exam_summary" | "past_question" | "other";
  storageKey?: string;
  course: CourseDoc;
  validation?: {
    flags?: Array<{
      type: string;
      reason?: string;
      matchedDocumentId?: Types.ObjectId;
      score?: number;
    }>;
    semantic?: {
      attempts?: number;
      sampledPageNumbers?: number[];
    };
  };
};

export function getSemanticValidationFlags(
  result: SemanticValidationResult,
): string[] {
  const flags: string[] = [];
  if (!result.isAcademicMaterial) flags.push("NON_ACADEMIC_SUSPECTED");
  if (result.matchesExpectedCourse === "no") flags.push("COURSE_MISMATCH");
  if (result.appearsMixedAcrossCourses) flags.push("MIXED_COURSE_MATERIAL");
  if (result.legibility === "poor") flags.push("POOR_LEGIBILITY");
  if (
    result.matchesExpectedCourse === "uncertain" ||
    result.legibility === "uncertain" ||
    result.confidence < MIN_CONFIDENCE_FOR_CLEAR_SEMANTIC_VALIDATION
  ) {
    flags.push("AI_VALIDATION_UNCERTAIN");
  }
  return flags;
}

async function claimDocumentForSemanticValidation(): Promise<ClaimedDocument | null> {
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - SEMANTIC_VALIDATION_STALE_PROCESSING_MS,
  );

  const document = await DocumentFile.findOneAndUpdate(
    {
      uploadedByType: "Student",
      status: "pending",
      "validation.semantic.attempts": { $lt: MAX_SEMANTIC_VALIDATION_ATTEMPTS },
      $or: [
        {
          "validation.semantic.status": "queued",
          $or: [
            { "validation.semantic.nextAttemptAt": { $exists: false } },
            { "validation.semantic.nextAttemptAt": { $lte: now } },
          ],
        },
        {
          "validation.semantic.status": "processing",
          "validation.semantic.processingStartedAt": { $lte: staleBefore },
        },
      ],
    },
    {
      $set: {
        "validation.semantic.status": "processing",
        "validation.semantic.processingStartedAt": now,
      },
      $unset: { "validation.semantic.nextAttemptAt": "" },
      $inc: { "validation.semantic.attempts": 1 },
    },
    { new: true },
  )
    .select("+validation.semantic.sampledPageNumbers +validation.semantic.processingStartedAt +validation.semantic.nextAttemptAt")
    .populate("course");

  return document as unknown as ClaimedDocument | null;
}

async function requireManualReviewForExhaustedValidations(): Promise<void> {
  await DocumentFile.updateMany(
    {
      uploadedByType: "Student",
      status: "pending",
      "validation.semantic.status": { $in: ["queued", "processing"] },
      "validation.semantic.attempts": { $gte: MAX_SEMANTIC_VALIDATION_ATTEMPTS },
    },
    {
      $set: {
        "validation.status": "manual_required",
        "validation.semantic.status": "manual_required",
        "validation.semantic.reasons": [SEMANTIC_RETRY_REASON],
        "validation.semantic.checkedAt": new Date(),
        "validation.checkedAt": new Date(),
      },
      $unset: {
        "validation.semantic.processingStartedAt": "",
        "validation.semantic.nextAttemptAt": "",
      },
    },
  );
}

async function markManualRequired(
  documentId: Types.ObjectId,
  reason: string,
): Promise<void> {
  await DocumentFile.findOneAndUpdate(
    { _id: documentId, "validation.semantic.status": "processing" },
    {
      $set: {
        "validation.status": "manual_required",
        "validation.semantic.status": "manual_required",
        "validation.semantic.reasons": [reason],
        "validation.semantic.checkedAt": new Date(),
        "validation.checkedAt": new Date(),
      },
      $unset: {
        "validation.semantic.processingStartedAt": "",
        "validation.semantic.nextAttemptAt": "",
      },
    },
  );
}

async function requeueOrRequireManualReview(
  document: ClaimedDocument,
): Promise<void> {
  const attempts = document.validation?.semantic?.attempts ?? 0;
  if (attempts >= MAX_SEMANTIC_VALIDATION_ATTEMPTS) {
    await markManualRequired(document._id, SEMANTIC_RETRY_REASON);
    return;
  }

  await DocumentFile.findOneAndUpdate(
    { _id: document._id, "validation.semantic.status": "processing" },
    {
      $set: {
        "validation.semantic.status": "queued",
        "validation.semantic.nextAttemptAt": new Date(
          Date.now() + SEMANTIC_VALIDATION_RETRY_DELAY_MS,
        ),
      },
      $unset: { "validation.semantic.processingStartedAt": "" },
    },
  );
}

async function completeSemanticValidation(
  document: ClaimedDocument,
  result: SemanticValidationResult,
): Promise<void> {
  const existingFlags = document.validation?.flags ?? [];
  const semanticFlags = getSemanticValidationFlags(result).map((type) => ({
    type,
  }));
  const flags = [...existingFlags, ...semanticFlags];
  await DocumentFile.findOneAndUpdate(
    { _id: document._id, "validation.semantic.status": "processing" },
    {
      $set: {
        "validation.status": flags.length > 0 ? "flagged" : "clear",
        "validation.flags": flags,
        "validation.semantic.status": "completed",
        "validation.semantic.confidence": result.confidence,
        "validation.semantic.reasons": result.reasons,
        "validation.semantic.detectedCourseCodes": result.detectedCourseCodes,
        "validation.semantic.checkedAt": new Date(),
        "validation.checkedAt": new Date(),
      },
      $unset: {
        "validation.semantic.processingStartedAt": "",
        "validation.semantic.nextAttemptAt": "",
      },
    },
  );
}

async function validateClaimedDocument(document: ClaimedDocument): Promise<void> {
  if (!isGroqVisionConfigured()) {
    await markManualRequired(
      document._id,
      "Semantic validation is not configured; manual review is required.",
    );
    return;
  }

  const pageNumbers = document.validation?.semantic?.sampledPageNumbers ?? [];
  if (!document.storageKey || pageNumbers.length === 0) {
    await markManualRequired(
      document._id,
      "Semantic validation samples are unavailable; manual review is required.",
    );
    return;
  }

  try {
    const pdfBuffer = await getFileBuffer(document.storageKey);
    const pageImages = await renderSemanticSamplePages(pdfBuffer, pageNumbers);
    const result = await validateDocumentSemantics(
      {
        university: document.course.university,
        department: document.course.department,
        level: document.course.level,
        courseCode: document.course.code,
        courseTitle: document.course.title,
        category: document.category,
      },
      pageImages,
    );

    if (!result) {
      await requeueOrRequireManualReview(document);
      return;
    }

    await completeSemanticValidation(document, result);
  } catch (error) {
    logger.warn("Semantic document validation failed", {
      documentId: document._id.toString(),
      error: error instanceof Error ? error.name : "unknown",
    });
    await requeueOrRequireManualReview(document);
  }
}

export async function processOneSemanticValidation(): Promise<boolean> {
  const now = Date.now();
  if (
    now - lastExhaustedValidationSweepAt >=
    EXHAUSTED_VALIDATION_SWEEP_INTERVAL_MS
  ) {
    await requireManualReviewForExhaustedValidations();
    lastExhaustedValidationSweepAt = now;
  }
  const document = await claimDocumentForSemanticValidation();
  if (!document) return false;

  await validateClaimedDocument(document);
  return true;
}

export function startDocumentSemanticValidationWorker(): void {
  const run = async () => {
    if (isSemanticValidationWorkerRunning) return;

    isSemanticValidationWorkerRunning = true;
    try {
      await processOneSemanticValidation();
    } catch (error) {
      logger.error("Semantic validation worker sweep failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    } finally {
      isSemanticValidationWorkerRunning = false;
    }
  };

  void run();
  setInterval(() => void run(), SEMANTIC_VALIDATION_POLL_INTERVAL_MS).unref();
}
