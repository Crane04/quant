import { Schema, model, Types, InferSchemaType } from "mongoose";

const studentBadgeSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    badge: { type: Schema.Types.ObjectId, ref: "Badge", required: true },
    earnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

studentBadgeSchema.index({ student: 1, badge: 1 }, { unique: true });

export type StudentBadgeDoc = InferSchemaType<typeof studentBadgeSchema> & { _id: Types.ObjectId };
export const StudentBadge = model("StudentBadge", studentBadgeSchema);
