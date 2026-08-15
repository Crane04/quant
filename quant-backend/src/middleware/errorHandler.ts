import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { sendError } from "../utils/apiResponse";

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error(err.message, { stack: err.stack, details: err.details });
    return sendError(res, err.message, err.statusCode, err.details);
  }

  if (err instanceof MulterError || (err instanceof Error && err.message === "Only PDF files are allowed")) {
    return sendError(res, err.message, 400);
  }

  // Mongoose duplicate key error
  if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
    return sendError(
      res,
      "A record with these details already exists",
      409,
      (err as { keyValue?: unknown }).keyValue
    );
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error("Unhandled error", { message, stack: err instanceof Error ? err.stack : undefined });

  sendError(res, "Internal server error", 500);
}
