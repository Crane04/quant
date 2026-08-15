import { env } from "../config/env";
import { logger } from "../utils/logger";

const GRAPH_BASE_URL = "https://graph.facebook.com/v20.0";

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
