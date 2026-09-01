import { Schema, model, Types, InferSchemaType } from "mongoose";

const assignmentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    // Freeform label the student gave (e.g. "MEE 501") — not a Course ref. The
    // course doesn't need to exist in the system for the assignment to be saved.
    courseLabel: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    reminderSentAt: { type: Date },
  },
  { timestamps: true }
);

assignmentSchema.index({ student: 1, dueDate: 1 });

export type AssignmentDoc = InferSchemaType<typeof assignmentSchema> & { _id: Types.ObjectId };
export const Assignment = model("Assignment", assignmentSchema);
