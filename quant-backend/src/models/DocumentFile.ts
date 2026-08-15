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

    uploadedByType: { type: String, enum: ["Admin", "Student"], required: true },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, refPath: "uploadedByType" },
  },
  { timestamps: true }
);

documentFileSchema.index({ course: 1, createdAt: -1 });
documentFileSchema.index({ title: "text", tags: "text" });

export type DocumentFileDoc = InferSchemaType<typeof documentFileSchema> & { _id: Types.ObjectId };
export const DocumentFile = model("DocumentFile", documentFileSchema);
