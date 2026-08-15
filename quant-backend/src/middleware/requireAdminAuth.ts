import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { findSession } from "../utils/session";
import { findAdminById, toSafeAdmin } from "../services/adminAuthService";

export async function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = header.slice("Bearer ".length);
  const session = await findSession("Admin", token);
  if (!session) return next(ApiError.unauthorized("Invalid or expired admin session"));

  const admin = await findAdminById(session.actorId.toString());
  if (!admin || !admin.isActive) {
    return next(ApiError.unauthorized("Invalid or expired admin session"));
  }

  req.admin = toSafeAdmin(admin);
  next();
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.admin?.role !== "super_admin") {
    return next(ApiError.forbidden("Super admin access required"));
  }
  next();
}
