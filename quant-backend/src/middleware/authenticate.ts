import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { findSession } from "../utils/session";
import { Student } from "../models/Student";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(
      ApiError.unauthorized("Missing or malformed Authorization header"),
    );
  }

  const token = header.slice("Bearer ".length);
  const session = await findSession("Student", token);
  if (!session)
    return next(ApiError.unauthorized("Invalid or expired access token"));

  const student = await Student.findById(session.actorId);
  if (!student)
    return next(ApiError.unauthorized("Invalid or expired access token"));

  req.student = { sub: student._id.toString(), phone: student.phone };
  req.studentId = student._id.toString();
  next();
}
