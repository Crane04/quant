import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Assignment } from "../models/Assignment";
import { ApiError } from "../utils/ApiError";

// A student's saved personal assignments — freeform, not tied to course enrollment.
export const getMyAssignments = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: "pending" | "completed" | "all" };

  const filter: Record<string, unknown> = { student: req.studentId };
  if (status === "pending") filter.completed = false;
  if (status === "completed") filter.completed = true;

  const assignments = await Assignment.find(filter).sort({ dueDate: 1 });
  sendSuccess(res, assignments);
});

export const markAssignmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { completed } = req.body as { completed: boolean };

  const assignment = await Assignment.findOneAndUpdate(
    { _id: req.params.id, student: req.studentId },
    { completed, completedAt: completed ? new Date() : null },
    { new: true }
  );
  if (!assignment) throw ApiError.notFound("Assignment not found");

  sendSuccess(res, assignment);
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await Assignment.findOneAndDelete({ _id: req.params.id, student: req.studentId });
  if (!assignment) throw ApiError.notFound("Assignment not found");
  sendSuccess(res, undefined, "Assignment deleted");
});

// Assignments due within `hours` (default 24) that haven't had a reminder sent yet
// — the reminder scheduler polls this to know who to nudge.
export const getUpcomingForReminders = asyncHandler(async (req: Request, res: Response) => {
  const hours = Number(req.query.hours ?? 24);
  const windowEnd = new Date(Date.now() + hours * 60 * 60 * 1000);

  const assignments = await Assignment.find({
    dueDate: { $gte: new Date(), $lte: windowEnd },
    completed: false,
  }).populate("student", "phone");

  sendSuccess(res, assignments);
});
