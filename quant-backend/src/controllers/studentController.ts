import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Student } from "../models/Student";
import { ApiError } from "../utils/ApiError";
import { toStudentDTO } from "../dto/studentDTO";
import { evaluateBadgesForStudent } from "../services/badgeService";
import { randomUUID } from "crypto";
import { deleteFile, uploadBuffer } from "../services/storageService";
import {
  getProfilePhotoExtension,
  isAllowedProfilePhotoMimeType,
  validateProfilePhoto,
} from "../services/profilePhotoValidationService";
import { logger } from "../utils/logger";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.studentId);
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, toStudentDTO(student));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findByIdAndUpdate(req.studentId, req.body, {
    new: true,
  });
  if (!student) throw ApiError.notFound("Student not found");
  sendSuccess(res, toStudentDTO(student));
});

function isStudentProfilePhotoKey(storageKey: string, studentId: string): boolean {
  return storageKey.startsWith(`profile-photos/${studentId}/`);
}

async function removeUploadedPhotoOnFailure(storageKey: string): Promise<void> {
  try {
    await deleteFile(storageKey);
  } catch (error) {
    logger.warn("Failed to clean up newly uploaded profile photo", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export const uploadMyPhoto = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest("Profile photo is required (field 'photo')");

    await validateProfilePhoto(file);
    if (!isAllowedProfilePhotoMimeType(file.mimetype)) {
      throw ApiError.badRequest("Only JPEG, PNG, and WebP profile photos are allowed");
    }

    const student = await Student.findById(req.studentId);
    if (!student) throw ApiError.notFound("Student not found");

    const studentId = student._id.toString();
    const storageKey = `profile-photos/${studentId}/${randomUUID()}.${getProfilePhotoExtension(file.mimetype)}`;
    const uploadedPhoto = await uploadBuffer(
      file.buffer,
      storageKey,
      file.mimetype,
    );

    let previousStudent;
    try {
      previousStudent = await Student.findByIdAndUpdate(
        student._id,
        {
          photoUrl: uploadedPhoto.url,
          photoStorageKey: uploadedPhoto.key,
        },
        { new: false },
      );
    } catch (error) {
      await removeUploadedPhotoOnFailure(uploadedPhoto.key);
      throw error;
    }

    if (!previousStudent) {
      await removeUploadedPhotoOnFailure(uploadedPhoto.key);
      throw ApiError.notFound("Student not found");
    }

    const previousStorageKey = previousStudent.photoStorageKey;
    if (previousStorageKey) {
      if (isStudentProfilePhotoKey(previousStorageKey, studentId)) {
        try {
          await deleteFile(previousStorageKey);
        } catch (error) {
          logger.warn("Failed to remove replaced profile photo", {
            studentId,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      } else {
        logger.warn("Skipped deletion of profile photo with unexpected storage key", {
          studentId,
        });
      }
    }

    previousStudent.photoUrl = uploadedPhoto.url;
    previousStudent.photoStorageKey = uploadedPhoto.key;
    sendSuccess(res, toStudentDTO(previousStudent));
  },
);

// Admin-facing (requireAdminAuth) — for the dashboard's student directory.

export const listStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const { search, university, department, level } = req.query as Record<
      string,
      string
    >;
    const filter: Record<string, unknown> = {};
    if (university) filter.university = university;
    if (department) filter.department = department;
    if (level) filter.level = level;
    if (search) {
      const pattern = new RegExp(search, "i");
      filter.$or = [
        { fullName: pattern },
        { phone: pattern },
        { email: pattern },
        { matricNumber: pattern },
      ];
    }

    const students = await Student.find(filter).sort({ createdAt: -1 });
    sendSuccess(res, students.map(toStudentDTO));
  },
);

export const getStudentById = asyncHandler(
  async (req: Request, res: Response) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw ApiError.notFound("Student not found");
    sendSuccess(res, toStudentDTO(student));
  },
);

export const updateStudentById = asyncHandler(
  async (req: Request, res: Response) => {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!student) throw ApiError.notFound("Student not found");
    if (req.body.isVerifiedContributor === true) {
      await evaluateBadgesForStudent(student._id.toString());
    }
    sendSuccess(res, toStudentDTO(student));
  },
);

export const deleteStudentById = asyncHandler(
  async (req: Request, res: Response) => {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) throw ApiError.notFound("Student not found");
    sendSuccess(res, undefined, "Student deleted");
  },
);
