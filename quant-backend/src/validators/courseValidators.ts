import { z } from "zod";

export const createCourseSchema = z.object({
  code: z.string().min(2).max(20),
  title: z.string().min(2).max(200),
  university: z.string().min(2).max(150),
  department: z.string().min(2).max(150),
  level: z.string().min(1).max(10),
  creditUnits: z.number().int().min(1).max(10),
  session: z.string().min(4).max(20),
  semester: z.enum(["first", "second"]),
});

export const updateCourseSchema = createCourseSchema.partial();

export const listCoursesQuerySchema = z.object({
  university: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
  session: z.string().optional(),
  semester: z.enum(["first", "second"]).optional(),
  search: z.string().optional(),
});

export const enrollSchema = z.object({
  phone: z.string().optional(), // used by bot-service calls
  courseIds: z.array(z.string()).min(1),
  session: z.string().min(4).max(20),
  semester: z.enum(["first", "second"]),
});
