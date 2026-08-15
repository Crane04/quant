import { Schema, model, Types, InferSchemaType } from "mongoose";

const studentCourseSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    session: { type: String, required: true, trim: true },
    semester: { type: String, enum: ["first", "second"], required: true },
  },
  { timestamps: true }
);

studentCourseSchema.index({ student: 1, course: 1 }, { unique: true });
studentCourseSchema.index({ student: 1, session: 1, semester: 1 });

export type StudentCourseDoc = InferSchemaType<typeof studentCourseSchema> & { _id: Types.ObjectId };
export const StudentCourse = model("StudentCourse", studentCourseSchema);
