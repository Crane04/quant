import { Badge, BadgeDoc } from "../models/Badge";
import { StudentBadge } from "../models/StudentBadge";
import { Student } from "../models/Student";
import { DocumentFile } from "../models/DocumentFile";
import { awardBonusPoints } from "./pointsService";
import { logger } from "../utils/logger";

// The fixed 12-badge catalog (Account > Badges & Achievements). Seeded once on
// startup and upserted by `key` so re-running is safe if the catalog changes.
const DEFAULT_BADGES: Array<Omit<BadgeDoc, "_id" | "createdAt" | "updatedAt">> = [
  {
    key: "first_upload",
    name: "First Upload",
    description: "The journey begins",
    category: "upload_milestones",
    tier: "bronze",
    points: 50,
    criteriaType: "upload_count",
    criteriaValue: 1,
  },
  {
    key: "fifty_uploads",
    name: "50 Uploads",
    description: "Bringing lectures to life",
    category: "upload_milestones",
    tier: "silver",
    points: 250,
    criteriaType: "upload_count",
    criteriaValue: 50,
  },
  {
    key: "past_king",
    name: "Past King",
    description: "Past questions? Done.",
    category: "upload_milestones",
    tier: "gold",
    points: 350,
    criteriaType: "past_question_upload_count",
    criteriaValue: 10,
  },
  {
    key: "super_uploader",
    name: "Super Uploader",
    description: "Quantity meets quality",
    category: "upload_milestones",
    tier: "platinum",
    points: 700,
    criteriaType: "upload_count",
    criteriaValue: 100,
  },
  {
    key: "consistent_rep",
    name: "Consistent Rep",
    description: "7 days, no excuses",
    category: "streak_achievements",
    tier: "silver",
    points: 150,
    criteriaType: "streak_days",
    criteriaValue: 7,
  },
  {
    key: "streak_30",
    name: "Streak 30",
    description: "A month of commitment",
    category: "streak_achievements",
    tier: "platinum",
    points: 600,
    criteriaType: "streak_days",
    criteriaValue: 30,
  },
  {
    key: "top_dept_contributor",
    name: "Top Dept Contributor",
    description: "Department MVP",
    category: "rank_prestige",
    tier: "gold",
    points: 300,
    criteriaType: "department_rank",
    criteriaValue: 1,
  },
  {
    key: "scholar_elite",
    name: "Scholar Elite",
    description: "Knowledge is power",
    category: "rank_prestige",
    tier: "gold",
    points: 500,
    criteriaType: "lifetime_points",
    criteriaValue: 2000,
  },
  {
    key: "hoc_legend",
    name: "HOC Legend",
    description: "Among the elite few",
    category: "rank_prestige",
    tier: "diamond",
    points: 1000,
    criteriaType: "lifetime_points_ambassador",
    criteriaValue: 5000,
  },
  {
    key: "season_champ",
    name: "Season Champ",
    description: "King of the semester",
    category: "rank_prestige",
    tier: "obsidian",
    points: 1500,
    criteriaType: "global_rank",
    criteriaValue: 1,
  },
  {
    key: "verified_contributor",
    name: "Verified Contributor",
    description: "Quality confirmed",
    category: "special_recognition",
    tier: "silver",
    points: 200,
    criteriaType: "manual_flag",
  },
  {
    key: "downloads_500",
    name: "500 Downloads",
    description: "Students love your work",
    category: "social_impact",
    tier: "gold",
    points: 400,
    criteriaType: "download_count",
    criteriaValue: 500,
  },
];

export async function ensureDefaultBadges(): Promise<void> {
  for (const badge of DEFAULT_BADGES) {
    await Badge.findOneAndUpdate({ key: badge.key }, badge, { upsert: true, new: true });
  }
  logger.info("Badge catalog seeded", { count: DEFAULT_BADGES.length });
}

