import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { verifyWebhookSignature } from "../services/waService";
import { decryptFlowRequest, encryptFlowResponse, DecryptedFlowRequest } from "../services/flowCryptoService";

/**
 * Our Flow doesn't use server-side navigation (every screen uses a client-side
 * "navigate"/"complete" action) — so in practice Meta should only ever call this
 * for health checks ("ping"). INIT/data_exchange/BACK are handled defensively
 * anyway, in case that changes later.
 */
function handleFlowAction(request: DecryptedFlowRequest): unknown {
  switch (request.action) {
    case "ping":
      return { data: { status: "active" } };
    case "INIT":
      return { version: request.version, screen: "PERSONAL_INFO", data: {} };
    case "BACK":
    case "data_exchange":
      return { version: request.version, screen: request.screen ?? "PERSONAL_INFO", data: request.data ?? {} };
    default:
      return { version: request.version, data: { acknowledged: true } };
  }
}

export async function handleFlowRequest(req: Request, res: Response): Promise<void> {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (req.rawBody && !verifyWebhookSignature(req.rawBody, signature)) {
    logger.warn("Rejected Flow endpoint request with invalid signature");
    res.sendStatus(432);
    return;
  }

  let decrypted;
  try {
    decrypted = decryptFlowRequest(req.body);
  } catch (err) {
    // Meta's documented behavior: a 421 tells the client to refresh the public
    // key and retry, which is exactly right if our key ever gets out of sync.
    logger.error("Failed to decrypt Flow endpoint request", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.sendStatus(421);
    return;
  }

  const { request, aesKey, iv } = decrypted;
  const responsePayload = handleFlowAction(request);
  const encrypted = encryptFlowResponse(responsePayload, aesKey, iv);

  res.set("Content-Type", "text/plain").status(200).send(encrypted);
}
