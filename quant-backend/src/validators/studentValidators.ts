import { z } from "zod";

export const updateMeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  university: z.string().min(2).max(150).optional(),
  department: z.string().min(2).max(150).optional(),
  level: z.string().min(1).max(10).optional(),
});

// Admin-only fields layered on top of the self-service update — isAmbassador/
// isVerifiedContributor must never be settable via a student's own PATCH /students/me.
export const adminUpdateStudentSchema = updateMeSchema.extend({
  isAmbassador: z.boolean().optional(),
  isVerifiedContributor: z.boolean().optional(),
});

export const listStudentsQuerySchema = z.object({
  search: z.string().optional(),
  university: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
});
