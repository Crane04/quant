import { Router } from "express";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { resolveStudentContext } from "../middleware/resolveStudentContext";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import * as controller from "../controllers/documentController";
import { createDocumentSchema, updateDocumentSchema } from "../validators/documentValidators";
import { myTimetableQuerySchema } from "../validators/timetableValidators";

const router = Router();

/**
 * @openapi
 * /documents/mine:
 *   get:
 *     tags: [Documents]
 *     summary: List documents across the student's enrolled courses
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     parameters:
 *       - { name: session, in: query, required: true, schema: { type: string } }
 *       - { name: semester, in: query, required: true, schema: { type: string, enum: [first, second] } }
 *     responses:
 *       200:
 *         description: Documents
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/DocumentFile' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/mine", resolveStudentContext, validate({ query: myTimetableQuerySchema }), controller.getMyDocuments);

/**
 * @openapi
 * /documents/mine:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document as a student (ambassadors only)
 *     description: >
 *       Requires the resolved student to have isAmbassador set, regardless of whether
 *       the request came in via a student session or the bot-service key.
 *     security: [{ studentSession: [] }, { botServiceKey: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, title]
 *             properties:
 *               pdf: { type: string, format: binary }
 *               title: { type: string }
 *               courseId: { type: string, description: "Existing course id" }
 *               courseCode: { type: string, description: "Or create a new course inline with these fields" }
 *               courseTitle: { type: string }
 *               university: { type: string }
 *               department: { type: string }
 *               level: { type: string }
 *               session: { type: string }
 *               semester: { type: string, enum: [first, second] }
 *               creditUnits: { type: integer }
 *               tags: { type: string, description: "comma-separated" }
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/DocumentFile' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/mine",
  resolveStudentContext,
  upload.single("pdf"),
  validate({ body: createDocumentSchema }),
  controller.createMyDocument
);

/**
 * @openapi
 * /documents/course/{courseId}:
 *   get:
 *     tags: [Documents]
 *     summary: List a course's documents
 *     parameters:
 *       - { name: courseId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Documents
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/DocumentFile' } } }
 */
router.get("/course/:courseId", controller.getCourseDocuments);

/**
 * @openapi
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: List/search all documents (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: courseCode, in: query, schema: { type: string } }
 *       - { name: level, in: query, schema: { type: string } }
 *       - { name: department, in: query, schema: { type: string } }
 *       - { name: semester, in: query, schema: { type: string, enum: [first, second] } }
 *       - { name: search, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Documents
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/DocumentFile' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/", requireAdminAuth, controller.listDocuments);

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Get a document by id (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Document
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/DocumentFile' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get("/:id", requireAdminAuth, controller.getDocument);

/**
 * @openapi
 * /documents:
 *   post:
 *     tags: [Documents]
 *     summary: Upload a document as an admin
 *     security: [{ adminSession: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, title]
 *             properties:
 *               pdf: { type: string, format: binary }
 *               title: { type: string }
 *               courseId: { type: string }
 *               courseCode: { type: string }
 *               courseTitle: { type: string }
 *               university: { type: string }
 *               department: { type: string }
 *               level: { type: string }
 *               session: { type: string }
 *               semester: { type: string, enum: [first, second] }
 *               creditUnits: { type: integer }
 *               tags: { type: string }
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/DocumentFile' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  requireAdminAuth,
  upload.single("pdf"),
  validate({ body: createDocumentSchema }),
  controller.createDocument
);

/**
 * @openapi
 * /documents/{id}:
 *   patch:
 *     tags: [Documents]
 *     summary: Update a document's title/tags/course (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               tags: { type: string, description: "comma-separated" }
 *               courseId: { type: string }
 *     responses:
 *       200:
 *         description: Document updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/DocumentFile' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  requireAdminAuth,
  validate({ body: updateDocumentSchema }),
  controller.updateDocument
);

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Delete a document, including its stored file (admin)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Document deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", requireAdminAuth, controller.deleteDocument);

export default router;
