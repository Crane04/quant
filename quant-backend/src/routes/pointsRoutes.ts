import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import * as controller from "../controllers/pointsController";

const router = Router();

/**
 * @openapi
 * /points/mine:
 *   get:
 *     tags: [Points]
 *     summary: Get the current student's points/tokens balance
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: Balance
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         points: { type: integer }
 *                         tokens: { type: integer }
 *                         lifetimePointsEarned: { type: integer }
 *                         uploadStreakDays: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine", resolveStudentContext, controller.getMyPoints);

/**
 * @openapi
 * /points/mine/history:
 *   get:
 *     tags: [Points]
 *     summary: Recent points ledger entries for the current student
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 20 } }
 *     responses:
 *       200:
 *         description: Points transactions, most recent first
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/PointsTransaction' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine/history", resolveStudentContext, controller.getMyPointsHistory);

export default router;
