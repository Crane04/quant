import { Admin, AdminDoc, AdminRole } from "../models/Admin";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { hashPassword, verifyPassword } from "../utils/password";

export type SafeAdmin = {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export function toSafeAdmin(admin: AdminDoc): SafeAdmin {
  return {
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role as AdminRole,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt ?? undefined,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

export async function ensureDefaultAdmin(): Promise<void> {
  const email = env.DEFAULT_ADMIN_EMAIL;
  const password = env.DEFAULT_ADMIN_PASSWORD;

  const existing = await Admin.findOne({ email });

  if (existing) {
    if (existing.role !== "super_admin" || !existing.isActive) {
      existing.role = "super_admin";
      existing.isActive = true;
      await existing.save();
    }
    return;
  }

  await Admin.create({
    email,
    passwordHash: await hashPassword(password),
    role: "super_admin",
    isActive: true,
  });

  logger.info("Default super admin created", { email });
}

export function findAdminByEmail(email: string) {
  return Admin.findOne({ email: email.toLowerCase().trim() });
}

export function findAdminById(id: string) {
  return Admin.findById(id);
}

export async function listAdmins(): Promise<SafeAdmin[]> {
  const admins = await Admin.find().sort({ createdAt: -1 });
  return admins.map(toSafeAdmin);
}

export async function createAdmin({
  email,
  password,
  role = "admin",
}: {
  email: string;
  password: string;
  role?: AdminRole;
}): Promise<SafeAdmin> {
  const admin = await Admin.create({
    email,
    passwordHash: await hashPassword(password),
    role,
    isActive: true,
  });

  return toSafeAdmin(admin);
}

export async function updateAdmin(
  id: string,
  updates: Partial<{ role: AdminRole; isActive: boolean }>
): Promise<SafeAdmin | null> {
  const admin = await Admin.findByIdAndUpdate(id, updates, { new: true });
  return admin ? toSafeAdmin(admin) : null;
}

export async function updateAdminPassword(id: string, password: string): Promise<SafeAdmin | null> {
  const admin = await Admin.findById(id);
  if (!admin) return null;

  admin.passwordHash = await hashPassword(password);
  await admin.save();

  return toSafeAdmin(admin);
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const result = await Admin.findByIdAndDelete(id);
  return Boolean(result);
}
