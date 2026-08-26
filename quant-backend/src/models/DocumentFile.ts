import { Schema, model, Types, InferSchemaType } from "mongoose";

const documentFileSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true }, // "pdf", "docx", "image", ...
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

    uploadedByType: { type: String, enum: ["Admin", "Student"], required: true },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, refPath: "uploadedByType" },

    // Admin uploads are auto-approved (no self-review needed); student uploads start
    // "pending" and only earn points once an admin approves them.
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    pointsAwarded: { type: Number, default: 0 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

documentFileSchema.index({ course: 1, createdAt: -1 });
documentFileSchema.index({ title: "text", tags: "text" });
documentFileSchema.index({ status: 1, createdAt: -1 });
documentFileSchema.index({ uploadedByType: 1, uploadedBy: 1, status: 1 });

export type DocumentFileDoc = InferSchemaType<typeof documentFileSchema> & { _id: Types.ObjectId };
export const DocumentFile = model("DocumentFile", documentFileSchema);
