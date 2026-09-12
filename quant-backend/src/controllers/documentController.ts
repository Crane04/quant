import { Request, Response } from "express";
import { createHash, randomUUID } from "crypto";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { DocumentFile } from "../models/DocumentFile";
import { Student } from "../models/Student";
import { Course } from "../models/Course";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";
import { findOrCreateCourse } from "../services/courseService";
import {
  uploadBuffer,
  uploadFile,
  deleteFile,
} from "../services/storageService";
import { generatePdfThumbnail } from "../services/pdfThumbnailService";
import { awardPointsForApprovedDocument } from "../services/pointsService";
import { evaluateBadgesForStudent } from "../services/badgeService";
import { logger } from "../utils/logger";

function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

type UploadDocumentBody = {
  title: string;
  category: "lecture_note" | "exam_summary" | "past_question" | "other";
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

function getFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function duplicateDocumentError(doc: {
  _id: Types.ObjectId;
  title: string;
}) {
  return ApiError.conflict("This material has already been uploaded", {
    documentId: doc._id.toString(),
    title: doc.title,
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

async function uploadDocument(
  req: Request,
  uploadedByType: "Admin" | "Student",
  uploadedBy: string,
) {
  const file = req.file;
  if (!file) throw ApiError.badRequest("PDF file is required (field 'pdf')");

  const fileHash = getFileHash(file.buffer);
  const existing = await DocumentFile.findOne({ fileHash }).select("_id title");
  if (existing) throw duplicateDocumentError(existing);

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

  const { url, key } = await uploadFile(
    file.buffer,
    file.originalname,
    file.mimetype,
  );

  let thumbnail: { url: string; key: string } | undefined;
  let thumbnailKey: string | undefined;
  try {
    const thumbnailBuffer = await generatePdfThumbnail(file.buffer);
    thumbnailKey = `thumbnails/${randomUUID()}.png`;
    thumbnail = await uploadBuffer(
      thumbnailBuffer,
      thumbnailKey,
      "image/png",
    );
  } catch (error) {
    if (thumbnailKey) {
      try {
        await deleteFile(thumbnailKey);
      } catch (cleanupError) {
        logger.warn("Failed to clean up document thumbnail", {
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : "unknown",
        });
      }
    }
    logger.warn("Failed to create document thumbnail", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  // Admin uploads don't need review; student uploads start pending and only earn
  // points once an admin approves them (see reviewDocument below).
  const status = uploadedByType === "Admin" ? "approved" : "pending";

  let doc;
  try {
    doc = await DocumentFile.create({
      course: course._id,
      title: body.title,
      category: body.category,
      fileUrl: url,
      fileType: "pdf",
      fileHash,
      ...(thumbnail && {
        thumbnailUrl: thumbnail.url,
        thumbnailStorageKey: thumbnail.key,
      }),
      sizeBytes: file.size,
      storageKey: key,
      tags: parseTags(body.tags),
      uploadedByType,
      uploadedBy,
      status,
    });
  } catch (error) {
    // The unique hash index closes the find-then-create race. Remove the R2
    // object created by the losing request before returning the duplicate.
    await deleteFile(key);
    if (thumbnail?.key) await deleteFile(thumbnail.key);
    if (isDuplicateKeyError(error)) {
      const duplicate = await DocumentFile.findOne({ fileHash }).select(
        "_id title",
      );
      if (duplicate) throw duplicateDocumentError(duplicate);
    }
    throw error;
  }

  return doc.populate("course");
}

export const createDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const populated = await uploadDocument(req, "Admin", req.admin!.id);
    sendSuccess(res, populated, undefined, 201);
  },
);

export const createMyDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const student = await Student.findById(req.studentId);
    if (!student) throw ApiError.notFound("Student not found");
    if (!student.isAmbassador)
      throw ApiError.forbidden(
        "Document uploads are available to ambassadors only",
      );

    const populated = await uploadDocument(req, "Student", req.studentId!);
    sendSuccess(res, populated, undefined, 201);
  },
);

export const listDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      courseCode,
      level,
      department,
      semester,
      search,
      status,
      uploadedBy,
    } = req.query as Record<string, string>;

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
    if (status) filter.status = status;
    if (uploadedBy) filter.uploadedBy = uploadedBy;

    const docs = await DocumentFile.find(filter)
      .populate("course")
      .populate("uploadedBy", "fullName email phone matricNumber")
      .sort({ createdAt: -1 });
    sendSuccess(res, docs);
  },
);

