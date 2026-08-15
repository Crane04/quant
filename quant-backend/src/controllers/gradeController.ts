import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { GradeRecord } from "../models/GradeRecord";
import { ApiError } from "../utils/ApiError";

export const addOrUpdateGrade = asyncHandler(async (req: Request, res: Response) => {
  const { course, session, semester, creditUnits, grade } = req.body;

  const record = await GradeRecord.findOneAndUpdate(
    { student: req.studentId, course, session, semester },
    { creditUnits, grade },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  sendSuccess(res, record, undefined, 201);
});

export const deleteGrade = asyncHandler(async (req: Request, res: Response) => {
  const record = await GradeRecord.findOneAndDelete({ _id: req.params.id, student: req.studentId });
  if (!record) throw ApiError.notFound("Grade record not found");
  sendSuccess(res, undefined, "Grade record deleted");
});

export const getMyGrades = asyncHandler(async (req: Request, res: Response) => {
  const { session, semester } = req.query as { session?: string; semester?: string };
  const filter: Record<string, unknown> = { student: req.studentId };
  if (session) filter.session = session;
  if (semester) filter.semester = semester;

  const records = await GradeRecord.find(filter).populate("course").sort({ session: 1, semester: 1 });
  sendSuccess(res, records);
});

// Cumulative GPA overall, plus a per-semester breakdown — what CGPA tracking is for.
export const getMyCgpa = asyncHandler(async (req: Request, res: Response) => {
  const records = await GradeRecord.find({ student: req.studentId }).populate("course");

  const bySemester = new Map<string, { totalPoints: number; totalUnits: number }>();
  let cumulativePoints = 0;
  let cumulativeUnits = 0;

  for (const r of records) {
    const key = `${r.session} - ${r.semester}`;
    const bucket = bySemester.get(key) ?? { totalPoints: 0, totalUnits: 0 };
    bucket.totalPoints += (r.gradePoint ?? 0) * r.creditUnits;
    bucket.totalUnits += r.creditUnits;
    bySemester.set(key, bucket);

    cumulativePoints += (r.gradePoint ?? 0) * r.creditUnits;
    cumulativeUnits += r.creditUnits;
  }

  const semesterBreakdown = Array.from(bySemester.entries()).map(([key, v]) => ({
    session: key.split(" - ")[0],
    semester: key.split(" - ")[1],
    gpa: v.totalUnits ? Number((v.totalPoints / v.totalUnits).toFixed(2)) : 0,
    totalUnits: v.totalUnits,
  }));

  sendSuccess(res, {
    cgpa: cumulativeUnits ? Number((cumulativePoints / cumulativeUnits).toFixed(2)) : 0,
    totalCreditUnits: cumulativeUnits,
    semesterBreakdown,
  });
});
