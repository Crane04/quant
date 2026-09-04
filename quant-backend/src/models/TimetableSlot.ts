import { Schema, model, Types, InferSchemaType } from "mongoose";

const timetableSlotSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    dayOfWeek: {
      type: String,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      required: true,
    },
    startTime: { type: String, required: true }, // "09:00" (24h)
    endTime: { type: String, required: true }, // "11:00"
    venue: { type: String, trim: true },
    // When the "starts in 10 minutes" reminder last fired for this slot — this
    // recurs weekly, so it's a cooldown marker (re-armed after ~a day), not a
    // one-time flag like Assignment's reminderSentAt.
    lastReminderSentAt: { type: Date },
  },
  { timestamps: true },
);

timetableSlotSchema.index({ course: 1, dayOfWeek: 1, startTime: 1 });

export type TimetableSlotDoc = InferSchemaType<typeof timetableSlotSchema> & {
  _id: Types.ObjectId;
};
export const TimetableSlot = model("TimetableSlot", timetableSlotSchema);
