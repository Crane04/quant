import { Router } from "express";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { validate } from "../middleware/validate";
import * as controller from "../controllers/driveImportController";
import {
  createDriveImportSchema,
  driveImportIdSchema,
} from "../validators/driveImportValidators";

const router = Router();

router.use(requireAdminAuth);

/**
 * @openapi
 * /drive-imports:
 *   post:
 *     tags: [Drive Imports]
 *     summary: Import every document in a Google Drive link
 *     description: >
 *       Lists the files under the link (subfolders included) and imports them in the
 *       background through the normal upload pipeline. Each file's course is read from a
 *       course code in its name (falling back to its folder path), e.g. "MEE301 Week 2.pdf".
 *       Codes the catalogue doesn't have get a new LASU course (title = the code; level,
 *       semester, department and credit units inferred), listed in createdCourses.
 *       Files already in the library (same Drive file, or same file bytes) are skipped.
 *       The link must be shared as "Anyone with the link". Poll GET /drive-imports/{id}
 *       for progress.
 *     security: [{ adminSession: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url: { type: string, example: "https://drive.google.com/drive/folders/1AbC..." }
 *               category:
 *                 type: string
 *                 enum: [auto, lecture_note, exam_summary, past_question, other]
 *                 default: auto
 *                 description: "auto = from each file name (\"past questions\" -> past_question, \"summary\" -> exam_summary, else lecture_note)"
 *     responses:
 *       202:
 *         description: Import started
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/DriveImport' } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   get:
 *     tags: [Drive Imports]
 *     summary: List the 20 most recent imports (without per-file items)
 *     security: [{ adminSession: [] }]
 *     responses:
 *       200:
 *         description: Imports
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/DriveImport' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post(
  "/",
  validate({ body: createDriveImportSchema }),
  controller.createDriveImport,
);
router.get("/", controller.listDriveImports);

/**
 * @openapi
 * /drive-imports/{id}:
 *   get:
 *     tags: [Drive Imports]
 *     summary: One import with its per-file results
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Import
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/DriveImport' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/:id",
  validate({ params: driveImportIdSchema }),
  controller.getDriveImport,
);

export default router;
