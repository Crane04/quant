import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { Student, StudentDoc } from "../models/Student";

declare global {
  namespace Express {
    interface Request {
      ambassador?: StudentDoc;
    }
  }
}

/**
 * Runs after resolveStudentContext. Gates HOC Hub routes (lecture alerts,
 * announcements) to ambassadors only, and attaches the full student doc as
 * req.ambassador so handlers don't need a second lookup for university/department/level.
 */
export async function requireAmbassador(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const student = await Student.findById(req.studentId);
  if (!student) return next(ApiError.notFound("Student not found"));
  if (!student.isAmbassador) {
    return next(
      ApiError.forbidden("The HOC Hub is available to ambassadors only"),
    );
  }
  req.ambassador = student;
  next();
}
