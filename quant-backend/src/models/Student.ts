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
    passwordHash: { type: String, required: true },
    university: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true }, // e.g. "300"

    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },

    // Ambassadors are the only students allowed to log in to the web portal
    // (and, by extension, upload documents there) — set by an admin.
    isAmbassador: { type: Boolean, default: false },

    // Head of Class — separate from isAmbassador. HOCs can schedule/edit/cancel
    // classes via the WhatsApp bot, which notifies students subscribed to that
    // course. Set by an admin.
    isHOC: { type: Boolean, default: false },

    // Gamification. `points` is the spendable/leaderboard balance (drops on reward
    // redemption); `lifetimePointsEarned` only ever goes up, so points-based badge
    // thresholds (e.g. Scholar Elite) survive later spending.
    points: { type: Number, default: 0 },
    lifetimePointsEarned: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },

    // Consecutive-day approved-upload streak, for streak badges.
    uploadStreakDays: { type: Number, default: 0 },
    lastApprovedUploadDate: { type: Date },

    // Set by an admin (quality review), independent of the automatic upload/streak badges.
    isVerifiedContributor: { type: Boolean, default: false },

    lastSeenAt: { type: Date },

    // CGPA Intelligence System — the goal the student set for themselves
    // (5.0 scale, matching GRADE_POINTS). Predictive math derives from this
    // plus their actual recorded GradeRecord entries.
    targetCgpa: { type: Number, min: 0, max: 5 },

    // Captured at signup (WhatsApp Flow "Referral Code" field), no attribution
    // logic on it yet — kept so real signup data isn't silently discarded.
    referredByCode: { type: String, trim: true },
  },
  { timestamps: true },
);

export type StudentDoc = InferSchemaType<typeof studentSchema> & {
  _id: Types.ObjectId;
};
export const Student = model("Student", studentSchema);
