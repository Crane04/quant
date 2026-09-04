import { z } from "zod";

const phone = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Phone must be in E.164 format, e.g. +2348012345678",
  );
const otpCode = z.string().length(6).regex(/^\d+$/, "Code must be 6 digits");

export const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone,
  email: z.string().email(),
  password: z.string().min(6).max(100),
  matricNumber: z.string().min(3).max(30),
  university: z.string().min(2).max(150),
  department: z.string().min(2).max(150),
  level: z.string().min(1).max(10),
  referredByCode: z.string().min(1).max(50).optional(),
});

export const verifyPhoneSchema = z.object({
  phone,
  code: otpCode,
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: otpCode,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: otpCode,
  newPassword: z.string().min(6).max(100),
});
