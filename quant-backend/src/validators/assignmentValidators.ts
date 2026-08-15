import { z } from "zod";

export const createAssignmentSchema = z.object({
  course: z.string().min(1),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.coerce.date(),
  attachmentUrl: z.string().url().optional(),
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

export const myAssignmentsQuerySchema = z.object({
  session: z.string().min(4).max(20),
  semester: z.enum(["first", "second"]),
  status: z.enum(["pending", "completed", "all"]).optional(),
});
