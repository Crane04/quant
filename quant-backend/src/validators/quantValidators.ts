import { z } from "zod";

const rate = z.number().min(0).max(100_000);

export const updatePricingSchema = z
  .object({
    billingEnabled: z.boolean(),
    perMessage: rate,
    per100Chars: rate,
    per1kInputTokens: rate,
    per1kOutputTokens: rate,
    maxPerMessage: rate,
  })
  .partial();

const TRANSACTION_TYPES = [
  "topup",
  "chat_message",
  "reward_conversion",
  "signup_bonus",
  "admin_adjustment",
] as const;

export const listTransactionsQuerySchema = z.object({
  // Comma-separated, e.g. "topup,admin_adjustment"
  type: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined))
    .pipe(z.array(z.enum(TRANSACTION_TYPES)).optional()),
  studentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const adjustQuantsSchema = z.object({
  amount: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((n) => n !== 0, "Amount can't be 0"),
  reason: z.string().trim().min(1).max(200),
});
