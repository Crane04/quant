import { Response } from "express";

export function sendSuccess(res: Response, data?: unknown, message?: string, status = 200): void {
  const body: Record<string, unknown> = { success: true };
  if (message !== undefined) body.message = message;
  if (data !== undefined) body.data = data;
  res.status(status).json(body);
}

export function sendError(res: Response, message: string, status = 400, details?: unknown): void {
  const body: Record<string, unknown> = { success: false, message };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}
