import { z } from "zod";

export const createLectureSummarySchema = z.object({
  course: z.string().min(1),
  title: z.string().min(2).max(200),
  content: z.string().min(1).max(20000),
  sourceDocument: z.string().optional(),
});

export const updateLectureSummarySchema = createLectureSummarySchema.partial();
