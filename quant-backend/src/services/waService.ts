import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const GRAPH_BASE_URL = "https://graph.facebook.com/v20.0";

/** Meta sends the sender's number as bare digits, e.g. "2348012345678". */
export function metaPhoneToE164(metaPhone: string): string {
  const digits = metaPhone.replace(/\D/g, "");
  return `+${digits}`;
}

/**
 * Verifies the X-Hub-Signature-256 header Meta sends on every webhook POST,
 * computed as HMAC-SHA256 of the *raw* request body using the app secret.
 * Skips verification (with a warning) if META_WA_APP_SECRET isn't set, so
 * local development doesn't require a full Meta app to be configured.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.META_WA_APP_SECRET) {
    logger.warn("META_WA_APP_SECRET not configured — skipping webhook signature verification");
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", env.META_WA_APP_SECRET).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Sends a plain text WhatsApp message via the Meta Cloud API.
 * Used e.g. to deliver a phone-verification OTP straight into the chat
 * the student already has open with the bot.
 *
 * Note: outside a 24h customer-service window Meta requires an approved
 * template message instead of free-form text — swap this out for
 * sendWhatsAppTemplate() if you hit that in production.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    logger.warn("META_WA credentials not configured — skipping WhatsApp send", { to });
    return;
  }

  const url = `${GRAPH_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace("+", ""),
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error("WhatsApp send failed", { status: res.status, body: errBody });
    throw new Error(`Failed to send WhatsApp message: ${res.status}`);
  }
}
