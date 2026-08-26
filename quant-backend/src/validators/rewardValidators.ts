import { z } from "zod";

export const redeemRewardSchema = z.object({
  size: z.string().min(1).max(10).optional(),
});
