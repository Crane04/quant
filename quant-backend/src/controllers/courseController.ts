import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Course } from "../models/Course";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const { university, department, level, session, semester, search } =
    req.query;
  const filter: Record<string, unknown> = {};
  if (university) filter.university = university;
  if (department) filter.department = department;
  if (level) filter.level = level;
  if (session) filter.session = session;
  if (semester) filter.semester = semester;
  if (search) {
    const pattern = new RegExp(String(search), "i");
    filter.$or = [{ code: pattern }, { title: pattern }];
  }

  const courses = await Course.find(filter).sort({ code: 1 });
  sendSuccess(res, courses);
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound("Course not found");
  sendSuccess(res, course);
});

export const createCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const course = await Course.create(req.body);
    sendSuccess(res, course, undefined, 201);
  },
);

export const updateCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!course) throw ApiError.notFound("Course not found");
    sendSuccess(res, course);
  },
);

export const deleteCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) throw ApiError.notFound("Course not found");
    sendSuccess(res, undefined, "Course deleted");
  },
);

// Enroll the resolved student (self or bot-resolved) in a set of courses for a session/semester
export const enrollInCourses = asyncHandler(
  async (req: Request, res: Response) => {
    const { courseIds, session, semester } = req.body as {
      courseIds: string[];
      session: string;
      semester: "first" | "second";
    };

    const studentId = new Types.ObjectId(req.studentId);

    const ops = courseIds.map((courseId) => ({
      updateOne: {
        filter: { student: studentId, course: new Types.ObjectId(courseId) },
        update: {
          $setOnInsert: {
            student: studentId,
            course: new Types.ObjectId(courseId),
            session,
            semester,
          },
        },
        upsert: true,
      },
    }));

    await StudentCourse.bulkWrite(ops);

    const enrollments = await StudentCourse.find({
      student: req.studentId,
      session,
      semester,
    }).populate("course");
    sendSuccess(res, enrollments, undefined, 201);
  },
);

export const getMyCourses = asyncHandler(
  async (req: Request, res: Response) => {
    const { session, semester } = req.query;
    const filter: Record<string, unknown> = { student: req.studentId };
    if (session) filter.session = session;
    if (semester) filter.semester = semester;

    const enrollments = await StudentCourse.find(filter)
      .populate("course")
      .sort({ createdAt: -1 });
    sendSuccess(res, enrollments);
  },
);
