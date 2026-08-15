import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping email send", { to, subject });
    return;
  }

  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    text,
  });

  if (error) {
    logger.error("Resend email send failed", { to, subject, error });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
