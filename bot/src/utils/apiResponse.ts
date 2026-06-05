import { Response } from "express";

type ApiSuccessPayload = Record<string, unknown>;

export const sendSuccess = (
  res: Response,
  payload: ApiSuccessPayload = {},
  statusCode = 200
): void => {
  res.status(statusCode).json({ success: true, ...payload });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500
): void => {
  res.status(statusCode).json({ error: message });
};
