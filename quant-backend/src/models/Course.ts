import { Schema, model, Types, InferSchemaType } from "mongoose";

const courseSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "CSC301"
    title: { type: String, required: true, trim: true },
    university: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    creditUnits: { type: Number, required: true, min: 1 },
    session: { type: String, required: true, trim: true }, // e.g. "2025/2026"
    semester: { type: String, enum: ["first", "second"], required: true },
  },
  { timestamps: true },
);

courseSchema.index(
  { code: 1, university: 1, session: 1, semester: 1 },
  { unique: true },
);

export type CourseDoc = InferSchemaType<typeof courseSchema> & {
  _id: Types.ObjectId;
};
export const Course = model("Course", courseSchema);
