import crypto from "crypto";
import { Types } from "mongoose";
import { Student, StudentDoc } from "../models/Student";
import { Reward } from "../models/Reward";
import { Payment } from "../models/Payment";
import { QuantTransaction } from "../models/QuantTransaction";
import { QuantPricing, QuantPricingDoc } from "../models/QuantPricing";
import { GroqUsage } from "./groqAgentService";
import { sendWhatsAppButtons, sendWhatsAppCtaUrl, sendWhatsAppText } from "./waService";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/ApiError";

// ₦1 = 1 quant. Our own conversion — what a message costs in quants is set by
// admins (QuantPricing), not passed straight through from Groq's bill.
export const QUANTS_PER_NAIRA = 1;

// The top-up buttons offered on WhatsApp (max 3 — a reply-buttons limit).
export const TOPUP_AMOUNTS_NGN = [500, 1000, 2000] as const;

const FLUTTERWAVE_API = "https://api.flutterwave.com/v3";

export const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString("en-NG")}`;

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export type Pricing = Pick<
  QuantPricingDoc,
  | "billingEnabled"
  | "perMessage"
  | "per100Chars"
  | "per1kInputTokens"
  | "per1kOutputTokens"
  | "maxPerMessage"
>;

// Read on every message, so cached briefly; updatePricing refreshes it on
// this instance immediately, other instances within the TTL.
const PRICING_CACHE_MS = 30_000;
let pricingCache: { value: Pricing; at: number } | null = null;

export async function getPricing(): Promise<Pricing> {
  if (pricingCache && Date.now() - pricingCache.at < PRICING_CACHE_MS) {
    return pricingCache.value;
  }
  const doc = await QuantPricing.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  pricingCache = { value: doc, at: Date.now() };
  return doc;
}

export async function updatePricing(
  updates: Partial<Pricing>,
  adminId?: string,
): Promise<Pricing> {
  const doc = await QuantPricing.findOneAndUpdate(
    { key: "default" },
    { ...updates, updatedBy: adminId },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean();
  pricingCache = { value: doc, at: Date.now() };
  return doc;
}

export type CostBreakdown = {
  perMessage: number;
  length: number;
  aiTokens: number;
  total: number;
};

/** The formula documented on QuantPricing. Usage omitted = the pre-reply part only. */
export function computeMessageCost(
  pricing: Pricing,
  inputChars: number,
  usage?: GroqUsage,
): CostBreakdown {
  const length = (inputChars / 100) * pricing.per100Chars;
  const aiTokens = usage
    ? (usage.promptTokens / 1000) * pricing.per1kInputTokens +
      (usage.completionTokens / 1000) * pricing.per1kOutputTokens
    : 0;

  let total = Math.ceil(pricing.perMessage + length + aiTokens);
  if (pricing.maxPerMessage > 0) total = Math.min(total, pricing.maxPerMessage);

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    perMessage: pricing.perMessage,
    length: round(length),
    aiTokens: round(aiTokens),
    total,
  };
}

/**
 * Pre-reply gate. The AI-token part is only known after the reply, so this
 * checks the student can cover the part that's known up front (at least 1).
 */
export async function canAffordMessage(
  student: StudentDoc,
  inputChars: number,
): Promise<boolean> {
  const pricing = await getPricing();
  if (!pricing.billingEnabled) return true;
  const upfront = computeMessageCost({ ...pricing, per1kInputTokens: 0, per1kOutputTokens: 0 }, inputChars);
  return student.quants >= Math.max(1, upfront.total);
}

/**
 * Charges for one successful AI reply. If the full cost exceeds the balance
 * (the token part can't be known before the reply), takes what's left rather
 * than going negative. Returns the new balance, or null if nothing was charged.
 */
export async function chargeForMessage(
  studentId: Types.ObjectId,
  inputChars: number,
  usage: GroqUsage,
): Promise<number | null> {
  const pricing = await getPricing();
  if (!pricing.billingEnabled) return null;

  const cost = computeMessageCost(pricing, inputChars, usage);
  if (cost.total <= 0) return null;

  const before = await Student.findById(studentId, { quants: 1 });
  if (!before || before.quants <= 0) return null;
  const charged = Math.min(cost.total, before.quants);

  const updated = await Student.findOneAndUpdate(
    { _id: studentId, quants: { $gte: charged } },
    { $inc: { quants: -charged } },
    { new: true, projection: { quants: 1 } },
  );
  if (!updated) {
    logger.warn("Skipped quant charge — balance changed at charge time", {
      studentId: studentId.toString(),
    });
    return null;
  }

  await QuantTransaction.create({
    student: studentId,
    type: "chat_message",
    amount: -charged,
    balanceAfter: updated.quants,
    description:
      charged < cost.total
        ? `Chat message (${cost.total - charged} quants waived — balance ran out)`
        : "Chat message",
    inputChars,
    costBreakdown: cost,
    groqUsage: usage,
  });

  return updated.quants;
}

/**
 * Super-admin grant (positive) or correction (negative). A removal can't take
 * the balance below 0. Positive grants are announced to the student on WhatsApp.
 */
export async function adjustQuants(
  studentId: string,
  amount: number,
  reason: string,
  adminId?: string,
): Promise<{ balance: number }> {
  if (!Types.ObjectId.isValid(studentId)) {
    throw ApiError.notFound("Student not found");
  }
  const updated = await Student.findOneAndUpdate(
    { _id: studentId, ...(amount < 0 ? { quants: { $gte: -amount } } : {}) },
    { $inc: { quants: amount } },
    { new: true, projection: { quants: 1, phone: 1 } },
  );
  if (!updated) {
    const exists = await Student.exists({ _id: studentId });
    throw exists
      ? ApiError.badRequest("Can't remove more quants than the student has")
      : ApiError.notFound("Student not found");
  }

  await QuantTransaction.create({
    student: updated._id,
    type: "admin_adjustment",
    amount,
    balanceAfter: updated.quants,
    description: reason,
    adjustedBy: adminId,
  });

  if (amount > 0) {
    await sendWhatsAppText(
      updated.phone,
      `🎁 You've received *${amount} quants* from the Quant team!\n\n${balanceText(updated.quants)}`,
    ).catch((err) =>
      logger.error("Failed to send quant grant notice", {
        to: updated.phone,
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }

  return { balance: updated.quants };
}

export function getQuantHistory(studentId: string, limit: number) {
  return QuantTransaction.find({ student: studentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("adjustedBy", "email");
}

export type TransactionFilters = {
  type?: string[];
  studentId?: string;
  page: number;
  limit: number;
};

/**
 * Admin transactions feed across all students — top-ups, admin credits,
 * reward conversions, chat charges — with totals for the same filter.
 */
export async function listTransactions({
  type,
  studentId,
  page,
  limit,
}: TransactionFilters) {
  const match: Record<string, unknown> = {};
  if (type?.length) match.type = { $in: type };
  if (studentId) {
    if (!Types.ObjectId.isValid(studentId)) {
      throw ApiError.badRequest("Invalid studentId");
    }
    match.student = new Types.ObjectId(studentId);
  }

  const [items, total, totals] = await Promise.all([
    QuantTransaction.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("student", "fullName phone email")
      .populate("adjustedBy", "email")
      .populate("refId", "amount txRef flutterwaveTransactionId"),
    QuantTransaction.countDocuments(match),
    QuantTransaction.aggregate<{ _id: string; count: number; quants: number }>([
      { $match: match },
      { $group: { _id: "$type", count: { $sum: 1 }, quants: { $sum: "$amount" } } },
    ]),
  ]);

  const byType = Object.fromEntries(
    totals.map((t) => [t._id, { count: t.count, quants: t.quants }]),
  );

  return {
    items,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: byType,
  };
}

/** Whether a student can still send another message after this balance. */
export async function isOutOfQuants(balance: number): Promise<boolean> {
  const pricing = await getPricing();
  return balance < Math.max(1, Math.ceil(pricing.perMessage));
}

/** Recent real-world averages, so admins can set rates against actual usage. */
export async function getRecentUsageStats(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [stats] = await QuantTransaction.aggregate<{
    messages: number;
    avgCharged: number;
    avgInputChars: number;
    avgPromptTokens: number;
    avgCompletionTokens: number;
  }>([
    { $match: { type: "chat_message", createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        messages: { $sum: 1 },
        avgCharged: { $avg: { $abs: "$amount" } },
        avgInputChars: { $avg: "$inputChars" },
        avgPromptTokens: { $avg: "$groqUsage.promptTokens" },
        avgCompletionTokens: { $avg: "$groqUsage.completionTokens" },
      },
    },
  ]);
  return {
    days,
    messages: stats?.messages ?? 0,
    avgCharged: Math.round(stats?.avgCharged ?? 0),
    avgInputChars: Math.round(stats?.avgInputChars ?? 0),
    avgPromptTokens: Math.round(stats?.avgPromptTokens ?? 0),
    avgCompletionTokens: Math.round(stats?.avgCompletionTokens ?? 0),
  };
}

// ---------------------------------------------------------------------------
// WhatsApp prompts
// ---------------------------------------------------------------------------

export function topupButtonTitle(amount: number): string {
  return `Top up ${formatNaira(amount)}`; // ≤ 20 chars (WA limit)
}

/** Maps a tapped top-up button (or a typed "₦1,000") back to its amount. */
export function parseTopupSelection(input: string): number | null {
  const match = input.trim().match(/^(?:top\s?up\s*)?₦\s?([\d,]+)$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return (TOPUP_AMOUNTS_NGN as readonly number[]).includes(amount)
    ? amount
    : null;
}

// ---------------------------------------------------------------------------
// Free-text intent: "toop up 1k", "I want to recharge", "how many quants do I
// have?" — caught before the agent so asking to pay is free and never depends
// on the model. Short messages only: longer ones are real questions.
// ---------------------------------------------------------------------------

const QUANT_INTENT_MAX_WORDS = 8;

// Patterns run on text with punctuation stripped and doubled letters collapsed
// ("toop" → "top", "wallet" → "walet", "add" → "ad"), so they're written in
// that collapsed form.
const TOPUP_PATTERN =
  /\b(top ?up|recharge|refil|reload|fund( my)?( walet| acount| quants?)?|(buy|get|ad)( more| some)? (quants?|credits?|units?)|pay for quants?|how (do|can) i pay|make (a )?payment)\b/;
const BALANCE_PATTERN =
  /^balance$|\b(my|check|quants?) balance\b|\b(my quants?|quants? left|how many quants?|check (my )?quants?)\b|^quants?$/;
// Complaints ("I topped up but didn't get quants") need a real answer, not buttons.
const COMPLAINT_PATTERN =
  /\b(didn t|didnt|did not|not|never|haven t|failed|but|why|deducted|charged)\b/;

export type QuantIntent =
  | { kind: "topup"; amount: number | null }
  | { kind: "balance" };

export function detectQuantIntent(input: string): QuantIntent | null {
  const lowered = input.toLowerCase();
  const text = lowered
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(\p{L})\1+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.split(" ").length > QUANT_INTENT_MAX_WORDS) return null;
  if (COMPLAINT_PATTERN.test(text)) return null;

  if (TOPUP_PATTERN.test(text)) {
    // "top up 1000", "recharge ₦2,000", "top up 1k"
    const num = lowered.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k)?\b/);
    const amount = num ? Math.round(Number(num[1]) * (num[2] ? 1000 : 1)) : null;
    return {
      kind: "topup",
      amount:
        amount !== null && (TOPUP_AMOUNTS_NGN as readonly number[]).includes(amount)
          ? amount
          : null,
    };
  }
  if (BALANCE_PATTERN.test(text)) return { kind: "balance" };
  return null;
}

// "Running low" = fewer than this many typical messages left. A typical
// message is priced with the current admin rates, so the nudge tracks them.
const LOW_BALANCE_MESSAGES = 5;
const TYPICAL_MESSAGE = {
  chars: 100,
  usage: { promptTokens: 12_000, completionTokens: 1_500 },
};

export async function isLowBalance(quants: number): Promise<boolean> {
  const pricing = await getPricing();
  if (!pricing.billingEnabled) return false;
  const typical = computeMessageCost(
    pricing,
    TYPICAL_MESSAGE.chars,
    TYPICAL_MESSAGE.usage,
  ).total;
  return quants < LOW_BALANCE_MESSAGES * Math.max(1, typical);
}

export async function sendTopupOptions(
  to: string,
  bodyText: string,
): Promise<void> {
  try {
    await sendWhatsAppButtons(to, {
      bodyText,
      buttons: TOPUP_AMOUNTS_NGN.map((amount) => ({
        id: `topup_${amount}`,
        title: topupButtonTitle(amount),
      })),
      footerText: "₦1 = 1 quant",
    });
  } catch (err) {
    logger.error("Failed to send top-up buttons, falling back to text", {
      to,
      error: err instanceof Error ? err.message : "unknown",
    });
    await sendWhatsAppText(
      to,
      `${bodyText}\n\nReply with an amount to top up: ${TOPUP_AMOUNTS_NGN.map(formatNaira).join(", ")}`,
    ).catch(() => undefined);
  }
}

export function balanceText(quants: number): string {
  return `💎 You have *${quants} quant${quants === 1 ? "" : "s"}*.`;
}

// ---------------------------------------------------------------------------
// Flutterwave
// ---------------------------------------------------------------------------

async function flutterwave<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error("FLUTTERWAVE_SECRET_KEY not configured");
  }
  const res = await fetch(`${FLUTTERWAVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(`Flutterwave ${path} failed (${res.status}): ${body.message ?? ""}`);
  }
  return body;
}

/** Creates a pending Payment and a Flutterwave Standard checkout link for it. */
export async function createTopupLink(
  student: StudentDoc,
  amount: number,
): Promise<string> {
  const txRef = `quant_${crypto.randomBytes(12).toString("hex")}`;
  const quants = amount * QUANTS_PER_NAIRA;

  const res = await flutterwave<{ data?: { link?: string } }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency: "NGN",
      redirect_url:
        env.PAYMENT_REDIRECT_URL || `${env.APP_BASE_URL}/pay/callback`,
      customer: {
        email: student.email,
        phonenumber: student.phone,
        name: student.fullName,
      },
      customizations: {
        title: "Quant",
        description: `${quants} quants`,
      },
      meta: { studentId: student._id.toString() },
    }),
  });

  const link = res.data?.link;
  if (!link) throw new Error("Flutterwave returned no checkout link");

  // Saved only once a link exists — nobody can pay before seeing it, so the
  // webhook can never arrive ahead of this record.
  await Payment.create({
    student: student._id,
    txRef,
    amount,
    quants,
    currency: "NGN",
  });
  return link;
}

export async function sendTopupLink(
  student: StudentDoc,
  amount: number,
): Promise<void> {
  try {
    const url = await createTopupLink(student, amount);
    await sendWhatsAppCtaUrl(student.phone, {
      bodyText: `Tap below to pay *${formatNaira(amount)}* for *${amount * QUANTS_PER_NAIRA} quants*. They'll land in your balance as soon as the payment goes through.`,
      buttonText: "Pay now",
      url,
    });
  } catch (err) {
    logger.error("Failed to create/send top-up link", {
      to: student.phone,
      amount,
      error: err instanceof Error ? err.message : "unknown",
    });
    await sendWhatsAppText(
      student.phone,
      "⚠️ Couldn't create your payment link right now — please try again in a moment.",
    ).catch(() => undefined);
  }
}

