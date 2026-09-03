import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/gradeController";
import {
  addGradeSchema,
  updateGradeSchema,
} from "../validators/gradeValidators";

const router = Router();

/**
 * @openapi
 * /grades/mine:
 *   get:
 *     tags: [Grades]
 *     summary: List the current student's grade records
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: session, in: query, schema: { type: string } }
 *       - { name: semester, in: query, schema: { type: string, enum: [first, second] } }
 *     responses:
 *       200:
 *         description: Grade records
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/GradeRecord' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine", resolveStudentContext, controller.getMyGrades);

/**
 * @openapi
 * /grades/mine/cgpa:
 *   get:
 *     tags: [Grades]
 *     summary: Get the current student's cumulative and per-semester GPA
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: CGPA breakdown
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Cgpa' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine/cgpa", resolveStudentContext, controller.getMyCgpa);

/**
 * @openapi
 * /grades:
 *   post:
 *     tags: [Grades]
 *     summary: Add or update a grade for the current student (upsert by course/session/semester)
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course, session, semester, creditUnits, grade]
 *             properties:
 *               phone: { type: string, description: "bot-service calls only" }
 *               course: { type: string }
 *               session: { type: string }
 *               semester: { type: string, enum: [first, second] }
 *               creditUnits: { type: integer }
 *               grade: { type: string, enum: [A, B, C, D, E, F] }
 *     responses:
 *       201:
 *         description: Grade record upserted
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/GradeRecord' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  resolveStudentContext,
  validate({ body: addGradeSchema }),
  controller.addOrUpdateGrade,
);

/**
 * @openapi
 * /grades/{id}:
 *   patch:
 *     tags: [Grades]
 *     summary: Update a grade record (same upsert as POST /grades)
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Grade record upserted
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/GradeRecord' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch(
  "/:id",
  resolveStudentContext,
  validate({ body: updateGradeSchema }),
  controller.addOrUpdateGrade,
);

/**
 * @openapi
 * /grades/{id}:
 *   delete:
 *     tags: [Grades]
 *     summary: Delete one of the current student's grade records
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Grade record deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", resolveStudentContext, controller.deleteGrade);

export default router;
