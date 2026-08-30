import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import * as controller from "../controllers/badgeController";

const router = Router();

/**
 * @openapi
 * /badges/mine:
 *   get:
 *     tags: [Badges]
 *     summary: The full badge catalog, with earned/earnedAt merged in for the current student
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: Badges
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Badge' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine", resolveStudentContext, controller.getMyBadges);

/**
 * @openapi
 * /badges/{studentId}:
 *   get:
 *     tags: [Badges]
 *     summary: The full badge catalog, with earned/earnedAt merged in for a given student (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: studentId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Badges
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Badge' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/:studentId", requireAdminAuth, controller.getStudentBadges);

export default router;
