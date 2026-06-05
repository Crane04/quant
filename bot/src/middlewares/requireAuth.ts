import { NextFunction, Request, Response } from "express";
import { SafeAdmin, findAdminById } from "../services/adminService";
import { verifyAdminToken } from "../services/authService";
import { sendError } from "../utils/apiResponse";

export type AuthenticatedRequest = Request & {
  admin?: SafeAdmin;
};

const getBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) return null;

  return header.slice("Bearer ".length);
};

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const payload = verifyAdminToken(token);
    const admin = await findAdminById(payload.adminId);

    if (!admin || !admin.isActive) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    next();
  } catch {
    sendError(res, "Unauthorized", 401);
  }
};

export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.admin?.role !== "super_admin") {
    sendError(res, "Forbidden", 403);
    return;
  }

  next();
};
