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
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!env.META_WA_APP_SECRET) {
    logger.warn(
      "META_WA_APP_SECRET not configured — skipping webhook signature verification",
    );
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", env.META_WA_APP_SECRET)
    .update(rawBody)
    .digest("hex");
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
export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<void> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    logger.warn("META_WA credentials not configured — skipping WhatsApp send", {
      to,
    });
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

/**
 * Marks an incoming message as read (blue ticks) and shows the "typing…"
 * indicator in the chat. Meta clears the typing indicator automatically
 * after ~25s or as soon as we send a reply, whichever comes first — so this
 * is meant to be fired immediately on webhook receipt, before the agent
 * loop (which can take a few seconds) starts.
 */
export async function markAsRead(messageId: string): Promise<void> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) return;

  const url = `${GRAPH_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error("WhatsApp mark-as-read failed", {
      status: res.status,
      body: errBody,
    });
    throw new Error(`Failed to mark WhatsApp message as read: ${res.status}`);
  }
}

/**
 * Sends a file as a native WhatsApp document attachment (not a link) via the
 * Meta Cloud API's `link`-based document message — Meta fetches the file itself
 * from the given public URL, so this works directly off our R2 fileUrl with no
 * separate upload-to-Meta step.
 */
export async function sendWhatsAppDocument(
  to: string,
  fileUrl: string,
  filename: string,
  caption?: string,
): Promise<void> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    logger.warn(
      "META_WA credentials not configured — skipping WhatsApp document send",
      { to },
    );
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
      type: "document",
      document: { link: fileUrl, filename, ...(caption && { caption }) },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error("WhatsApp document send failed", {
      status: res.status,
      body: errBody,
    });
    throw new Error(`Failed to send WhatsApp document: ${res.status}`);
  }
}

/**
 * Sends an interactive message that opens a WhatsApp Flow (native multi-screen
 * form) — used to kick off registration instead of a field-by-field chat wizard.
 */
export async function sendWhatsAppFlow(
  to: string,
  options: {
    headerText: string;
    bodyText: string;
    ctaText: string;
    firstScreen: string;
  },
): Promise<void> {
  // Unlike sendWhatsAppText/sendWhatsAppDocument, this must throw (not silently no-op)
  // on missing config — the caller's try/catch is how it decides to fall back to the
  // text wizard or web page. A silent skip here left users stuck with no message and
  // no fallback at all.
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error("META_WA credentials not configured");
  }
  if (!env.META_WA_REGISTRATION_FLOW_ID) {
    throw new Error("META_WA_REGISTRATION_FLOW_ID not configured");
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
      type: "interactive",
      interactive: {
        type: "flow",
        header: { type: "text", text: options.headerText },
        body: { text: options.bodyText },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: crypto.randomBytes(16).toString("hex"),
            flow_id: env.META_WA_REGISTRATION_FLOW_ID,
            flow_cta: options.ctaText,
            flow_action: "navigate",
            // Meta's API rejects an empty `data: {}` here with a "must be dynamic_object"
            // error — omit it entirely when there's nothing to pre-populate the screen with.
            flow_action_payload: { screen: options.firstScreen },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error("WhatsApp flow send failed", {
      status: res.status,
      body: errBody,
    });
    throw new Error(`Failed to send WhatsApp flow: ${res.status}`);
  }
}

/**
 * Sends a link as an interactive CTA-URL button, which WhatsApp opens in its own
 * in-app browser — unlike a plain URL in a text message, which always kicks out
 * to the device's external browser.
 */
export async function sendWhatsAppCtaUrl(
  to: string,
  options: { bodyText: string; buttonText: string; url: string },
): Promise<void> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error("META_WA credentials not configured");
  }

  const endpoint = `${GRAPH_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace("+", ""),
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: options.bodyText },
        action: {
          name: "cta_url",
          parameters: { display_text: options.buttonText, url: options.url },
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error("WhatsApp CTA URL send failed", {
      status: res.status,
      body: errBody,
    });
    throw new Error(`Failed to send WhatsApp CTA URL: ${res.status}`);
  }
}

/**
 * Sends up to 3 tappable quick-reply buttons. WhatsApp caps both the count
 * (max 3) and each button's title (max 20 chars) — validated here so a bad
 * call fails with a clear message instead of a cryptic Graph API 400.
 * Tapping one sends its title back as if the student had typed it
 * (see webhookController.ts's button_reply handling) — no special handling
 * needed on the receiving side.
 */
export async function sendWhatsAppButtons(
  to: string,
  options: {
    bodyText: string;
    buttons: { id: string; title: string }[];
    footerText?: string;
  },
): Promise<void> {
  if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
    throw new Error("META_WA credentials not configured");
  }
  if (options.buttons.length === 0 || options.buttons.length > 3) {
    throw new Error("WhatsApp reply-button messages support 1-3 buttons");
  }
  const tooLong = options.buttons.find((b) => b.title.length > 20);
  if (tooLong) {
    throw new Error(
      `Button title "${tooLong.title}" exceeds WhatsApp's 20-character limit`,
    );
  }

  const endpoint = `${GRAPH_BASE_URL}/${env.META_WA_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace("+", ""),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: options.bodyText },
        ...(options.footerText && { footer: { text: options.footerText } }),
        action: {
          buttons: options.buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error("WhatsApp buttons send failed", {
      status: res.status,
      body: errBody,
    });
    throw new Error(`Failed to send WhatsApp buttons: ${res.status}`);
  }
}
