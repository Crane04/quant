import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { Reward } from "../models/Reward";
import { RewardRedemption } from "../models/RewardRedemption";
import { redeemReward } from "../services/rewardService";

export const listRewards = asyncHandler(async (_req: Request, res: Response) => {
  const rewards = await Reward.find({ active: true }).sort({ pointsCost: 1 });
  sendSuccess(res, rewards);
});

export const redeem = asyncHandler(async (req: Request, res: Response) => {
  const { size } = req.body as { size?: string };
  const redemption = await redeemReward(req.studentId!, req.params.id, size);
  sendSuccess(res, redemption, "Redemption successful", 201);
});

export const getMyRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const redemptions = await RewardRedemption.find({ student: req.studentId })
    .populate("reward")
    .sort({ createdAt: -1 });
  sendSuccess(res, redemptions);
});

// Admin oversight of what's being redeemed (vouchers/merch fulfillment).
export const listAllRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const redemptions = await RewardRedemption.find()
    .populate("reward")
    .populate("student", "fullName email phone")
    .sort({ createdAt: -1 })
    .limit(200);
  sendSuccess(res, redemptions);
});
