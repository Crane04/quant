import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/rewardController";
import { redeemRewardSchema } from "../validators/rewardValidators";

const router = Router();

/**
 * @openapi
 * /rewards:
 *   get:
 *     tags: [Rewards]
 *     summary: The redeemable rewards catalog
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: Rewards
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Reward' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/", resolveStudentContext, controller.listRewards);

/**
 * @openapi
 * /rewards/{id}/redeem:
 *   post:
 *     tags: [Rewards]
 *     summary: Redeem a reward with points
 *     description: >
 *       Deducts pointsCost from the student's balance. Token-conversion rewards
 *       credit tokens immediately; voucher rewards return a generated code + expiry.
 *       Points are never deducted on a validation failure (insufficient points, missing size).
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { size: { type: string, description: "Required for rewards with requiresSize" } }
 *     responses:
 *       201:
 *         description: Redeemed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/RewardRedemption' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/:id/redeem",
  resolveStudentContext,
  validate({ body: redeemRewardSchema }),
  controller.redeem,
);

/**
 * @openapi
 * /rewards/mine/history:
 *   get:
 *     tags: [Rewards]
 *     summary: The current student's redemption history
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: Redemptions
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/RewardRedemption' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine/history", resolveStudentContext, controller.getMyRedemptions);

/**
 * @openapi
 * /rewards/redemptions:
 *   get:
 *     tags: [Rewards]
 *     summary: All redemptions across all students, most recent first (admin fulfillment queue)
 *     security: [{ adminSession: [] }]
 *     responses:
 *       200:
 *         description: Redemptions
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/RewardRedemption' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/redemptions", requireAdminAuth, controller.listAllRedemptions);

export default router;
