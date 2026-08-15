import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import {
  createAdmin,
  deleteAdmin,
  listAdmins,
  updateAdmin,
  updateAdminPassword,
} from "../services/adminAuthService";
import { AdminRole } from "../models/Admin";

export const getAdmins = asyncHandler(async (_req: Request, res: Response) => {
  const admins = await listAdmins();
  sendSuccess(res, admins);
});

export const addAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role } = req.body as { email: string; password: string; role?: AdminRole };
  const admin = await createAdmin({ email, password, role });
  sendSuccess(res, admin, undefined, 201);
});

export const editAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { role, isActive, password } = req.body as {
    role?: AdminRole;
    isActive?: boolean;
    password?: string;
  };
  const isSelf = req.params.id === req.admin?.id;
  const updates: Partial<{ role: AdminRole; isActive: boolean }> = {};

  if (role !== undefined) {
    if (isSelf && role !== "super_admin") {
      throw ApiError.badRequest("You cannot remove your own super admin role");
    }
    updates.role = role;
  }

  if (isActive !== undefined) {
    if (isSelf && !isActive) {
      throw ApiError.badRequest("You cannot deactivate your own account");
    }
    updates.isActive = isActive;
  }

  let admin = await updateAdmin(req.params.id, updates);
  if (!admin) throw ApiError.notFound("Admin not found");

  if (password) {
    admin = await updateAdminPassword(req.params.id, password);
  }

  sendSuccess(res, admin);
});

export const removeAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.admin?.id) {
    throw ApiError.badRequest("You cannot delete your own account");
  }

  const deleted = await deleteAdmin(req.params.id);
  if (!deleted) throw ApiError.notFound("Admin not found");

  sendSuccess(res, undefined, "Admin deleted");
});
