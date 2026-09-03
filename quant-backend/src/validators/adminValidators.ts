import { z } from "zod";

const role = z.enum(["super_admin", "admin"]);

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: role.optional(),
});

export const updateAdminSchema = z
  .object({
    role: role.optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No updates provided",
  });
