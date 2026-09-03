import { Schema, model, Types, InferSchemaType } from "mongoose";

const announcementSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["lecture_alert", "announcement"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // Required for lecture_alert (the class being alerted about); optional otherwise.
    course: { type: Schema.Types.ObjectId, ref: "Course" },
    timetableSlot: { type: Schema.Types.ObjectId, ref: "TimetableSlot" },

    // Snapshotted from the creating ambassador's own record so recipients can be
    // resolved by (university, department, level) without joining back to Student.
    university: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },

    createdByType: { type: String, enum: ["Student", "Admin"], required: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "createdByType",
    },

    sentAt: { type: Date }, // set once the bot has pushed it out over WhatsApp
  },
  { timestamps: true },
);

announcementSchema.index({
  university: 1,
  department: 1,
  level: 1,
  createdAt: -1,
});
announcementSchema.index({ sentAt: 1 });

export type AnnouncementDoc = InferSchemaType<typeof announcementSchema> & {
  _id: Types.ObjectId;
};
export const Announcement = model("Announcement", announcementSchema);