// Admin approves/rejects a student upload. Approval credits the uploader's points,
// bumps their upload streak, and re-evaluates their badges; rejection just records
// the reason. No-op (400) if the document was already reviewed.
export const reviewDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, rejectionReason } = req.body as {
      status: "approved" | "rejected";
      rejectionReason?: string;
    };

    const doc = await DocumentFile.findById(req.params.id);
    if (!doc) throw ApiError.notFound("Document not found");
    if (doc.status !== "pending")
      throw ApiError.badRequest("This document has already been reviewed");
    if (doc.uploadedByType !== "Student") {
      throw ApiError.badRequest("Only student uploads go through review");
    }

    doc.reviewedBy = new Types.ObjectId(req.admin!.id);
    doc.reviewedAt = new Date();

    if (status === "rejected") {
      doc.status = "rejected";
      doc.rejectionReason = rejectionReason;
      await doc.save();
      await doc.populate("course");
      await doc.populate("uploadedBy", "fullName email phone matricNumber");
      sendSuccess(res, doc);
      return;
    }

    const student = await Student.findById(doc.uploadedBy);
    if (!student) throw ApiError.notFound("Uploader not found");

    const { amount } = await awardPointsForApprovedDocument(student, doc);
    doc.status = "approved";
    doc.pointsAwarded = amount;
    await doc.save();

    await evaluateBadgesForStudent(student._id.toString());

    await doc.populate("course");
    await doc.populate("uploadedBy", "fullName email phone matricNumber");
    sendSuccess(res, doc);
  },
);

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentFile.findById(req.params.id)
    .populate("course")
    .populate("uploadedBy", "fullName email phone matricNumber");
  if (!doc) throw ApiError.notFound("Document not found");
  sendSuccess(res, doc);
});

export const updateDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const { title, tags, courseId } = req.body as {
      title?: string;
      tags?: string;
      courseId?: string;
    };
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (tags !== undefined) updates.tags = parseTags(tags);
    if (courseId !== undefined) updates.course = courseId;

    const doc = await DocumentFile.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).populate("course");
    if (!doc) throw ApiError.notFound("Document not found");
    sendSuccess(res, doc);
  },
);

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const doc = await DocumentFile.findByIdAndDelete(req.params.id);
    if (!doc) throw ApiError.notFound("Document not found");
    if (doc.storageKey) await deleteFile(doc.storageKey);
    if (doc.thumbnailStorageKey) await deleteFile(doc.thumbnailStorageKey);
    sendSuccess(res, undefined, "Document deleted");
  },
);

export const getCourseDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const docs = await DocumentFile.find({ course: req.params.courseId }).sort({
      createdAt: -1,
    });
    sendSuccess(res, docs);
  },
);

export const getMyDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const { session, semester } = req.query as {
      session: string;
      semester: string;
    };

    const student = await Student.findById(req.studentId);
    if (!student) throw ApiError.notFound("Student not found");

    // Ambassadors are checking on their own uploads, not browsing course materials —
    // no reason to gate that behind an enrollment record for the course.
    let filter: Record<string, unknown>;
    if (student.isAmbassador) {
      filter = { uploadedByType: "Student", uploadedBy: req.studentId };
    } else {
      const enrollments = await StudentCourse.find({
        student: req.studentId,
        session,
        semester,
      }).select("course");
      filter = { course: { $in: enrollments.map((e) => e.course) } };
    }

    const docs = await DocumentFile.find(filter)
      .populate("course")
      .sort({ createdAt: -1 })
      .limit(100);

    sendSuccess(res, docs);
  },
);
