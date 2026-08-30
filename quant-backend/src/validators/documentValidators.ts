import { z } from "zod";

export const createDocumentSchema = z
  .object({
    title: z.string().min(2).max(200),
    category: z.enum(["lecture_note", "exam_summary", "past_question", "other"]),
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

export const reviewDocumentSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().min(2).max(500).optional(),
});

export const listDocumentsQuerySchema = z.object({
  courseCode: z.string().optional(),
  level: z.string().optional(),
  department: z.string().optional(),
  semester: z.enum(["first", "second"]).optional(),
  search: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  uploadedBy: z.string().optional(),
});
