import { Router } from "express";
import { validate } from "../middleware/validate";
import {
  requireAdminAuth,
  requireSuperAdmin,
} from "../middleware/requireAdminAuth";
import {
  adjustQuantsSchema,
  listTransactionsQuerySchema,
  updatePricingSchema,
} from "../validators/quantValidators";
import * as controller from "../controllers/quantController";

const router = Router();

/**
 * @openapi
 * /quants/pricing:
 *   get:
 *     tags: [Quants]
 *     summary: Get message pricing and last-7-day usage averages (admin)
 *     description: |
 *       Cost of one AI reply in quants (₦1 = 1 quant), rounded up and capped at maxPerMessage (0 = no cap):
 *       perMessage + chars/100 × per100Chars + promptTokens/1000 × per1kInputTokens + completionTokens/1000 × per1kOutputTokens
 *     security: [{ adminSession: [] }]
 *     responses:
 *       200: { description: Pricing and usage stats }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/pricing", requireAdminAuth, controller.getQuantPricing);

/**
 * @openapi
 * /quants/pricing:
 *   put:
 *     tags: [Quants]
 *     summary: Update message pricing (super admin only)
 *     security: [{ adminSession: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billingEnabled: { type: boolean }
 *               perMessage: { type: number }
 *               per100Chars: { type: number }
 *               per1kInputTokens: { type: number }
 *               per1kOutputTokens: { type: number }
 *               maxPerMessage: { type: number, description: "0 = no cap" }
 *     responses:
 *       200: { description: Updated pricing }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.put(
  "/pricing",
  requireAdminAuth,
  requireSuperAdmin,
  validate({ body: updatePricingSchema }),
  controller.updateQuantPricing,
);

/**
 * @openapi
 * /quants/students/{studentId}/adjust:
 *   post:
 *     tags: [Quants]
 *     summary: Add (or remove) quants for a student (super admin only)
 *     description: Positive amounts are announced to the student on WhatsApp. Removals can't go below 0.
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, reason]
 *             properties:
 *               amount: { type: integer, description: "Positive adds, negative removes" }
 *               reason: { type: string }
 *     responses:
 *       200: { description: New balance }
 *       400: { description: Invalid amount, or removal exceeds balance }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { description: Student not found }
 */
router.post(
  "/students/:studentId/adjust",
  requireAdminAuth,
  requireSuperAdmin,
  validate({ body: adjustQuantsSchema }),
  controller.adjustStudentQuants,
);

/**
 * @openapi
 * /quants/students/{studentId}/history:
 *   get:
 *     tags: [Quants]
 *     summary: A student's quant ledger — top-ups, charges, grants (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: Ledger entries, newest first }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/students/:studentId/history",
  requireAdminAuth,
  controller.getStudentQuantHistory,
);

/**
 * @openapi
 * /quants/transactions:
 *   get:
 *     tags: [Quants]
 *     summary: All quant transactions across students, newest first (admin)
 *     description: Top-ups (with the Flutterwave payment), admin credits/removals, reward conversions and chat charges, plus per-type totals for the same filter.
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { in: query, name: type, schema: { type: string }, description: "Comma-separated: topup, admin_adjustment, reward_conversion, chat_message" }
 *       - { in: query, name: studentId, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 25, maximum: 100 } }
 *     responses:
 *       200: { description: Paginated transactions with totals }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/transactions",
  requireAdminAuth,
  validate({ query: listTransactionsQuerySchema }),
  controller.getTransactions,
);

export default router;
