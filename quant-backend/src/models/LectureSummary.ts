import { Schema, model, Types, InferSchemaType } from "mongoose";

const lectureSummarySchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true }, // e.g. "Week 4 — Recursion"
    content: { type: String, required: true }, // the summary text sent to students
    sourceDocument: { type: Schema.Types.ObjectId, ref: "DocumentFile" },
  },
  { timestamps: true }
);

lectureSummarySchema.index({ course: 1, createdAt: -1 });

export type LectureSummaryDoc = InferSchemaType<typeof lectureSummarySchema> & { _id: Types.ObjectId };
export const LectureSummary = model("LectureSummary", lectureSummarySchema);
