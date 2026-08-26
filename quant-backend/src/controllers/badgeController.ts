import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Badge } from "../models/Badge";
import { StudentBadge } from "../models/StudentBadge";

// Full catalog with per-student earned/earnedAt merged in — powers the
// Account > Badges & Achievements page (All / Earned / Locked tabs are a
// client-side filter over this one list).
export const getMyBadges = asyncHandler(async (req: Request, res: Response) => {
  const [badges, earned] = await Promise.all([
    Badge.find().sort({ category: 1, points: 1 }),
    StudentBadge.find({ student: req.studentId }),
  ]);
  const earnedByBadge = new Map(earned.map((e) => [e.badge.toString(), e.earnedAt]));

  const data = badges.map((b) => ({
    id: b._id.toString(),
    key: b.key,
    name: b.name,
    description: b.description,
    category: b.category,
    tier: b.tier,
    points: b.points,
    earned: earnedByBadge.has(b._id.toString()),
    earnedAt: earnedByBadge.get(b._id.toString()) ?? null,
  }));

  sendSuccess(res, data);
});
