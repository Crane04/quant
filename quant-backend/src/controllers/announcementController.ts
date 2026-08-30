import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { Announcement } from "../models/Announcement";
import { Course } from "../models/Course";
import { Student } from "../models/Student";

type CreateAnnouncementBody =
  | { type: "lecture_alert"; courseId: string; timetableSlotId?: string; title?: string; message: string }
  | { type: "announcement"; title: string; message: string };

// Ambassador (HOC) creates a lecture alert or a general announcement, scoped to
// their own (university, department, level) — requireAmbassador attaches req.ambassador.
export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateAnnouncementBody;
  const ambassador = req.ambassador!;

  let course;
  let title = body.title;
  if (body.type === "lecture_alert") {
    course = await Course.findById(body.courseId);
    if (!course) throw ApiError.notFound("Course not found");
    title = title ?? `Class Alert: ${course.code}`;
  }

  const announcement = await Announcement.create({
    type: body.type,
    title,
    message: body.message,
    course: course?._id,
    timetableSlot: body.type === "lecture_alert" ? body.timetableSlotId : undefined,
    university: ambassador.university,
    department: ambassador.department,
    level: ambassador.level,
    createdByType: "Student",
    createdBy: ambassador._id,
  });

  sendSuccess(res, await announcement.populate("course"), undefined, 201);
});

// Students see announcements/alerts scoped to their own class.
export const getMyAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.query as { type?: "lecture_alert" | "announcement" };
  const student = await Student.findById(req.studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const filter: Record<string, unknown> = {
    university: student.university,
    department: student.department,
    level: student.level,
  };
  if (type) filter.type = type;

  const announcements = await Announcement.find(filter).populate("course").sort({ createdAt: -1 });
  sendSuccess(res, announcements);
});

// Bot polls this to know what to push out over WhatsApp — mirrors
// assignmentController.getUpcomingForReminders.
export const getUnsent = asyncHandler(async (_req: Request, res: Response) => {
  const announcements = await Announcement.find({ sentAt: null }).populate("course").sort({ createdAt: 1 });
  sendSuccess(res, announcements);
});

export const markSent = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    { sentAt: new Date() },
    { new: true }
  );
  if (!announcement) throw ApiError.notFound("Announcement not found");
  sendSuccess(res, announcement);
});

// Admin oversight — every announcement/lecture alert any ambassador has posted, across
// every class, not just the caller's own (mirrors documentController.listDocuments).
export const listAllAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const { type, university, department, level } = req.query as Record<string, string>;

  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;
  if (university) filter.university = university;
  if (department) filter.department = department;
  if (level) filter.level = level;

  const announcements = await Announcement.find(filter)
    .populate("course")
    .populate("createdBy", "fullName email phone matricNumber")
    .sort({ createdAt: -1 })
    .limit(200);
  sendSuccess(res, announcements);
});

// Admin moderation — remove an inappropriate/incorrect announcement.
export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw ApiError.notFound("Announcement not found");
  sendSuccess(res, undefined, "Announcement deleted");
});
