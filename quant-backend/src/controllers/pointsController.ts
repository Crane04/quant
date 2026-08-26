import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { Student } from "../models/Student";
import { PointsTransaction } from "../models/PointsTransaction";

export const getMyPoints = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.studentId).select(
    "points tokens lifetimePointsEarned uploadStreakDays"
  );
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, {
    points: student.points,
    tokens: student.tokens,
    lifetimePointsEarned: student.lifetimePointsEarned,
    uploadStreakDays: student.uploadStreakDays,
  });
});

// Powers the "Notifications & Activity" / "Recent Wins" feeds.
export const getMyPointsHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const transactions = await PointsTransaction.find({ student: req.studentId })
    .sort({ createdAt: -1 })
    .limit(limit);
  sendSuccess(res, transactions);
});
