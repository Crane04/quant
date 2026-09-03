import { Schema, model, Types, InferSchemaType } from "mongoose";

const GRADE_POINTS: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  F: 0,
};

const gradeRecordSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    session: { type: String, required: true, trim: true },
    semester: { type: String, enum: ["first", "second"], required: true },
    creditUnits: { type: Number, required: true, min: 1 },
    grade: { type: String, enum: Object.keys(GRADE_POINTS), required: true },
    gradePoint: { type: Number }, // derived, set in pre-save hook
  },
  { timestamps: true },
);

gradeRecordSchema.pre("save", function (next) {
  this.gradePoint = GRADE_POINTS[this.grade as string];
  next();
});

gradeRecordSchema.index(
  { student: 1, course: 1, session: 1, semester: 1 },
  { unique: true },
);

export { GRADE_POINTS };
export type GradeRecordDoc = InferSchemaType<typeof gradeRecordSchema> & {
  _id: Types.ObjectId;
};
export const GradeRecord = model("GradeRecord", gradeRecordSchema);
