import { Student } from "../models/Student";
import { DocumentFile } from "../models/DocumentFile";

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  fullName: string;
  points: number;
  materialsUploaded: number;
}

async function materialsUploadedCounts(studentIds: unknown[]): Promise<Map<string, number>> {
  const counts = await DocumentFile.aggregate([
    { $match: { uploadedByType: "Student", uploadedBy: { $in: studentIds }, status: "approved" } },
    { $group: { _id: "$uploadedBy", total: { $sum: 1 } } },
  ]);
  return new Map(counts.map((c) => [c._id.toString(), c.total]));
}

export async function getTopContributors(limit: number): Promise<LeaderboardEntry[]> {
  const students = await Student.find({ isAmbassador: true })
    .sort({ points: -1 })
    .limit(limit)
    .select("fullName points");

  const counts = await materialsUploadedCounts(students.map((s) => s._id));

  return students.map((s, i) => ({
    rank: i + 1,
    studentId: s._id.toString(),
    fullName: s.fullName,
    points: s.points,
    materialsUploaded: counts.get(s._id.toString()) ?? 0,
  }));
}

export async function getMyRank(studentId: string): Promise<{ rank: number; points: number } | null> {
  const student = await Student.findById(studentId).select("points isAmbassador");
  if (!student || !student.isAmbassador) return null;

  const ahead = await Student.countDocuments({ isAmbassador: true, points: { $gt: student.points } });
  return { rank: ahead + 1, points: student.points };
}
