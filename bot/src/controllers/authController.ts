import { Request, Response } from "express";
import { findAdminByEmail } from "../services/adminService";
import { signAdminToken } from "../services/authService";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { verifyPassword } from "../services/adminService";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendError(res, "Email and password are required", 400);
      return;
    }

    const admin = await findAdminByEmail(email);

    if (!admin || !admin.isActive) {
      sendError(res, "Invalid email or password", 401);
      return;
    }

    const isValidPassword = await verifyPassword(password, admin.passwordHash);

    if (!isValidPassword) {
      sendError(res, "Invalid email or password", 401);
      return;
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    sendSuccess(res, signAdminToken(admin));
  } catch {
    sendError(res, "Login failed");
  }
};

export const getCurrentAdmin = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, { admin: (req as Request & { admin?: unknown }).admin });
};
