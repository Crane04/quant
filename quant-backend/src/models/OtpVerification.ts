import { Schema, model, InferSchemaType } from "mongoose";

const otpVerificationSchema = new Schema(
  {
    identifier: { type: String, required: true, trim: true, lowercase: true }, // phone or email
    channel: { type: String, enum: ["phone", "email"], required: true },
    purpose: {
      type: String,
      enum: ["registration", "email_verification"],
      required: true,
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-expire documents once their TTL passes so stale OTPs don't pile up
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpVerificationSchema.index({ identifier: 1, purpose: 1 });

export type OtpVerificationDoc = InferSchemaType<typeof otpVerificationSchema>;
export const OtpVerification = model("OtpVerification", otpVerificationSchema);
