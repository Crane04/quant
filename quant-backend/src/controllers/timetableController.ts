import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { TimetableSlot } from "../models/TimetableSlot";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Trusted-service only (requireBotApiKey) — general scheduling now happens on
// the WhatsApp bot (HOC-only there, see waTools.ts's schedule_class/
// update_class_schedule/cancel_class), which also handles notifying subscribed
// students. This route is kept for ops/import tooling.
export const createSlot = asyncHandler(async (req: Request, res: Response) => {
  const slot = await TimetableSlot.create(req.body);
  sendSuccess(res, slot, undefined, 201);
});

export const updateSlot = asyncHandler(async (req: Request, res: Response) => {
  const slot = await TimetableSlot.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!slot) throw ApiError.notFound("Timetable slot not found");
  sendSuccess(res, slot);
});

export const deleteSlot = asyncHandler(async (req: Request, res: Response) => {
  const slot = await TimetableSlot.findByIdAndDelete(req.params.id);
  if (!slot) throw ApiError.notFound("Timetable slot not found");
  sendSuccess(res, undefined, "Timetable slot deleted");
});

export const getCourseTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const slots = await TimetableSlot.find({
      course: req.params.courseId,
    }).populate("course");
    sendSuccess(res, sortByDay(slots));
  },
);

// The student's full weekly timetable, built from their enrolled courses.
export const getMyTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const { session, semester } = req.query as {
      session: string;
      semester: string;
    };

    const enrollments = await StudentCourse.find({
      student: req.studentId,
      session,
      semester,
    }).select("course");

    const courseIds = enrollments.map((e) => e.course);
    const slots = await TimetableSlot.find({
      course: { $in: courseIds },
    }).populate("course");

    sendSuccess(res, sortByDay(slots));
  },
);

function sortByDay<T extends { dayOfWeek: string; startTime: string }>(
  slots: T[],
): T[] {
  return [...slots].sort((a, b) => {
    const dayDiff =
      DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}
