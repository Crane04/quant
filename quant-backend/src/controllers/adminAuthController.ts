import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { findAdminByEmail, toSafeAdmin } from "../services/adminAuthService";
import { verifyPassword } from "../utils/password";
import { createSession } from "../utils/session";
import { parseDuration } from "../utils/duration";
import { env } from "../config/env";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const admin = await findAdminByEmail(email);
  if (!admin || !admin.isActive) throw ApiError.unauthorized("Invalid email or password");

  const isValidPassword = await verifyPassword(password, admin.passwordHash);
  if (!isValidPassword) throw ApiError.unauthorized("Invalid email or password");

  admin.lastLoginAt = new Date();
  await admin.save();

  const safeAdmin = toSafeAdmin(admin);
  const token = await createSession("Admin", safeAdmin.id, parseDuration(env.ADMIN_SESSION_EXPIRES_IN));

  sendSuccess(res, { token, admin: safeAdmin });
});

export const getCurrentAdmin = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, req.admin);
});
