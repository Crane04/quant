import jwt from "jsonwebtoken";
import { IAdmin } from "../models/Admin";
import { SafeAdmin, toSafeAdmin } from "./adminService";

export type AuthPayload = {
  adminId: string;
  email: string;
  role: string;
};

export type AuthResult = {
  token: string;
  admin: SafeAdmin;
};

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET || process.env.INTERNAL_API_KEY;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

export const signAdminToken = (admin: IAdmin): AuthResult => {
  const payload: AuthPayload = {
    adminId: admin._id.toString(),
    email: admin.email,
    role: admin.role,
  };

  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });

  return {
    token,
    admin: toSafeAdmin(admin),
  };
};

export const verifyAdminToken = (token: string): AuthPayload => {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
};
