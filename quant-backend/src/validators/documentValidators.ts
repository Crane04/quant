import { z } from "zod";

export const createDocumentSchema = z
  .object({
    title: z.string().min(2).max(200),
    courseId: z.string().optional(),
    courseCode: z.string().min(1).optional(),
    courseTitle: z.string().min(1).optional(),
    university: z.string().min(1).optional(),
    department: z.string().min(1).optional(),
    level: z.string().min(1).optional(),
    session: z.string().min(1).optional(),
    semester: z.enum(["first", "second"]).optional(),
    creditUnits: z.coerce.number().int().positive().optional(),
    tags: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.courseId) ||
      Boolean(
        data.courseCode &&
          data.courseTitle &&
          data.university &&
          data.department &&
          data.level &&
          data.session &&
          data.semester &&
          data.creditUnits !== undefined
      ),
    {
      message:
        "Provide courseId, or courseCode/courseTitle/university/department/level/session/semester/creditUnits to create a new course",
    }
  );

export const updateDocumentSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  tags: z.string().optional(),
  courseId: z.string().optional(),
});
