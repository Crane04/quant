import crypto from "crypto";
import { Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { verifyAndCreditPayment, VerifyResult } from "../services/quantService";
import { Payment } from "../models/Payment";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";

function hashMatches(received: string | undefined): boolean {
  if (!env.FLUTTERWAVE_WEBHOOK_HASH || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(env.FLUTTERWAVE_WEBHOOK_HASH);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Flutterwave webhook. The body is only used to find the transaction — the
 * credit decision is made off Flutterwave's verify endpoint, not this payload.
 */
export async function handleFlutterwaveWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  if (!hashMatches(req.header("verif-hash"))) {
    res.sendStatus(401);
    return;
  }

  // Two payload shapes, depending on the dashboard's webhook version setting:
  // v3 nests the transaction under `data` ({ event, data: { id, tx_ref } });
  // the legacy format puts it at the top level ({ id, txRef, "event.type" }).
  const body = req.body as {
    id?: number;
    txRef?: string;
    data?: { id?: number; tx_ref?: string };
  };
  const transactionId = body.data?.id ?? body.id;
  const txRef = body.data?.tx_ref ?? body.txRef;

  // Acknowledge immediately — Flutterwave retries on slow or non-2xx responses.
  res.sendStatus(200);

  if (!transactionId || !txRef) return;
  verifyAndCreditPayment(txRef, transactionId).catch((err) => {
    logger.error("Flutterwave webhook verification failed", {
      txRef,
      error: err instanceof Error ? err.message : "unknown",
    });
  });
}

const PAGE_COPY: Record<VerifyResult["status"] | "error", { title: string; body: string }> = {
  credited: {
    title: "Payment received ✅",
    body: "Your quants have been added. Head back to WhatsApp to keep chatting.",
  },
  already_credited: {
    title: "Payment received ✅",
    body: "Your quants have been added. Head back to WhatsApp to keep chatting.",
  },
  pending: {
    title: "Payment processing…",
    body: "We'll message you on WhatsApp as soon as it's confirmed.",
  },
  failed: {
    title: "Payment didn't go through",
    body: "You haven't been charged. Go back to WhatsApp and tap a top-up option to try again.",
  },
  not_found: {
    title: "Payment not found",
    body: "Go back to WhatsApp and tap a top-up option to try again.",
  },
  error: {
    title: "Payment processing…",
    body: "We couldn't confirm it just yet — we'll message you on WhatsApp once it's through.",
  },
};

/**
 * Flutterwave's redirect_url after checkout. Also verifies, so quants land
 * even if the webhook is late; verifyAndCreditPayment makes the two idempotent.
 */
export async function paymentCallback(req: Request, res: Response): Promise<void> {
  const txRef = typeof req.query.tx_ref === "string" ? req.query.tx_ref : "";
  const transactionId = Number(req.query.transaction_id);
  const status = typeof req.query.status === "string" ? req.query.status : "";

  let outcome: keyof typeof PAGE_COPY = "failed";
  if (status === "cancelled") {
    outcome = "failed";
  } else if (txRef && Number.isInteger(transactionId) && transactionId > 0) {
    try {
      outcome = (await verifyAndCreditPayment(txRef, transactionId)).status;
    } catch (err) {
      logger.error("Payment callback verification failed", {
        txRef,
        error: err instanceof Error ? err.message : "unknown",
      });
      outcome = "error";
    }
  }

  const { title, body } = PAGE_COPY[outcome];
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quant — ${title}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #111; }
    main { max-width: 420px; text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { color: #555; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
  </main>
</body>
</html>`);
}

type PublicPaymentStatus =
  | "successful"
  | "pending"
  | "failed"
  | "cancelled"
  | "not_found";

/**
 * For the website's payment-result page: takes the query Flutterwave appended
 * to the redirect, verifies with Flutterwave and credits quants if that hasn't
 * happened yet (idempotent with the webhook). Public, since the student isn't
 * signed in on the website — tx_ref is an unguessable random reference, and
 * the response carries no personal details.
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { tx_ref: txRef, transaction_id: transactionId, status } =
    req.query as unknown as {
      tx_ref: string;
      transaction_id?: number;
      status?: string;
    };

  const payment = await Payment.findOne({ txRef });
  if (!payment) {
    sendSuccess(res, { status: "not_found" satisfies PublicPaymentStatus, txRef });
    return;
  }

  let outcome: PublicPaymentStatus;
  if (payment.status === "successful") {
    outcome = "successful";
  } else if (status === "cancelled" && !transactionId) {
    outcome = "cancelled";
  } else {
    let result: VerifyResult["status"];
    try {
      result = (await verifyAndCreditPayment(txRef, transactionId)).status;
    } catch (err) {
      logger.error("Payment verify endpoint failed", {
        txRef,
        error: err instanceof Error ? err.message : "unknown",
      });
      // Flutterwave unreachable — the webhook will still credit it; tell the
      // page to show "processing" rather than an error.
      result = "pending";
    }
    outcome =
      result === "credited" || result === "already_credited" ? "successful" : result;
  }

  sendSuccess(res, {
    status: outcome,
    txRef,
    amount: payment.amount,
    currency: payment.currency,
    quants: payment.quants,
  });
});
