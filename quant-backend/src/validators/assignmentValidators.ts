import { z } from "zod";

export const myAssignmentsQuerySchema = z.object({
  status: z.enum(["pending", "completed", "all"]).optional(),
});
