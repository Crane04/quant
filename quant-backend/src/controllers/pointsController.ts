import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { Student } from "../models/Student";
import { PointsTransaction } from "../models/PointsTransaction";

async function getPointsBalance(studentId: string) {
  const student = await Student.findById(studentId).select(
    "points tokens lifetimePointsEarned uploadStreakDays"
  );
  if (!student) throw ApiError.notFound("Student not found");
  return {
    points: student.points,
    tokens: student.tokens,
    lifetimePointsEarned: student.lifetimePointsEarned,
    uploadStreakDays: student.uploadStreakDays,
  };
}

function getPointsHistory(studentId: string, limit: number) {
  return PointsTransaction.find({ student: studentId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export const getMyPoints = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await getPointsBalance(req.studentId!));
});

// Powers the "Notifications & Activity" / "Recent Wins" feeds.
export const getMyPointsHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  sendSuccess(res, await getPointsHistory(req.studentId!, limit));
});

// Admin oversight — same shape as the self-service endpoints, for any student.
export const getStudentPoints = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await getPointsBalance(req.params.studentId));
});

export const getStudentPointsHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  sendSuccess(res, await getPointsHistory(req.params.studentId, limit));
});
