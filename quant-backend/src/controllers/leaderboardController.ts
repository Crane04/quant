import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { getTopContributors, getMyRank } from "../services/leaderboardService";

export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const [entries, me] = await Promise.all([getTopContributors(limit), getMyRank(req.studentId!)]);
  sendSuccess(res, { entries, me });
});
