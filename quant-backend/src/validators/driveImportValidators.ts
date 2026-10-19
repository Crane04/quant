import { z } from "zod";

export const createDriveImportSchema = z.object({
  url: z.string().url().max(500),
  category: z
    .enum(["auto", "lecture_note", "exam_summary", "past_question", "other"])
    .default("auto"),
});

export const driveImportIdSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid import id"),
});
