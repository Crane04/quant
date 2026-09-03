import { Router } from "express";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { validate } from "../middleware/validate";
import {
  listStudentsQuerySchema,
  updateMeSchema,
  adminUpdateStudentSchema,
} from "../validators/studentValidators";
import * as studentController from "../controllers/studentController";

const router = Router();

/**
 * @openapi
 * /students/me:
 *   get:
 *     tags: [Students]
 *     summary: Get the current student's profile
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     responses:
 *       200:
 *         description: Student profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/me", resolveStudentContext, studentController.getMe);

/**
 * @openapi
 * /students/me:
 *   patch:
 *     tags: [Students]
 *     summary: Update the current student's profile
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               university: { type: string }
 *               department: { type: string }
 *               level: { type: string }
 *     responses:
 *       200:
 *         description: Updated profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/me",
  resolveStudentContext,
  validate({ body: updateMeSchema }),
  studentController.updateMe,
);

/**
 * @openapi
 * /students:
 *   get:
 *     tags: [Students]
 *     summary: List students (admin dashboard directory)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: university, in: query, schema: { type: string } }
 *       - { name: department, in: query, schema: { type: string } }
 *       - { name: level, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Student list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Student' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  "/",
  requireAdminAuth,
  validate({ query: listStudentsQuerySchema }),
  studentController.listStudents,
);

/**
 * @openapi
 * /students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get a student by id (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Student
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/:id", requireAdminAuth, studentController.getStudentById);

/**
 * @openapi
 * /students/{id}:
 *   patch:
 *     tags: [Students]
 *     summary: Update a student by id (admin) — e.g. to grant/revoke ambassador status
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               university: { type: string }
 *               department: { type: string }
 *               level: { type: string }
 *               isAmbassador: { type: boolean, description: "Grants web portal login + document upload rights" }
 *               isVerifiedContributor: { type: boolean, description: "Quality-review flag; unlocks the Verified Contributor badge" }
 *     responses:
 *       200:
 *         description: Updated student
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  requireAdminAuth,
  validate({ body: adminUpdateStudentSchema }),
  studentController.updateStudentById,
);

/**
 * @openapi
 * /students/{id}:
 *   delete:
 *     tags: [Students]
 *     summary: Delete a student (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Student deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", requireAdminAuth, studentController.deleteStudentById);

export default router;
