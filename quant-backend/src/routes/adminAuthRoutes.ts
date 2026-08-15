import { Router } from "express";
import { validate } from "../middleware/validate";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import { adminLoginSchema } from "../validators/adminValidators";
import * as adminAuthController from "../controllers/adminAuthController";

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin login (email + password)
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
 *     responses:
 *       200:
 *         description: Session token issued
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token: { type: string }
 *                         admin: { $ref: '#/components/schemas/Admin' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post("/login", validate({ body: adminLoginSchema }), adminAuthController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: Get the currently logged-in admin
 *     security: [{ adminSession: [] }]
 *     responses:
 *       200:
 *         description: Current admin
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Admin' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/me", requireAdminAuth, adminAuthController.getCurrentAdmin);

export default router;
