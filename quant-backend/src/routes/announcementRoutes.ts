import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { requireAmbassador } from "../middleware/requireAmbassador";
import { requireBotApiKey } from "../middleware/requireBotApiKey";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/announcementController";
import {
  createAnnouncementSchema,
  myAnnouncementsQuerySchema,
} from "../validators/announcementValidators";

const router = Router();

/**
 * @openapi
 * /announcements:
 *   post:
 *     tags: [Announcements]
 *     summary: Create a lecture alert or general announcement (HOC Hub, ambassadors only)
 *     description: >
 *       Scoped to the creating ambassador's own (university, department, level) —
 *       every student in that class will see it via GET /announcements/mine.
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [type, courseId, message]
 *                 properties:
 *                   type: { type: string, enum: [lecture_alert] }
 *                   courseId: { type: string }
 *                   timetableSlotId: { type: string }
 *                   title: { type: string, description: "Defaults to \"Class Alert: <course code>\"" }
 *                   message: { type: string }
 *               - type: object
 *                 required: [type, title, message]
 *                 properties:
 *                   type: { type: string, enum: [announcement] }
 *                   title: { type: string }
 *                   message: { type: string }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Announcement' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  resolveStudentContext,
  requireAmbassador,
  validate({ body: createAnnouncementSchema }),
  controller.createAnnouncement
);

/**
 * @openapi
 * /announcements/mine:
 *   get:
 *     tags: [Announcements]
 *     summary: Announcements/lecture alerts scoped to the current student's own class
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: type, in: query, schema: { type: string, enum: [lecture_alert, announcement] } }
 *     responses:
 *       200:
 *         description: Announcements
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Announcement' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/mine",
  resolveStudentContext,
  validate({ query: myAnnouncementsQuerySchema }),
  controller.getMyAnnouncements
);

/**
 * @openapi
 * /announcements/unsent:
 *   get:
 *     tags: [Announcements]
 *     summary: Announcements not yet pushed out over WhatsApp (bot polls this)
 *     security: [{ botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: Unsent announcements
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Announcement' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/unsent", requireBotApiKey, controller.getUnsent);

/**
 * @openapi
 * /announcements/{id}/mark-sent:
 *   post:
 *     tags: [Announcements]
 *     summary: Mark an announcement as delivered (bot calls this after sending)
 *     security: [{ botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Marked sent
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Announcement' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post("/:id/mark-sent", requireBotApiKey, controller.markSent);

export default router;
