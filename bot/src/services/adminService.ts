import bcrypt from "bcryptjs";
import { Admin, AdminRole, IAdmin } from "../models/Admin";

export type SafeAdmin = {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type CreateAdminInput = {
  email: string;
  password: string;
  role?: AdminRole;
};

const DEFAULT_ADMIN_EMAIL = "admin@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "xyz123";
const PASSWORD_SALT_ROUNDS = 12;

export const toSafeAdmin = (admin: IAdmin): SafeAdmin => {
  return {
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
};

export const verifyPassword = async (
  password: string,
  passwordHash: string
): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};

export const ensureDefaultAdmin = async (): Promise<void> => {
  const email = process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

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

  console.info(`[info] Default super admin created {"email":"${email}"}`);
};

export const findAdminByEmail = async (email: string): Promise<IAdmin | null> => {
  return Admin.findOne({ email: email.toLowerCase().trim() });
};

export const findAdminById = async (id: string): Promise<IAdmin | null> => {
  return Admin.findById(id);
};

export const listAdmins = async (): Promise<SafeAdmin[]> => {
  const admins = await Admin.find().sort({ createdAt: -1 });
  return admins.map(toSafeAdmin);
};

export const createAdmin = async ({
  email,
  password,
  role = "admin",
}: CreateAdminInput): Promise<SafeAdmin> => {
  const admin = await Admin.create({
    email,
    passwordHash: await hashPassword(password),
    role,
    isActive: true,
  });

  return toSafeAdmin(admin);
};

export const updateAdmin = async (
  id: string,
  updates: Partial<Pick<IAdmin, "role" | "isActive">>
): Promise<SafeAdmin | null> => {
  const admin = await Admin.findByIdAndUpdate(id, updates, { new: true });
  return admin ? toSafeAdmin(admin) : null;
};

export const updateAdminPassword = async (
  id: string,
  password: string
): Promise<SafeAdmin | null> => {
  const admin = await Admin.findById(id);

  if (!admin) return null;

  admin.passwordHash = await hashPassword(password);
  await admin.save();

  return toSafeAdmin(admin);
};

export const deleteAdmin = async (id: string): Promise<boolean> => {
  const result = await Admin.findByIdAndDelete(id);
  return Boolean(result);
};
