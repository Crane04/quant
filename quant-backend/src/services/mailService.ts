import { createElement, type ReactElement } from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import OtpEmail from "../emails/otp";
import WelcomeEmail from "../emails/welcome";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// The templates' image URLs (emails/components/assets.ts) read this at render time.
process.env.EMAIL_ASSET_BASE =
  env.EMAIL_ASSET_BASE || `${env.APP_BASE_URL}/email-assets`;

export async function sendMail(
  to: string,
  subject: string,
  email: ReactElement,
): Promise<void> {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping email send", {
      to,
      subject,
    });
    return;
  }

  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ]);

  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    logger.error("Resend email send failed", { to, subject, error });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// "Ada Lovelace" -> "Ada", matching the "Dear Ahmad," greeting in the designs.
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "Student";
}

export function sendOtpEmail(
  to: string,
  fullName: string,
  otp: string,
): Promise<void> {
  return sendMail(
    to,
    // Code in the subject lets Gmail/Apple Mail detect it and offer "Copy code"
    // (and iOS autofill) straight from the notification.
    `${otp} is your Quant verification code`,
    createElement(OtpEmail, {
      studentName: firstName(fullName),
      otp,
      expiresInMinutes: env.OTP_EXPIRES_IN_MINUTES,
    }),
  );
}

export function sendWelcomeEmail(to: string, fullName: string): Promise<void> {
  return sendMail(
    to,
    "Welcome to Quant!",
    createElement(WelcomeEmail, { studentName: firstName(fullName) }),
  );
}

// For sends that shouldn't fail the request they ride along with.
export function sendWelcomeEmailInBackground(to: string, fullName: string) {
  sendWelcomeEmail(to, fullName).catch((err) =>
    logger.error("Failed to send welcome email", {
      to,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
}
