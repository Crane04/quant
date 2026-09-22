import { Types } from "mongoose";
import { DocumentFile } from "../models/DocumentFile";

// This is a review heuristic, not proof of abuse. It only highlights a pattern
// for an administrator and must never reject an upload or change its rewards.
export const POSSIBLE_SPLIT_UPLOAD_PATTERN = "POSSIBLE_SPLIT_UPLOAD_PATTERN";
export const SPLIT_UPLOAD_REVIEW_WINDOW_MS = 2 * 60 * 60 * 1000;
export const MAX_SMALL_UPLOAD_PAGE_COUNT = 2;
export const MIN_RECENT_SMALL_UPLOADS_FOR_REVIEW = 2;

type SplitUploadCheck = {
  courseId: Types.ObjectId;
  uploaderId: string;
  category: "lecture_note" | "exam_summary" | "past_question" | "other";
  pageCount: number;
};

export function shouldFlagPossibleSplitUpload(
  pageCount: number,
  recentSmallUploadCount: number,
): boolean {
  return (
    pageCount > 0 &&
    pageCount <= MAX_SMALL_UPLOAD_PAGE_COUNT &&
    recentSmallUploadCount >= MIN_RECENT_SMALL_UPLOADS_FOR_REVIEW
  );
}

export async function hasPossibleSplitUploadPattern({
  courseId,
  uploaderId,
  category,
  pageCount,
}: SplitUploadCheck): Promise<boolean> {
  if (pageCount <= 0 || pageCount > MAX_SMALL_UPLOAD_PAGE_COUNT) return false;

  const windowStart = new Date(Date.now() - SPLIT_UPLOAD_REVIEW_WINDOW_MS);
  const recentSmallUploadCount = await DocumentFile.countDocuments({
    course: courseId,
    uploadedByType: "Student",
    uploadedBy: uploaderId,
    category,
    pageCount: { $lte: MAX_SMALL_UPLOAD_PAGE_COUNT },
    status: { $in: ["pending", "approved"] },
    createdAt: { $gte: windowStart },
  });

  return shouldFlagPossibleSplitUpload(pageCount, recentSmallUploadCount);
}
