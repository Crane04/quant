import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Student } from "../models/Student";
import { ApiError } from "../utils/ApiError";
import { toStudentDTO } from "../dto/studentDTO";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.studentId);
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, toStudentDTO(student));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findByIdAndUpdate(req.studentId, req.body, { new: true });
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, toStudentDTO(student));
});

// Admin-facing (requireAdminAuth) — for the dashboard's student directory.

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const { search, university, department, level } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (university) filter.university = university;
  if (department) filter.department = department;
  if (level) filter.level = level;
  if (search) {
    const pattern = new RegExp(search, "i");
    filter.$or = [{ fullName: pattern }, { phone: pattern }, { email: pattern }, { matricNumber: pattern }];
  }

  const students = await Student.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, students.map(toStudentDTO));
});

export const getStudentById = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, toStudentDTO(student));
});

export const updateStudentById = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, toStudentDTO(student));
});

export const deleteStudentById = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, undefined, "Student deleted");
});
