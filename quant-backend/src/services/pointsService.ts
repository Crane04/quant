import { HydratedDocument } from "mongoose";
import { Student, StudentDoc } from "../models/Student";
import { PointsTransaction } from "../models/PointsTransaction";
import { DocumentFileDoc } from "../models/DocumentFile";

// Points per approved upload category (Uploads screen "Points You Can Earn" panel).
// "other" has no rate shown in the design; defaulted to half the base rate.
export const CATEGORY_POINT_RATES: Record<string, number> = {
  lecture_note: 10,
  exam_summary: 10,
  past_question: 20,
  other: 5,
};

function isConsecutiveDay(prev: Date, next: Date): boolean {
  const prevDay = Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate());
  const nextDay = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  return nextDay - prevDay === 24 * 60 * 60 * 1000;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Credits a student for an approved document upload: adds points, bumps the
 * consecutive-day upload streak, and records a ledger entry. Does not touch the
 * DocumentFile itself — the caller (documentController.reviewDocument) owns that.
 */
export async function awardPointsForApprovedDocument(
  student: HydratedDocument<StudentDoc>,
  doc: DocumentFileDoc
): Promise<{ amount: number; student: HydratedDocument<StudentDoc> }> {
  const amount = CATEGORY_POINT_RATES[doc.category] ?? CATEGORY_POINT_RATES.other;
  const now = new Date();

  student.points += amount;
  student.lifetimePointsEarned += amount;

  if (!student.lastApprovedUploadDate) {
    student.uploadStreakDays = 1;
  } else if (isSameDay(student.lastApprovedUploadDate, now)) {
    // Already counted today — leave the streak as-is.
  } else if (isConsecutiveDay(student.lastApprovedUploadDate, now)) {
    student.uploadStreakDays += 1;
  } else {
    student.uploadStreakDays = 1;
  }
  student.lastApprovedUploadDate = now;

  await student.save();

  await PointsTransaction.create({
    student: student._id,
    type: "document_approved",
    amount,
    balanceAfter: student.points,
    description: `Approved upload: ${doc.title}`,
    refType: "DocumentFile",
    refId: doc._id,
  });

  return { amount, student };
}

export async function awardBonusPoints(
  studentId: string,
  amount: number,
  description: string,
  ref?: { refType: "Badge"; refId: unknown }
): Promise<void> {
  const student = await Student.findById(studentId);
  if (!student) return;

  student.points += amount;
  student.lifetimePointsEarned += amount;
  await student.save();

  await PointsTransaction.create({
    student: student._id,
    type: "badge_bonus",
    amount,
    balanceAfter: student.points,
    description,
    ...ref,
  });
}
