import { Schema, model, Types, InferSchemaType } from "mongoose";

const studentSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // E.164 format, e.g. +2348012345678 — this is also the WhatsApp identity
      match: /^\+[1-9]\d{7,14}$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    matricNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    university: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true }, // e.g. "300"

    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },

    // Ambassadors are the only students allowed to log in to the web portal
    // (and, by extension, upload documents there) — set by an admin.
    isAmbassador: { type: Boolean, default: false },

    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

export type StudentDoc = InferSchemaType<typeof studentSchema> & { _id: Types.ObjectId };
export const Student = model("Student", studentSchema);
