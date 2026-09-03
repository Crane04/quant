import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/**
 * Service-to-service auth for the WhatsApp bot process, which is a separate
 * codebase and doesn't hold a per-student JWT. It authenticates with a
 * shared secret and identifies the student per-request via phone number.
 */
export function requireBotApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const key = req.headers["x-api-key"];
  if (!key || key !== env.BOT_SERVICE_API_KEY) {
    return next(
      ApiError.unauthorized("Invalid or missing bot service API key"),
    );
  }
  req.isBotService = true;
  next();
}

/**
 * Same check as requireBotApiKey, but never blocks the request — used on routes a
 * non-bot client can also legitimately hit (e.g. student registration), where the
 * bot's identity just changes behavior rather than gating access.
 */
export function detectBotApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.headers["x-api-key"] === env.BOT_SERVICE_API_KEY) {
    req.isBotService = true;
  }
  next();
}