async function meetsCriteria(badge: BadgeDoc, stats: StudentStats): Promise<boolean> {
  switch (badge.criteriaType) {
    case "upload_count":
      return stats.approvedUploadCount >= (badge.criteriaValue ?? Infinity);
    case "past_question_upload_count":
      return stats.approvedPastQuestionCount >= (badge.criteriaValue ?? Infinity);
    case "streak_days":
      return stats.uploadStreakDays >= (badge.criteriaValue ?? Infinity);
    case "department_rank":
      return stats.departmentRank !== null && stats.departmentRank <= (badge.criteriaValue ?? 1);
    case "global_rank":
      return stats.globalRank !== null && stats.globalRank <= (badge.criteriaValue ?? 1);
    case "lifetime_points":
      return stats.lifetimePointsEarned >= (badge.criteriaValue ?? Infinity);
    case "lifetime_points_ambassador":
      return stats.isAmbassador && stats.lifetimePointsEarned >= (badge.criteriaValue ?? Infinity);
    case "download_count":
      return stats.totalDownloads >= (badge.criteriaValue ?? Infinity);
    case "manual_flag":
      return stats.isVerifiedContributor;
    default:
      return false;
  }
}

interface StudentStats {
  approvedUploadCount: number;
  approvedPastQuestionCount: number;
  totalDownloads: number;
  uploadStreakDays: number;
  lifetimePointsEarned: number;
  isAmbassador: boolean;
  isVerifiedContributor: boolean;
  departmentRank: number | null;
  globalRank: number | null;
}

async function computeStudentStats(studentId: string): Promise<StudentStats | null> {
  const student = await Student.findById(studentId);
  if (!student) return null;

  const [approvedUploadCount, approvedPastQuestionCount, downloadAgg, globalAhead, deptAhead] =
    await Promise.all([
      DocumentFile.countDocuments({
        uploadedByType: "Student",
        uploadedBy: student._id,
        status: "approved",
      }),
      DocumentFile.countDocuments({
        uploadedByType: "Student",
        uploadedBy: student._id,
        status: "approved",
        category: "past_question",
      }),
      DocumentFile.aggregate([
        { $match: { uploadedByType: "Student", uploadedBy: student._id, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$downloadCount" } } },
      ]),
      Student.countDocuments({ points: { $gt: student.points } }),
      Student.countDocuments({
        university: student.university,
        department: student.department,
        level: student.level,
        points: { $gt: student.points },
      }),
    ]);

  return {
    approvedUploadCount,
    approvedPastQuestionCount,
    totalDownloads: downloadAgg[0]?.total ?? 0,
    uploadStreakDays: student.uploadStreakDays,
    lifetimePointsEarned: student.lifetimePointsEarned,
    isAmbassador: student.isAmbassador,
    isVerifiedContributor: student.isVerifiedContributor,
    departmentRank: deptAhead + 1,
    globalRank: globalAhead + 1,
  };
}

/**
 * Checks every badge the student hasn't earned yet and awards any newly met.
 * Called after point-earning events (document approval) and after an admin
 * toggles isVerifiedContributor.
 */
export async function evaluateBadgesForStudent(studentId: string): Promise<BadgeDoc[]> {
  const stats = await computeStudentStats(studentId);
  if (!stats) return [];

  const [allBadges, earned] = await Promise.all([
    Badge.find(),
    StudentBadge.find({ student: studentId }).select("badge"),
  ]);
  const earnedIds = new Set(earned.map((e) => e.badge.toString()));

  const newlyEarned: BadgeDoc[] = [];
  for (const badge of allBadges) {
    if (earnedIds.has(badge._id.toString())) continue;
    if (await meetsCriteria(badge, stats)) {
      await StudentBadge.create({ student: studentId, badge: badge._id, earnedAt: new Date() });
      await awardBonusPoints(studentId, badge.points, `Badge unlocked: ${badge.name}`, {
        refType: "Badge",
        refId: badge._id,
      });
      newlyEarned.push(badge);
    }
  }

  return newlyEarned;
}
