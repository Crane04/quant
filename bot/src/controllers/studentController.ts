import { Request, Response } from "express";
import { Student } from "../models/Student";
import { sendError, sendSuccess } from "../utils/apiResponse";

const editableStudentFields = [
  "name",
  "school",
  "faculty",
  "department",
  "level",
  "currentCgpa",
  "targetCgpa",
];

const buildStudentFilter = (query: Request["query"]): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};
  const { search, school, faculty, department, level } = query;

  if (school) filter.school = { $regex: school as string, $options: "i" };
  if (faculty) filter.faculty = { $regex: faculty as string, $options: "i" };
  if (department) filter.department = { $regex: department as string, $options: "i" };
  if (level) filter.level = level;

  if (search) {
    const term = search as string;
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { phoneNumber: { $regex: term, $options: "i" } },
      { school: { $regex: term, $options: "i" } },
      { department: { $regex: term, $options: "i" } },
    ];
  }

  return filter;
};

const getStudentUpdates = (body: Record<string, unknown>): Record<string, unknown> => {
  const updates: Record<string, unknown> = {};

  for (const field of editableStudentFields) {
    if (body[field] === undefined) continue;
    updates[field] = body[field];
  }

  if (updates.department) updates.department = `${updates.department}`.trim().toUpperCase();
  if (updates.currentCgpa !== undefined) updates.currentCgpa = Number(updates.currentCgpa);
  if (updates.targetCgpa !== undefined) updates.targetCgpa = Number(updates.targetCgpa);

  updates.lastActive = new Date();

  return updates;
};

export const listStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const students = await Student.find(buildStudentFilter(req.query)).sort({ lastActive: -1 });
    sendSuccess(res, { count: students.length, students });
  } catch {
    sendError(res, "Failed to fetch students");
  }
};

export const getStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      sendError(res, "Not found", 404);
      return;
    }

    sendSuccess(res, { student });
  } catch {
    sendError(res, "Fetch failed");
  }
};

export const updateStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = getStudentUpdates(req.body);

    if (Object.keys(updates).length <= 1) {
      sendError(res, "No editable fields provided", 400);
      return;
    }

    const student = await Student.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      sendError(res, "Not found", 404);
      return;
    }

    sendSuccess(res, { student });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    sendError(res, message, 400);
  }
};

export const deleteStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      sendError(res, "Not found", 404);
      return;
    }

    sendSuccess(res, { message: "Deleted" });
  } catch {
    sendError(res, "Delete failed");
  }
};
