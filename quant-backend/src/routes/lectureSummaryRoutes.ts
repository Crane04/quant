import { Router } from "express";
import { requireBotApiKey } from "../middleware/requireBotApiKey";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/lectureSummaryController";
import {
  createLectureSummarySchema,
  updateLectureSummarySchema,
} from "../validators/lectureSummaryValidators";
import { myTimetableQuerySchema } from "../validators/timetableValidators"; // {session, semester} shape

const router = Router();

/**
 * @openapi
 * /lecture-summaries/mine:
 *   get:
 *     tags: [Lecture Summaries]
 *     summary: Recent lecture summaries across the student's enrolled courses
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: session, in: query, required: true, schema: { type: string } }
 *       - { name: semester, in: query, required: true, schema: { type: string, enum: [first, second] } }
 *     responses:
 *       200:
 *         description: Lecture summaries
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/LectureSummary' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine", resolveStudentContext, validate({ query: myTimetableQuerySchema }), controller.getMySummaries);

/**
 * @openapi
 * /lecture-summaries/course/{courseId}:
 *   get:
 *     tags: [Lecture Summaries]
 *     summary: List a course's lecture summaries
 *     parameters:
 *       - { name: courseId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Lecture summaries
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/LectureSummary' } } }
 */
router.get("/course/:courseId", controller.getCourseSummaries);

/**
 * @openapi
 * /lecture-summaries/{id}:
 *   get:
 *     tags: [Lecture Summaries]
 *     summary: Get a lecture summary by id
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Lecture summary
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/LectureSummary' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/:id", controller.getSummary);

/**
 * @openapi
 * /lecture-summaries:
 *   post:
 *     tags: [Lecture Summaries]
 *     summary: Create a lecture summary (trusted service)
 *     security: [{ botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course, title, content]
 *             properties:
 *               course: { type: string }
 *               title: { type: string }
 *               content: { type: string }
 *               sourceDocument: { type: string }
 *     responses:
 *       201:
 *         description: Lecture summary created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/LectureSummary' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  requireBotApiKey,
  validate({ body: createLectureSummarySchema }),
  controller.createLectureSummary
);

/**
 * @openapi
 * /lecture-summaries/{id}:
 *   patch:
 *     tags: [Lecture Summaries]
 *     summary: Update a lecture summary (trusted service)
 *     security: [{ botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Lecture summary updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/LectureSummary' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  requireBotApiKey,
  validate({ body: updateLectureSummarySchema }),
  controller.updateLectureSummary
);

/**
 * @openapi
 * /lecture-summaries/{id}:
 *   delete:
 *     tags: [Lecture Summaries]
 *     summary: Delete a lecture summary (trusted service)
 *     security: [{ botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Lecture summary deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", requireBotApiKey, controller.deleteLectureSummary);

export default router;
