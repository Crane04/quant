import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { LectureSummary } from "../models/LectureSummary";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";

export const createLectureSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await LectureSummary.create(req.body);
  sendSuccess(res, summary, undefined, 201);
});

export const updateLectureSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await LectureSummary.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!summary) throw ApiError.notFound("Lecture summary not found");
  sendSuccess(res, summary);
});

export const deleteLectureSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await LectureSummary.findByIdAndDelete(req.params.id);
  if (!summary) throw ApiError.notFound("Lecture summary not found");
  sendSuccess(res, undefined, "Lecture summary deleted");
});

export const getCourseSummaries = asyncHandler(async (req: Request, res: Response) => {
  const summaries = await LectureSummary.find({ course: req.params.courseId }).sort({
    createdAt: -1,
  });
  sendSuccess(res, summaries);
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await LectureSummary.findById(req.params.id).populate("course");
  if (!summary) throw ApiError.notFound("Lecture summary not found");
  sendSuccess(res, summary);
});

// Recent summaries across all of the student's enrolled courses
export const getMySummaries = asyncHandler(async (req: Request, res: Response) => {
  const { session, semester } = req.query as { session: string; semester: string };

  const enrollments = await StudentCourse.find({ student: req.studentId, session, semester }).select(
    "course"
  );
  const courseIds = enrollments.map((e) => e.course);

  const summaries = await LectureSummary.find({ course: { $in: courseIds } })
    .populate("course")
    .sort({ createdAt: -1 })
    .limit(50);

  sendSuccess(res, summaries);
});
