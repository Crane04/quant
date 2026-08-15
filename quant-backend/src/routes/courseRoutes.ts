import { Router } from "express";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { validate } from "../middleware/validate";
import * as courseController from "../controllers/courseController";
import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesQuerySchema,
  enrollSchema,
} from "../validators/courseValidators";

const router = Router();

/**
 * @openapi
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: List/search the course catalogue
 *     parameters:
 *       - { name: university, in: query, schema: { type: string } }
 *       - { name: department, in: query, schema: { type: string } }
 *       - { name: level, in: query, schema: { type: string } }
 *       - { name: session, in: query, schema: { type: string } }
 *       - { name: semester, in: query, schema: { type: string, enum: [first, second] } }
 *       - { name: search, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Course list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Course' } } }
 */
router.get("/", validate({ query: listCoursesQuerySchema }), courseController.listCourses);

/**
 * @openapi
 * /courses/mine:
 *   get:
 *     tags: [Courses]
 *     summary: List the current student's enrolled courses
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: session, in: query, schema: { type: string } }
 *       - { name: semester, in: query, schema: { type: string, enum: [first, second] } }
 *     responses:
 *       200:
 *         description: Enrollment list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/StudentCourse' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine", resolveStudentContext, courseController.getMyCourses);

/**
 * @openapi
 * /courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by id
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Course
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Course' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/:id", courseController.getCourse);

/**
 * @openapi
 * /courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course (admin — catalogue data)
 *     security: [{ adminSession: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, title, university, department, level, creditUnits, session, semester]
 *             properties:
 *               code: { type: string, example: "MEE 305" }
 *               title: { type: string }
 *               university: { type: string }
 *               department: { type: string }
 *               level: { type: string }
 *               creditUnits: { type: integer }
 *               session: { type: string, example: "2024/2025" }
 *               semester: { type: string, enum: [first, second] }
 *     responses:
 *       201:
 *         description: Course created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Course' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post("/", requireAdminAuth, validate({ body: createCourseSchema }), courseController.createCourse);

/**
 * @openapi
 * /courses/{id}:
 *   patch:
 *     tags: [Courses]
 *     summary: Update a course (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Course updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Course' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  requireAdminAuth,
  validate({ body: updateCourseSchema }),
  courseController.updateCourse
);

/**
 * @openapi
 * /courses/{id}:
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Course deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", requireAdminAuth, courseController.deleteCourse);

/**
 * @openapi
 * /courses/enroll:
 *   post:
 *     tags: [Courses]
 *     summary: Enroll the current student in one or more courses for a session/semester
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseIds, session, semester]
 *             properties:
 *               phone: { type: string, description: "bot-service calls only" }
 *               courseIds: { type: array, items: { type: string } }
 *               session: { type: string, example: "2024/2025" }
 *               semester: { type: string, enum: [first, second] }
 *     responses:
 *       201:
 *         description: Enrollments created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/StudentCourse' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/enroll",
  resolveStudentContext,
  validate({ body: enrollSchema }),
  courseController.enrollInCourses
);

export default router;
