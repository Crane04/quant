// Simple in-memory session store.
// Swap the implementation for Redis in production using the commented code below.

export type SessionState =
  | "IDLE"
  | "AWAITING_COURSE_CODE"
  | "AWAITING_DOCUMENT_SELECTION"
  | "AWAITING_SEARCH_QUERY";

interface Session {
  state: SessionState;
  data: Record<string, unknown>;
  updatedAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map<string, Session>();

// Cleanup stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of store.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const getSession = (phone: string): Session => {
  const existing = store.get(phone);
  if (existing && Date.now() - existing.updatedAt < SESSION_TTL_MS) {
    return existing;
  }
  const fresh: Session = { state: "IDLE", data: {}, updatedAt: Date.now() };
  store.set(phone, fresh);
  return fresh;
};

export const setSession = (
  phone: string,
  state: SessionState,
  data: Record<string, unknown> = {}
): void => {
  const existing = getSession(phone);
  store.set(phone, {
    state,
    data: { ...existing.data, ...data },
    updatedAt: Date.now(),
  });
};

export const clearSession = (phone: string): void => {
  store.set(phone, { state: "IDLE", data: {}, updatedAt: Date.now() });
};

// ── Redis implementation (production) ──────────────────────────────────────
// import { createClient } from "redis";
// const redis = createClient({ url: process.env.REDIS_URL });
// await redis.connect();
//
// export const getSession = async (phone: string): Promise<Session> => {
//   const raw = await redis.get(`session:${phone}`);
//   if (raw) return JSON.parse(raw);
//   return { state: "IDLE", data: {}, updatedAt: Date.now() };
// };
//
// export const setSession = async (phone, state, data = {}) => {
//   const existing = await getSession(phone);
//   await redis.setEx(
//     `session:${phone}`,
//     600,
//     JSON.stringify({ state, data: { ...existing.data, ...data }, updatedAt: Date.now() })
//   );
// };
