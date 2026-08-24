import { Router } from "express";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/authenticate";
import { detectBotApiKey } from "../middleware/requireBotApiKey";
import * as authController from "../controllers/authController";
import {
  registerSchema,
  verifyPhoneSchema,
  verifyEmailSchema,
  loginSchema,
} from "../validators/authValidators";

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new student
 *     description: >
 *       Creates the student and sends an email OTP. Phone is not verified as
 *       part of web onboarding — the exception is a request carrying a valid
 *       `x-api-key` (the bot), where the phone is auto-verified since the
 *       WhatsApp sender ID already proves the student owns that number.
 *     security: [{ botServiceKey: [] }, {}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, email, password, matricNumber, university, department, level]
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string, example: "+2348012345678" }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 6 }
 *               matricNumber: { type: string }
 *               university: { type: string }
 *               department: { type: string }
 *               level: { type: string, example: "300" }
 *     responses:
 *       201:
 *         description: Registered; verification codes sent
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       409: { $ref: '#/components/responses/BadRequest' }
 */
router.post(
  "/register",
  detectBotApiKey,
  validate({ body: registerSchema }),
  authController.register
);

/**
 * @openapi
 * /auth/verify-phone:
 *   post:
 *     tags: [Auth]
 *     summary: Verify a student's phone with the OTP sent at registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+2348012345678" }
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Phone verified
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post("/verify-phone", validate({ body: verifyPhoneSchema }), authController.verifyPhone);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify a student's email with the OTP sent at registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessMessage'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Student' } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post("/verify-email", validate({ body: verifyEmailSchema }), authController.verifyEmail);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password and issue a session token (web portal, ambassadors only)
 *     description: >
 *       Requires a fully verified account. Rejects with 403 if the student isn't an
 *       ambassador — the web portal login is ambassador-only.
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
 *                         student: { $ref: '#/components/schemas/Student' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post("/login", validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke all of the student's sessions
 *     security: [{ studentSession: [] }]
 *     responses:
 *       200: { description: Logged out, content: { application/json: { schema: { $ref: '#/components/schemas/SuccessMessage' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post("/logout", authenticate, authController.logout);

export default router;
