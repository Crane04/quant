import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { DocumentFile } from "../models/DocumentFile";
import { Student } from "../models/Student";
import { Course } from "../models/Course";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";
import { findOrCreateCourse } from "../services/courseService";
import { uploadFile, deleteFile } from "../services/storageService";

function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

type UploadDocumentBody = {
  title: string;
  courseId?: string;
  courseCode?: string;
  courseTitle?: string;
  university?: string;
  department?: string;
  level?: string;
  session?: string;
  semester?: "first" | "second";
  creditUnits?: number;
  tags?: string;
};

async function uploadDocument(
  req: Request,
  uploadedByType: "Admin" | "Student",
  uploadedBy: string
) {
  const file = req.file;
  if (!file) throw ApiError.badRequest("PDF file is required (field 'pdf')");

  const body = req.body as UploadDocumentBody;

  const course = body.courseId
    ? await Course.findById(body.courseId)
    : await findOrCreateCourse({
        code: body.courseCode!,
        title: body.courseTitle!,
        university: body.university!,
        department: body.department!,
        level: body.level!,
        session: body.session!,
        semester: body.semester!,
        creditUnits: body.creditUnits!,
      });
  if (!course) throw ApiError.notFound("Course not found");

  const { url, key } = await uploadFile(file.buffer, file.originalname, file.mimetype);

  const doc = await DocumentFile.create({
    course: course._id,
    title: body.title,
    fileUrl: url,
    fileType: "pdf",
    sizeBytes: file.size,
    storageKey: key,
    tags: parseTags(body.tags),
    uploadedByType,
    uploadedBy,
  });

  return doc.populate("course");
}

export const createDocument = asyncHandler(async (req: Request, res: Response) => {
  const populated = await uploadDocument(req, "Admin", req.admin!.id);
  sendSuccess(res, populated, undefined, 201);
});

export const createMyDocument = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.studentId);
  if (!student) throw ApiError.notFound("Student not found");
  if (!student.isAmbassador) throw ApiError.forbidden("Document uploads are available to ambassadors only");

  const populated = await uploadDocument(req, "Student", req.studentId!);
  sendSuccess(res, populated, undefined, 201);
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { courseCode, level, department, semester, search } = req.query as Record<string, string>;

  const courseFilter: Record<string, unknown> = {};
  if (courseCode) courseFilter.code = new RegExp(courseCode, "i");
  if (level) courseFilter.level = level;
  if (department) courseFilter.department = new RegExp(department, "i");
  if (semester) courseFilter.semester = semester;

  const filter: Record<string, unknown> = {};
  if (Object.keys(courseFilter).length > 0) {
    const courses = await Course.find(courseFilter).select("_id");
    filter.course = { $in: courses.map((c) => c._id) };
  }
  if (search) filter.$text = { $search: search };

  const docs = await DocumentFile.find(filter).populate("course").sort({ createdAt: -1 });
  sendSuccess(res, docs);
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentFile.findById(req.params.id).populate("course");
  if (!doc) throw ApiError.notFound("Document not found");
  sendSuccess(res, doc);
});

export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const { title, tags, courseId } = req.body as { title?: string; tags?: string; courseId?: string };
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (tags !== undefined) updates.tags = parseTags(tags);
  if (courseId !== undefined) updates.course = courseId;

  const doc = await DocumentFile.findByIdAndUpdate(req.params.id, updates, { new: true }).populate("course");
  if (!doc) throw ApiError.notFound("Document not found");
  sendSuccess(res, doc);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentFile.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Document not found");
  if (doc.storageKey) await deleteFile(doc.storageKey);
  sendSuccess(res, undefined, "Document deleted");
});

export const getCourseDocuments = asyncHandler(async (req: Request, res: Response) => {
  const docs = await DocumentFile.find({ course: req.params.courseId }).sort({ createdAt: -1 });
  sendSuccess(res, docs);
});

export const getMyDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { session, semester } = req.query as { session: string; semester: string };

  const enrollments = await StudentCourse.find({ student: req.studentId, session, semester }).select(
    "course"
  );
  const courseIds = enrollments.map((e) => e.course);

  const docs = await DocumentFile.find({ course: { $in: courseIds } })
    .populate("course")
    .sort({ createdAt: -1 })
    .limit(100);

  sendSuccess(res, docs);
});
