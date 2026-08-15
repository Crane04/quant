import { z } from "zod";

export const addGradeSchema = z.object({
  phone: z.string().optional(), // bot-service calls identify the student by phone
  course: z.string().min(1),
  session: z.string().min(4).max(20),
  semester: z.enum(["first", "second"]),
  creditUnits: z.number().int().min(1).max(10),
  grade: z.enum(["A", "B", "C", "D", "E", "F"]),
});

export const updateGradeSchema = addGradeSchema.partial();
