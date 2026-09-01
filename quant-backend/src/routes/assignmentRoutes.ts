import { Router } from "express";
import { z } from "zod";
import { requireBotApiKey } from "../middleware/requireBotApiKey";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { validate } from "../middleware/validate";
import * as assignmentController from "../controllers/assignmentController";
import { myAssignmentsQuerySchema } from "../validators/assignmentValidators";

const router = Router();

const markStatusSchema = z.object({ completed: z.boolean() });

/**
 * @openapi
 * /assignments/mine:
 *   get:
 *     tags: [Assignments]
 *     summary: List the student's saved personal assignments
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [pending, completed, all] } }
 *     responses:
 *       200:
 *         description: Assignments
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Assignment' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/mine",
  resolveStudentContext,
  validate({ query: myAssignmentsQuerySchema }),
  assignmentController.getMyAssignments
);

/**
 * @openapi
 * /assignments/upcoming-reminders:
 *   get:
 *     tags: [Assignments]
 *     summary: Assignments due within N hours that haven't been reminded yet (bot polls this)
 *     security: [{ botServiceKey: [] }]
 *     parameters:
 *       - { name: hours, in: query, schema: { type: integer, default: 24 } }
 *     responses:
 *       200:
 *         description: Upcoming assignments
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Assignment' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/upcoming-reminders", requireBotApiKey, assignmentController.getUpcomingForReminders);

/**
 * @openapi
 * /assignments/{id}:
 *   delete:
 *     tags: [Assignments]
 *     summary: Delete one of the student's assignments
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Assignment deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", resolveStudentContext, assignmentController.deleteAssignment);

/**
 * @openapi
 * /assignments/{id}/status:
 *   post:
 *     tags: [Assignments]
 *     summary: Mark an assignment completed/incomplete
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [completed]
 *             properties: { completed: { type: boolean } }
 *     responses:
 *       200: { description: Status updated, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  "/:id/status",
  resolveStudentContext,
  validate({ body: markStatusSchema }),
  assignmentController.markAssignmentStatus
);

export default router;
