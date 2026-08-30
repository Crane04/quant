import { z } from "zod";

export const createAnnouncementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lecture_alert"),
    courseId: z.string().min(1),
    timetableSlotId: z.string().min(1).optional(),
    title: z.string().min(2).max(200).optional(),
    message: z.string().min(2).max(1000),
  }),
  z.object({
    type: z.literal("announcement"),
    title: z.string().min(2).max(200),
    message: z.string().min(2).max(1000),
  }),
]);

export const myAnnouncementsQuerySchema = z.object({
  type: z.enum(["lecture_alert", "announcement"]).optional(),
});

export const listAnnouncementsQuerySchema = z.object({
  type: z.enum(["lecture_alert", "announcement"]).optional(),
  university: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
});