type FlutterwaveTransaction = {
  id: number;
  tx_ref: string;
  status: string;
  amount: number;
  currency: string;
};

export type VerifyResult =
  | { status: "credited"; quants: number; balance: number }
  | { status: "already_credited"; quants: number }
  | { status: "failed" | "pending" | "not_found" };

/**
 * Confirms a payment with Flutterwave's verify endpoint (never trusting the
 * webhook body or redirect query alone) and credits quants exactly once.
 * Safe to call repeatedly — the webhook and the redirect page both call it.
 */
export async function verifyAndCreditPayment(
  txRef: string,
  transactionId?: number,
): Promise<VerifyResult> {
  const payment = await Payment.findOne({ txRef });
  if (!payment) return { status: "not_found" };
  if (payment.status === "successful") {
    return { status: "already_credited", quants: payment.quants };
  }

  let tx: FlutterwaveTransaction | undefined;
  if (transactionId) {
    ({ data: tx } = await flutterwave<{ data?: FlutterwaveTransaction }>(
      `/transactions/${transactionId}/verify`,
    ));
  } else {
    // No id (e.g. the redirect lost it): look it up by our own reference.
    // Flutterwave 404s until a charge exists — an abandoned checkout is
    // still just pending from our side.
    try {
      ({ data: tx } = await flutterwave<{ data?: FlutterwaveTransaction }>(
        `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      ));
    } catch {
      return { status: payment.status === "failed" ? "failed" : "pending" };
    }
  }
  if (!tx || tx.tx_ref !== txRef) return { status: "not_found" };

  if (tx.status !== "successful") {
    if (tx.status === "failed") {
      await Payment.updateOne(
        { _id: payment._id, status: "pending" },
        { status: "failed", flutterwaveTransactionId: tx.id },
      );
      return { status: "failed" };
    }
    return { status: "pending" };
  }

  if (tx.currency !== payment.currency || tx.amount < payment.amount) {
    logger.error("Flutterwave amount/currency mismatch — not crediting", {
      txRef,
      expected: { amount: payment.amount, currency: payment.currency },
      got: { amount: tx.amount, currency: tx.currency },
    });
    return { status: "failed" };
  }

  // Claim the payment: only the caller that flips pending → successful credits.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "successful" } },
    { status: "successful", flutterwaveTransactionId: tx.id, paidAt: new Date() },
    { new: true },
  );
  if (!claimed) return { status: "already_credited", quants: payment.quants };

  const student = await Student.findByIdAndUpdate(
    payment.student,
    { $inc: { quants: payment.quants } },
    { new: true },
  );
  if (!student) {
    logger.error("Paid top-up for a missing student", { txRef });
    return { status: "not_found" };
  }

  await QuantTransaction.create({
    student: student._id,
    type: "topup",
    amount: payment.quants,
    balanceAfter: student.quants,
    description: `Top-up: ${formatNaira(payment.amount)}`,
    refType: "Payment",
    refId: payment._id,
  });

  await sendWhatsAppText(
    student.phone,
    `✅ Payment received! *${payment.quants} quants* added.\n\n${balanceText(student.quants)}`,
  ).catch((err) =>
    logger.error("Failed to send top-up confirmation", {
      to: student.phone,
      error: err instanceof Error ? err.message : "unknown",
    }),
  );

  return { status: "credited", quants: payment.quants, balance: student.quants };
}

/**
 * One-off rename of the old `tokens` fields to `quants`. Idempotent: only
 * touches documents that still carry the old field.
 */
export async function migrateTokensToQuants(): Promise<void> {
  const students = await Student.collection.updateMany(
    { tokens: { $exists: true }, quants: { $exists: false } },
    { $rename: { tokens: "quants" } },
  );
  await Student.collection.updateMany(
    { tokens: { $exists: true } },
    { $unset: { tokens: "" } },
  );
  await Reward.collection.updateMany(
    { tokensGranted: { $exists: true } },
    { $unset: { tokensGranted: "" } },
  );
  if (students.modifiedCount > 0) {
    logger.info("Migrated student tokens → quants", {
      count: students.modifiedCount,
    });
  }
}
