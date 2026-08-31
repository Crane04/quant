import crypto from "crypto";

// Short-lived, single-use tokens mapping a random URL token to the phone number
// that requested a web registration link — same in-memory pattern as waSession.ts.
const TOKEN_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

interface TokenEntry {
  phone: string;
  createdAt: number;
}

const tokens = new Map<string, TokenEntry>();

export function createRegistrationToken(phone: string): string {
  const token = crypto.randomBytes(20).toString("hex");
  tokens.set(token, { phone, createdAt: Date.now() });
  return token;
}

/** Returns the phone number for a valid, unexpired token — does NOT consume it. */
export function peekRegistrationToken(token: string): string | null {
  const entry = tokens.get(token);
  if (!entry || Date.now() - entry.createdAt >= TOKEN_TTL_MS) return null;
  return entry.phone;
}

/** Looks up and immediately invalidates the token (single-use, on successful submit). */
export function consumeRegistrationToken(token: string): string | null {
  const phone = peekRegistrationToken(token);
  if (phone) tokens.delete(token);
  return phone;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokens) {
    if (now - entry.createdAt >= TOKEN_TTL_MS) tokens.delete(token);
  }
}, SWEEP_INTERVAL_MS).unref();
