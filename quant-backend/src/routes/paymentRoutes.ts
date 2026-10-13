import { Router } from "express";
import { validate } from "../middleware/validate";
import { verifyPaymentQuerySchema } from "../validators/paymentValidators";
import { verifyPayment } from "../controllers/paymentController";

const router = Router();

/**
 * @openapi
 * /payments/verify:
 *   get:
 *     tags: [Payments]
 *     summary: Verify a quant top-up after Flutterwave checkout (public)
 *     description: |
 *       For the website's payment-result page. Flutterwave redirects the student to
 *       PAYMENT_REDIRECT_URL with `?status=…&tx_ref=…&transaction_id=…` — pass those
 *       straight through. Verifies with Flutterwave and credits quants if the webhook
 *       hasn't already; safe to call repeatedly. Poll every few seconds while `pending`.
 *     parameters:
 *       - { in: query, name: tx_ref, required: true, schema: { type: string }, example: quant_73ebc2022290789f0ea02758 }
 *       - { in: query, name: transaction_id, schema: { type: integer }, example: 10549161 }
 *       - { in: query, name: status, schema: { type: string }, description: "Flutterwave's redirect status, e.g. completed / successful / cancelled" }
 *     responses:
 *       200:
 *         description: Payment status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, enum: [successful, pending, failed, cancelled, not_found] }
 *                     txRef: { type: string }
 *                     amount: { type: number, description: "NGN paid (absent when not_found)" }
 *                     currency: { type: string }
 *                     quants: { type: number, description: "Quants this payment adds" }
 *       400: { description: Missing or invalid tx_ref }
 */
router.get("/verify", validate({ query: verifyPaymentQuerySchema }), verifyPayment);

export default router;
