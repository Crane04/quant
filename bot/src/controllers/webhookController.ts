import { Request, Response } from "express";
import { processIncomingMessage } from "../services/webhookService";
import { sendEmptyTwiml } from "../utils/twilioResponse";

export const handleIncoming = async (req: Request, res: Response): Promise<void> => {
  const from: string = req.body.From || "";
  const body: string = (req.body.Body || "").trim();

  sendEmptyTwiml(res);
  await processIncomingMessage(from, body);
};
