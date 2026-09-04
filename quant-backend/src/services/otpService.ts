import { OtpVerification } from "../models/OtpVerification";
import { env } from "../config/env";
import { generateOtpCode, hashOtp } from "../utils/otp";
import { ApiError } from "../utils/ApiError";
import { sendWhatsAppText } from "./waService";
import { sendMail } from "./mailService";

type Channel = "phone" | "email";
type Purpose = "registration" | "email_verification" | "password_reset";

const MAX_ATTEMPTS = 5;

export async function issueOtp(
  identifier: string,
  channel: Channel,
  purpose: Purpose,
) {
  const code = generateOtpCode(6);
  const codeHash = hashOtp(code);
  const expiresAt = new Date(
    Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000,
  );

  // Invalidate any prior outstanding OTPs for the same identifier + purpose
  await OtpVerification.updateMany(
    { identifier: identifier.toLowerCase(), purpose, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );

  await OtpVerification.create({
    identifier: identifier.toLowerCase(),
    channel,
    purpose,
    codeHash,
    expiresAt,
  });

  const message = `Your Quant verification code is ${code}. It expires in ${env.OTP_EXPIRES_IN_MINUTES} minutes.`;

  if (channel === "phone") {
    await sendWhatsAppText(identifier, message);
  } else {
    await sendMail(identifier, "Your Quant verification code", message);
  }
}

export async function verifyOtp(
  identifier: string,
  purpose: Purpose,
  code: string,
): Promise<void> {
  const record = await OtpVerification.findOne({
    identifier: identifier.toLowerCase(),
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!record)
    throw ApiError.badRequest(
      "No pending verification code for this identifier",
    );

  if (record.expiresAt < new Date()) {
    throw ApiError.badRequest("Verification code has expired");
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest("Too many attempts — request a new code");
  }

  if (record.codeHash !== hashOtp(code)) {
    record.attempts += 1;
    await record.save();
    throw ApiError.badRequest("Incorrect verification code");
  }

  record.consumedAt = new Date();
  await record.save();
}
