import { z } from "zod";

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM format");

export const createSlotSchema = z.object({
  course: z.string().min(1),
  dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  startTime: timeString,
  endTime: timeString,
  venue: z.string().max(200).optional(),
});

export const updateSlotSchema = createSlotSchema.partial();

export const myTimetableQuerySchema = z.object({
  session: z.string().min(4).max(20),
  semester: z.enum(["first", "second"]),
});
