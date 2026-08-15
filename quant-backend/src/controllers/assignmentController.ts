import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Assignment } from "../models/Assignment";
import { StudentAssignmentStatus } from "../models/StudentAssignmentStatus";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await Assignment.create(req.body);
  sendSuccess(res, assignment, undefined, 201);
});

export const updateAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!assignment) throw ApiError.notFound("Assignment not found");
  sendSuccess(res, assignment);
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await Assignment.findByIdAndDelete(req.params.id);
  if (!assignment) throw ApiError.notFound("Assignment not found");
  sendSuccess(res, undefined, "Assignment deleted");
});

export const getCourseAssignments = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await Assignment.find({ course: req.params.courseId }).sort({ dueDate: 1 });
  sendSuccess(res, assignments);
});

// Assignments across all of the student's enrolled courses, with their per-assignment
// completion status merged in — this is what the bot renders as "your assignments".
export const getMyAssignments = asyncHandler(async (req: Request, res: Response) => {
  const { session, semester, status } = req.query as {
    session: string;
    semester: string;
    status?: "pending" | "completed" | "all";
  };

  const enrollments = await StudentCourse.find({ student: req.studentId, session, semester }).select(
    "course"
  );
  const courseIds = enrollments.map((e) => e.course);

  const assignments = await Assignment.find({ course: { $in: courseIds } })
    .populate("course")
    .sort({ dueDate: 1 });

  const statuses = await StudentAssignmentStatus.find({
    student: req.studentId,
    assignment: { $in: assignments.map((a) => a._id) },
  });
  const statusByAssignment = new Map(statuses.map((s) => [s.assignment.toString(), s]));

  let merged = assignments.map((a) => ({
    ...a.toObject(),
    completed: statusByAssignment.get(a._id.toString())?.completed ?? false,
  }));

  if (status === "pending") merged = merged.filter((a) => !a.completed);
  if (status === "completed") merged = merged.filter((a) => a.completed);

  sendSuccess(res, merged);
});

export const markAssignmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { completed } = req.body as { completed: boolean };

  const status = await StudentAssignmentStatus.findOneAndUpdate(
    { student: req.studentId, assignment: req.params.id },
    { completed, completedAt: completed ? new Date() : null },
    { new: true, upsert: true }
  );

  sendSuccess(res, status);
});

// Assignments due within the next `hours` (default 24) that haven't had a reminder
// sent yet — the bot polls this to know who to nudge.
export const getUpcomingForReminders = asyncHandler(async (req: Request, res: Response) => {
  const hours = Number(req.query.hours ?? 24);
  const windowEnd = new Date(Date.now() + hours * 60 * 60 * 1000);

  const assignments = await Assignment.find({
    dueDate: { $gte: new Date(), $lte: windowEnd },
  }).populate("course");

  sendSuccess(res, assignments);
});
