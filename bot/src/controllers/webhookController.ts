import { Request, Response } from "express";
import { processIncomingMessage } from "../services/webhookService";
import { logError } from "../utils/logger";
import { sendEmptyTwiml } from "../utils/twilioResponse";

export const handleIncoming = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const from: string = req.body.From || "";
  const body: string = (req.body.Body || "").trim();

  sendEmptyTwiml(res);

  if (!from || !body) return;

  await processIncomingMessage(from, body).catch((err) => {
    logError("Twilio webhook processing failed", {
      from,
      error: err instanceof Error ? err.message : "Unknown webhook error",
    });
  });
};
