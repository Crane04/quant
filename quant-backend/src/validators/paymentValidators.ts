import { z } from "zod";

// The query string Flutterwave appends to the checkout redirect — the website
// forwards it as-is.
export const verifyPaymentQuerySchema = z.object({
  tx_ref: z.string().trim().min(1).max(100),
  transaction_id: z.coerce.number().int().positive().optional(),
  status: z.string().trim().max(30).optional(),
});
