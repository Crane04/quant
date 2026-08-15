import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { findSession } from "../utils/session";
import { Student } from "../models/Student";

/**
 * Lets "my X" endpoints (timetable, assignments, grades...) be called two ways:
 *  1. A student's own JWT (Authorization: Bearer <accessToken>)
 *  2. The WhatsApp bot process, authenticated with x-api-key + a phone number
 *     identifying which student it's acting for (the bot already knows who
 *     it's chatting with — WhatsApp gives it the sender's number).
 *
 * Either path sets req.studentId for downstream handlers.
 */
export async function resolveStudentContext(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const session = await findSession("Student", token);
    if (!session) return next(ApiError.unauthorized("Invalid or expired access token"));

    const student = await Student.findById(session.actorId);
    if (!student) return next(ApiError.unauthorized("Invalid or expired access token"));

    req.student = { sub: student._id.toString(), phone: student.phone };
    req.studentId = student._id.toString();
    return next();
  }

  const apiKey = req.headers["x-api-key"];
  if (apiKey === env.BOT_SERVICE_API_KEY) {
    req.isBotService = true;
    const phone = (req.query.phone as string) ?? req.body?.phone;
    if (!phone) return next(ApiError.badRequest("phone is required for bot-service requests"));

    const student = await Student.findOne({ phone });
    if (!student) return next(ApiError.notFound("No student found for this phone number"));

    req.studentId = student._id.toString();
    return next();
  }

  return next(ApiError.unauthorized("Authentication required"));
}
