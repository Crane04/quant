import { Schema, model, Types, InferSchemaType } from "mongoose";

const studentAssignmentStatusSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    lastRemindedAt: { type: Date },
  },
  { timestamps: true }
);

studentAssignmentStatusSchema.index({ student: 1, assignment: 1 }, { unique: true });

export type StudentAssignmentStatusDoc = InferSchemaType<typeof studentAssignmentStatusSchema> & {
  _id: Types.ObjectId;
};
export const StudentAssignmentStatus = model(
  "StudentAssignmentStatus",
  studentAssignmentStatusSchema
);
