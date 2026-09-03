import { Router } from "express";
import { validate } from "../middleware/validate";
import {
  requireAdminAuth,
  requireSuperAdmin,
} from "../middleware/requireAdminAuth";
import {
  createAdminSchema,
  updateAdminSchema,
} from "../validators/adminValidators";
import * as adminController from "../controllers/adminController";

const router = Router();

router.use(requireAdminAuth, requireSuperAdmin);

/**
 * @openapi
 * /admins:
 *   get:
 *     tags: [Admins]
 *     summary: List all admins
 *     security: [{ adminSession: [] }]
 *     responses:
 *       200:
 *         description: Admin list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { type: array, items: { $ref: '#/components/schemas/Admin' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get("/", adminController.getAdmins);

/**
 * @openapi
 * /admins:
 *   post:
 *     tags: [Admins]
 *     summary: Create an admin (super admin only)
 *     security: [{ adminSession: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               role: { type: string, enum: [super_admin, admin] }
 *     responses:
 *       201:
 *         description: Admin created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Admin' } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/",
  validate({ body: createAdminSchema }),
  adminController.addAdmin,
);

/**
 * @openapi
 * /admins/{id}:
 *   patch:
 *     tags: [Admins]
 *     summary: Update an admin's role, active status, or password (super admin only)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [super_admin, admin] }
 *               isActive: { type: boolean }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Admin updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Admin' } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/:id",
  validate({ body: updateAdminSchema }),
  adminController.editAdmin,
);

/**
 * @openapi
 * /admins/{id}:
 *   delete:
 *     tags: [Admins]
 *     summary: Delete an admin (super admin only, cannot delete self)
 *     security: [{ adminSession: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Admin deleted, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete("/:id", adminController.removeAdmin);

export default router;
