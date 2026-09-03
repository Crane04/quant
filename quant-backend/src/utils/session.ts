import crypto from "crypto";
import { Session, SessionActorType, SessionDoc } from "../models/Session";

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates a session for the given actor and returns the raw (unhashed) token to send to the client. */
export async function createSession(
  actorType: SessionActorType,
  actorId: string,
  ttlMs: number,
): Promise<string> {
  const token = generateSessionToken();
  await Session.create({
    actorType,
    actorId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

export function findSession(
  actorType: SessionActorType,
  token: string,
): Promise<SessionDoc | null> {
  return Session.findOne({
    actorType,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
}

export async function revokeSession(token: string): Promise<void> {
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export async function revokeAllSessions(
  actorType: SessionActorType,
  actorId: string,
): Promise<void> {
  await Session.deleteMany({ actorType, actorId });
}
