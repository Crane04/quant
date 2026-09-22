import { Schema, model, Types, InferSchemaType } from "mongoose";

const validationFlagSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "POTENTIAL_DUPLICATE",
        "POOR_SCAN_QUALITY",
        "POSSIBLE_SPLIT_UPLOAD_PATTERN",
        "NON_ACADEMIC_SUSPECTED",
        "COURSE_MISMATCH",
        "MIXED_COURSE_MATERIAL",
        "POOR_LEGIBILITY",
        "AI_VALIDATION_UNCERTAIN",
      ],
      required: true,
    },
    reason: { type: String, trim: true },
    matchedDocumentId: { type: Schema.Types.ObjectId, ref: "DocumentFile" },
    score: { type: Number, min: 0, max: 1 },
  },
  { _id: false },
);

const semanticValidationSchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        "not_required",
        "queued",
        "processing",
        "completed",
        "manual_required",
      ],
      required: true,
    },
    confidence: { type: Number, min: 0, max: 1 },
    reasons: { type: [String] },
    detectedCourseCodes: { type: [String] },
    checkedAt: { type: Date },
    attempts: { type: Number, default: 0, min: 0 },
    sampledPageNumbers: { type: [Number], select: false },
    processingStartedAt: { type: Date, select: false },
    nextAttemptAt: { type: Date, select: false },
  },
  { _id: false },
);

const documentValidationSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "clear", "flagged", "manual_required"],
      required: true,
    },
    flags: { type: [validationFlagSchema], default: [] },
    semantic: { type: semanticValidationSchema, required: true },
    checkedAt: { type: Date },
  },
  { _id: false },
);

const documentFileSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true }, // "pdf", "docx", "image", ...
    fileHash: { type: String }, // SHA-256 of the uploaded file bytes
    pageCount: { type: Number, min: 1 },
    pageFingerprints: { type: [String] },
    validation: { type: documentValidationSchema },
    thumbnailUrl: { type: String },
    thumbnailStorageKey: { type: String },
    sizeBytes: { type: Number },
    storageKey: { type: String }, // object key in the storage bucket, needed to delete the file
    tags: { type: [String], default: [] },
    downloadCount: { type: Number, default: 0 },

    // Drives the points-per-category rates (pointsService.ts).
    category: {
      type: String,
      enum: ["lecture_note", "exam_summary", "past_question", "other"],
      required: true,
    },

    uploadedByType: {
      type: String,
      enum: ["Admin", "Student"],
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "uploadedByType",
    },

    // Admin uploads are auto-approved (no self-review needed); student uploads start
    // "pending" and only earn points once an admin approves them.
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    pointsAwarded: { type: Number, default: 0 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, result: Record<string, unknown>) => {
        delete result.fileHash;
        delete result.pageFingerprints;
        delete result.storageKey;
        delete result.thumbnailStorageKey;
        // Hide legacy pre-consolidation fields if older records still contain them.
        delete result.scanQualityStatus;
        delete result.duplicateCheck;
        delete result.reviewFlags;
        delete result.semanticValidation;
        return result;
      },
    },
  },
);

documentFileSchema.index({ course: 1, createdAt: -1 });
documentFileSchema.index({ title: "text", tags: "text" });
documentFileSchema.index({ status: 1, createdAt: -1 });
documentFileSchema.index({ course: 1, status: 1 });
documentFileSchema.index({ uploadedByType: 1, uploadedBy: 1, status: 1 });
documentFileSchema.index({
  uploadedByType: 1,
  status: 1,
  "validation.semantic.status": 1,
  "validation.semantic.nextAttemptAt": 1,
});
documentFileSchema.index({
  uploadedByType: 1,
  uploadedBy: 1,
  course: 1,
  category: 1,
  status: 1,
  createdAt: -1,
});
// Sparse keeps legacy documents without a hash valid while enforcing exact
// duplicate protection for all newly uploaded files.
documentFileSchema.index({ fileHash: 1 }, { unique: true, sparse: true });

export type DocumentFileDoc = InferSchemaType<typeof documentFileSchema> & {
  _id: Types.ObjectId;
};
export const DocumentFile = model("DocumentFile", documentFileSchema);
