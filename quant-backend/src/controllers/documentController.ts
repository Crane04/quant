import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { DocumentFile } from "../models/DocumentFile";
import { Student } from "../models/Student";
import { Course } from "../models/Course";
import { StudentCourse } from "../models/StudentCourse";
import { ApiError } from "../utils/ApiError";
import { deleteFile } from "../services/storageService";
import { awardPointsForApprovedDocument } from "../services/pointsService";
import { evaluateBadgesForStudent } from "../services/badgeService";
import { logger } from "../utils/logger";
import {
  ingestDocument,
  parseTags,
  UploadDocumentBody,
} from "../services/documentIngestService";

type StudentSafeValidation = {
  status?: unknown;
};

function toStudentSafeDocument(document: {
  toJSON: () => Record<string, unknown>;
}): Record<string, unknown> {
  const result = document.toJSON();
  const validation = result.validation as StudentSafeValidation | undefined;
  if (validation) {
    result.validation = {
      status: validation.status,
    };
  }
  return result;
}

function uploadDocument(
  req: Request,
  uploadedByType: "Admin" | "Student",
  uploadedBy: string,
) {
  const file = req.file;
  if (!file)
    throw ApiError.badRequest("Document file is required (field 'pdf')");
  return ingestDocument(
    file,
    req.body as UploadDocumentBody,
    uploadedByType,
    uploadedBy,
  );
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
    sendSuccess(res, toStudentSafeDocument(populated), undefined, 201);
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
    if (
      doc.uploadedByType !== "Student" &&
      (doc.fileType === "pdf" || doc.fileType === undefined) &&
      !doc.validation?.flags.some(
        (flag) =>
          flag.type === "POTENTIAL_DUPLICATE" || flag.type === "NEEDS_COURSE",
      )
    ) {
      throw ApiError.badRequest("Only student uploads go through review");
    }
    if (status === "approved" && !doc.course) {
      throw ApiError.badRequest("Assign a course before approving this document");
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

    if (doc.uploadedByType === "Admin") {
      doc.status = "approved";
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
    if (courseId !== undefined) {
      if (!(await Course.exists({ _id: courseId }))) {
        throw ApiError.notFound("Course not found");
      }
      updates.course = courseId;
    }

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
    sendSuccess(res, docs.map(toStudentSafeDocument));
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

    sendSuccess(res, docs.map(toStudentSafeDocument));
  },
);
