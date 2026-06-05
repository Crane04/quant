import { Request, Response } from "express";
import {
  createAdmin,
  deleteAdmin,
  listAdmins,
  updateAdmin,
  updateAdminPassword,
} from "../services/adminService";
import { AuthenticatedRequest } from "../middlewares/requireAuth";
import { sendError, sendSuccess } from "../utils/apiResponse";

const isValidRole = (role: unknown): role is "super_admin" | "admin" => {
  return role === "super_admin" || role === "admin";
};

export const getAdmins = async (_req: Request, res: Response): Promise<void> => {
  try {
    const admins = await listAdmins();
    sendSuccess(res, { admins });
  } catch {
    sendError(res, "Failed to fetch admins");
  }
};

export const addAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      sendError(res, "Email and password are required", 400);
      return;
    }

    if (role && !isValidRole(role)) {
      sendError(res, "Invalid admin role", 400);
      return;
    }

    const admin = await createAdmin({ email, password, role });
    sendSuccess(res, { admin }, 201);
  } catch (err) {
    const message = err instanceof Error && err.message.includes("duplicate key")
      ? "Admin already exists"
      : "Failed to create admin";
    sendError(res, message, message === "Admin already exists" ? 409 : 500);
  }
};

export const editAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { role, isActive, password } = req.body;
    const updates: { role?: "super_admin" | "admin"; isActive?: boolean } = {};
    const isSelf = req.params.id === req.admin?.id;

    if (role !== undefined) {
      if (!isValidRole(role)) {
        sendError(res, "Invalid admin role", 400);
        return;
      }
      if (isSelf && role !== "super_admin") {
        sendError(res, "You cannot remove your own super admin role", 400);
        return;
      }
      updates.role = role;
    }

    if (isActive !== undefined) {
      if (isSelf && !Boolean(isActive)) {
        sendError(res, "You cannot deactivate your own account", 400);
        return;
      }
      updates.isActive = Boolean(isActive);
    }

    let admin = await updateAdmin(req.params.id, updates);

    if (!admin) {
      sendError(res, "Admin not found", 404);
      return;
    }

    if (password) {
      admin = await updateAdminPassword(req.params.id, password);
    }

    sendSuccess(res, { admin });
  } catch {
    sendError(res, "Failed to update admin");
  }
};

export const removeAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.params.id === req.admin?.id) {
      sendError(res, "You cannot delete your own account", 400);
      return;
    }

    const deleted = await deleteAdmin(req.params.id);

    if (!deleted) {
      sendError(res, "Admin not found", 404);
      return;
    }

    sendSuccess(res, { message: "Admin deleted" });
  } catch {
    sendError(res, "Failed to delete admin");
  }
};
