import { z } from "zod";

export const updateMeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  university: z.string().min(2).max(150).optional(),
  department: z.string().min(2).max(150).optional(),
  level: z.string().min(1).max(10).optional(),
});

export const listStudentsQuerySchema = z.object({
  search: z.string().optional(),
  university: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
});
