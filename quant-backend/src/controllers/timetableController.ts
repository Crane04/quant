import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { TimetableSlot } from "../models/TimetableSlot";
import { StudentCourse } from "../models/StudentCourse";
import { Course, CourseDoc } from "../models/Course";
import { StudentDoc } from "../models/Student";
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

// HOC Hub write access is scoped to the ambassador's own (university, department,
// level) — TimetableSlot has no such fields of its own (unlike Announcement), so
// scope is enforced via the course it points at instead.
async function assertOwnClass(
  ambassador: StudentDoc,
  courseId: string,
): Promise<CourseDoc> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Course not found");
  if (
    course.university !== ambassador.university ||
    course.department !== ambassador.department ||
    course.level !== ambassador.level
  ) {
    throw ApiError.forbidden(
      "You can only manage the timetable for your own class",
    );
  }
  return course;
}

export const createSlot = asyncHandler(async (req: Request, res: Response) => {
  if (req.ambassador) await assertOwnClass(req.ambassador, req.body.course);

  const slot = await TimetableSlot.create(req.body);
  sendSuccess(res, slot, undefined, 201);
});

export const updateSlot = asyncHandler(async (req: Request, res: Response) => {
  const existing = await TimetableSlot.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Timetable slot not found");

  if (req.ambassador) {
    await assertOwnClass(req.ambassador, existing.course.toString());
    if (req.body.course) await assertOwnClass(req.ambassador, req.body.course);
  }

  const slot = await TimetableSlot.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  sendSuccess(res, slot);
});

export const deleteSlot = asyncHandler(async (req: Request, res: Response) => {
  const existing = await TimetableSlot.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Timetable slot not found");

  if (req.ambassador) await assertOwnClass(req.ambassador, existing.course.toString());

  await TimetableSlot.findByIdAndDelete(req.params.id);
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
