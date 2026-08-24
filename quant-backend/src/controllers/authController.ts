import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as authService from "../services/authService";
import { toStudentDTO } from "../dto/studentDTO";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const student = await authService.registerStudent(req.body, req.isBotService);
  const message = "Registered. Verification code sent to email.";
  sendSuccess(res, toStudentDTO(student), message, 201);
});

export const verifyPhone = asyncHandler(async (req: Request, res: Response) => {
  const student = await authService.verifyPhone(req.body.phone, req.body.code);
  sendSuccess(res, toStudentDTO(student));
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const student = await authService.verifyEmail(req.body.email, req.body.code);
  sendSuccess(res, toStudentDTO(student));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { token, student } = await authService.login(req.body.email, req.body.password);
  sendSuccess(res, { token, student: toStudentDTO(student) });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.revokeAllSessions(req.student!.sub);
  sendSuccess(res, undefined, "Logged out of all sessions");
});
