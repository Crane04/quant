import { Schema, model, Types, InferSchemaType } from "mongoose";

const assignmentSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    dueDate: { type: Date, required: true },
    attachmentUrl: { type: String, trim: true },
    reminderSentAt: [{ type: Date }], // timestamps of reminder broadcasts already sent
  },
  { timestamps: true }
);

assignmentSchema.index({ course: 1, dueDate: 1 });

export type AssignmentDoc = InferSchemaType<typeof assignmentSchema> & { _id: Types.ObjectId };
export const Assignment = model("Assignment", assignmentSchema);
