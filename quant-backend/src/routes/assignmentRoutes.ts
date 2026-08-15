import { Router } from "express";
import { z } from "zod";
import { requireBotApiKey } from "../middleware/requireBotApiKey";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { validate } from "../middleware/validate";
import * as assignmentController from "../controllers/assignmentController";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  myAssignmentsQuerySchema,
} from "../validators/assignmentValidators";

const router = Router();

const markStatusSchema = z.object({ completed: z.boolean() });

/**
 * @openapi
 * /assignments/mine:
 *   get:
 *     tags: [Assignments]
 *     summary: List assignments across the student's enrolled courses, with completion status
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: session, in: query, required: true, schema: { type: string } }
 *       - { name: semester, in: query, required: true, schema: { type: string, enum: [first, second] } }
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
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/AssignmentWithStatus' } } }
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
 * /assignments/course/{courseId}:
 *   get:
 *     tags: [Assignments]
 *     summary: List a course's assignments
 *     parameters:
 *       - { name: courseId, in: path, required: true, schema: { type: string } }
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
 */
router.get("/course/:courseId", assignmentController.getCourseAssignments);

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
 * /assignments:
 *   post:
 *     tags: [Assignments]
 *     summary: Create an assignment (trusted service)
 *     security: [{ botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course, title, dueDate]
 *             properties:
 *               course: { type: string }
 *               title: { type: string }
 *               description: { type: string }
 *               dueDate: { type: string, format: date-time }
 *               attachmentUrl: { type: string }
 *     responses:
 *       201:
 *         description: Assignment created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Assignment' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  requireBotApiKey,
  validate({ body: createAssignmentSchema }),
  assignmentController.createAssignment
);

/**
 * @openapi
 * /assignments/{id}:
 *   patch:
 *     tags: [Assignments]
 *     summary: Update an assignment (trusted service)
 *     security: [{ botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Assignment updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Assignment' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  requireBotApiKey,
  validate({ body: updateAssignmentSchema }),
  assignmentController.updateAssignment
);

/**
 * @openapi
 * /assignments/{id}:
 *   delete:
 *     tags: [Assignments]
 *     summary: Delete an assignment (trusted service)
 *     security: [{ botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Assignment deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", requireBotApiKey, assignmentController.deleteAssignment);

/**
 * @openapi
 * /assignments/{id}/status:
 *   post:
 *     tags: [Assignments]
 *     summary: Mark an assignment completed/incomplete for the current student
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
 */
router.post(
  "/:id/status",
  resolveStudentContext,
  validate({ body: markStatusSchema }),
  assignmentController.markAssignmentStatus
);

export default router;
