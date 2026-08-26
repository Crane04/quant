import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import * as controller from "../controllers/leaderboardController";

const router = Router();

/**
 * @openapi
 * /leaderboard:
 *   get:
 *     tags: [Leaderboard]
 *     summary: Top contributors by points (ambassadors only), plus the current student's own rank
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 20 } }
 *     responses:
 *       200:
 *         description: Leaderboard
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
 *                         entries: { type: array, items: { $ref: '#/components/schemas/LeaderboardEntry' } }
 *                         me:
 *                           type: object
 *                           nullable: true
 *                           properties: { rank: { type: integer }, points: { type: integer } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/", resolveStudentContext, controller.getLeaderboard);

export default router;
