import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { requireAmbassador } from "../middleware/requireAmbassador";
import { validate } from "../middleware/validate";
import * as timetableController from "../controllers/timetableController";
import {
  createSlotSchema,
  updateSlotSchema,
  myTimetableQuerySchema,
} from "../validators/timetableValidators";

const router = Router();

/**
 * @openapi
 * /timetable/mine:
 *   get:
 *     tags: [Timetable]
 *     summary: Get the current student's full weekly timetable
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: session, in: query, required: true, schema: { type: string } }
 *       - { name: semester, in: query, required: true, schema: { type: string, enum: [first, second] } }
 *     responses:
 *       200:
 *         description: Timetable slots, sorted by day then time
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/TimetableSlot' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/mine",
  resolveStudentContext,
  validate({ query: myTimetableQuerySchema }),
  timetableController.getMyTimetable,
);

/**
 * @openapi
 * /timetable/course/{courseId}:
 *   get:
 *     tags: [Timetable]
 *     summary: Get a course's weekly slots
 *     parameters:
 *       - { name: courseId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Timetable slots for the course
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/TimetableSlot' } } }
 */
router.get("/course/:courseId", timetableController.getCourseTimetable);

/**
 * @openapi
 * /timetable:
 *   post:
 *     tags: [Timetable]
 *     summary: Create a timetable slot (HOC Hub, ambassadors only)
 *     description: >
 *       The course must belong to the creating ambassador's own (university,
 *       department, level) — an HOC can only manage their own class's timetable.
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course, dayOfWeek, startTime, endTime]
 *             properties:
 *               course: { type: string }
 *               dayOfWeek: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *               startTime: { type: string, example: "09:00" }
 *               endTime: { type: string, example: "11:00" }
 *               venue: { type: string }
 *     responses:
 *       201:
 *         description: Slot created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/TimetableSlot' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  resolveStudentContext,
  requireAmbassador,
  validate({ body: createSlotSchema }),
  timetableController.createSlot,
);

/**
 * @openapi
 * /timetable/{id}:
 *   patch:
 *     tags: [Timetable]
 *     summary: Update a timetable slot (HOC Hub, ambassadors only)
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Slot updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/TimetableSlot' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  resolveStudentContext,
  requireAmbassador,
  validate({ body: updateSlotSchema }),
  timetableController.updateSlot,
);

/**
 * @openapi
 * /timetable/{id}:
 *   delete:
 *     tags: [Timetable]
 *     summary: Delete a timetable slot (HOC Hub, ambassadors only)
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Slot deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete(
  "/:id",
  resolveStudentContext,
  requireAmbassador,
  timetableController.deleteSlot,
);

export default router;
