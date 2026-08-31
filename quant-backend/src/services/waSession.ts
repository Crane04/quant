import { ChatMessage } from "./groqAgentService";

// In-memory per-phone-number conversation state for the WhatsApp bot flow.
// Not the same thing as src/models/Session.ts (that's admin/student login sessions).
// Single-process only — fine for now, swap for Redis if this ever runs multi-instance.

// Registration is the only thing still gated by explicit states (it's collecting
// exact account data behind an email OTP). It's not a rigid one-field-per-message
// wizard though — AWAITING_REG_DETAILS accepts everything in one free-form message
// and extracts fields via the LLM, only asking follow-ups for what's still missing.
// Everything else (IDLE) runs through the tool-calling agent, which uses its own
// message history for multi-turn context instead of explicit states.
export type WaState =
  | "IDLE"
  | "AWAITING_FLOW_SUBMISSION"
  | "AWAITING_WEB_REGISTRATION"
  | "AWAITING_REG_DETAILS"
  | "AWAITING_EMAIL_OTP";

export interface WaSession {
  state: WaState;
  data: Record<string, unknown>;
  /** Rolling chat history fed to the agent for multi-turn context (registration data lives in `data`). */
  messages: ChatMessage[];
  updatedAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 16;

const sessions = new Map<string, WaSession>();

export function getWaSession(phone: string): WaSession {
  const existing = sessions.get(phone);
  if (existing && Date.now() - existing.updatedAt < SESSION_TTL_MS) return existing;

  const fresh: WaSession = { state: "IDLE", data: {}, messages: [], updatedAt: Date.now() };
  sessions.set(phone, fresh);
  return fresh;
}

export function setWaSession(phone: string, state: WaState, data: Record<string, unknown> = {}): void {
  const current = sessions.get(phone);
  sessions.set(phone, {
    state,
    data: { ...(current?.data ?? {}), ...data },
    messages: current?.messages ?? [],
    updatedAt: Date.now(),
  });
}

/** Appends to the agent's rolling history, trimmed to the last MAX_HISTORY_MESSAGES. */
export function appendWaHistory(phone: string, messages: ChatMessage[]): void {
  const current = getWaSession(phone);
  const combined = [...current.messages, ...messages].slice(-MAX_HISTORY_MESSAGES);
  sessions.set(phone, { ...current, messages: combined, updatedAt: Date.now() });
}

export function clearWaSession(phone: string): void {
  sessions.set(phone, { state: "IDLE", data: {}, messages: [], updatedAt: Date.now() });
}

setInterval(() => {
  const now = Date.now();
  for (const [phone, session] of sessions) {
    if (now - session.updatedAt >= SESSION_TTL_MS) sessions.delete(phone);
  }
}, SWEEP_INTERVAL_MS).unref();
