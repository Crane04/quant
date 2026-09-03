import { Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { verifyWebhookSignature, metaPhoneToE164 } from "../services/waService";
import {
  processIncomingMessage,
  processFlowSubmission,
} from "../services/waConversationService";

/**
 * Meta's one-time handshake when you set the webhook URL in the Meta app
 * dashboard: echo back hub.challenge if hub.verify_token matches ours.
 */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.META_WA_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
}

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
            nfm_reply?: { response_json?: string };
          };
        }>;
      };
    }>;
  }>;
};

/**
 * Meta expects a fast 200 OK to acknowledge receipt — actual replies go out
 * asynchronously via the Graph API, not the webhook response body (mirrors
 * the old Twilio bot's sendEmptyTwiml-then-process-async pattern).
 */
export function handleIncoming(req: Request, res: Response): void {
  res.sendStatus(200);

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (req.rawBody && !verifyWebhookSignature(req.rawBody, signature)) {
    logger.warn("Rejected WhatsApp webhook with invalid signature");
    return;
  }

  const payload = req.body as MetaWebhookPayload;
  const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

  for (const message of messages) {
    if (!message.from) continue;
    const from = metaPhoneToE164(message.from);

    if (message.interactive?.type === "nfm_reply") {
      const responseJson = message.interactive.nfm_reply?.response_json;
      if (!responseJson) continue;

      processFlowSubmission(from, responseJson).catch((err) => {
        logger.error("WhatsApp flow submission processing failed", {
          from,
          error: err instanceof Error ? err.message : "Unknown webhook error",
        });
      });
      continue;
    }

    const body =
      message.text?.body ??
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      "";

    if (!body.trim()) continue;

    processIncomingMessage(from, body).catch((err) => {
      logger.error("WhatsApp webhook processing failed", {
        from,
        error: err instanceof Error ? err.message : "Unknown webhook error",
      });
    });
  }
}
