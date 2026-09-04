import { Schema, model, Types, InferSchemaType } from "mongoose";

// Only stores *exceptions* to the default — a student is implicitly subscribed
// to any course matching their own (university, department, level), so an
// explicit record only exists when that default has been overridden: an
// opt-out from an in-class course, or an opt-in to an out-of-class one
// (carryovers, borrowed courses).
const courseSubscriptionSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    subscribed: { type: Boolean, required: true },
  },
  { timestamps: true },
);

courseSubscriptionSchema.index({ student: 1, course: 1 }, { unique: true });

export type CourseSubscriptionDoc = InferSchemaType<
  typeof courseSubscriptionSchema
> & { _id: Types.ObjectId };
export const CourseSubscription = model(
  "CourseSubscription",
  courseSubscriptionSchema,
);
