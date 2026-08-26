import crypto from "crypto";
import { Reward, RewardDoc } from "../models/Reward";
import { RewardRedemption, RewardRedemptionDoc } from "../models/RewardRedemption";
import { Student } from "../models/Student";
import { PointsTransaction } from "../models/PointsTransaction";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

// The fixed 6-item catalog (Rewards page). Seeded once on startup and upserted
// by `key` so re-running is safe if the catalog changes.
const DEFAULT_REWARDS: Array<Omit<RewardDoc, "_id" | "createdAt" | "updatedAt">> = [
  {
    key: "tokens_50",
    name: "50 Quant Tokens",
    description: "Convert your points into 50 tokens to unlock premium platform tools and study features.",
    type: "token_conversion",
    pointsCost: 200,
    tokensGranted: 50,
    requiresSize: false,
    sizes: [],
    active: true,
  },
  {
    key: "tokens_100",
    name: "100 Quant Tokens",
    description: "Bank 100 tokens to access advanced features, detailed study materials, and platform utilities.",
    type: "token_conversion",
    pointsCost: 400,
    tokensGranted: 100,
    requiresSize: false,
    sizes: [],
    active: true,
  },
  {
    key: "airtime_voucher",
    name: "Mobile Airtime Voucher",
    description: "Receive direct airtime top-ups to stay connected, make calls, or buy internet data packages.",
    type: "voucher",
    pointsCost: 500,
    requiresSize: false,
    sizes: [],
    active: true,
  },
  {
    key: "branded_journal",
    name: "Branded Journal",
    description: "Claim a custom Quant notebook to organize your daily lecture notes, project tasks, and study schedules.",
    type: "merchandise",
    pointsCost: 1000,
    requiresSize: false,
    sizes: [],
    active: true,
  },
  {
    key: "branded_tshirt",
    name: "Branded T-Shirt",
    description: "Get a premium cotton Quant t-shirt delivered to you for contributing quality materials to your peers.",
    type: "merchandise",
    pointsCost: 2000,
    requiresSize: true,
    sizes: ["S", "M", "L", "XL"],
    active: true,
  },
  {
    key: "branded_hoodie",
    name: "Branded Hoodie",
    description: "Grab a heavy-grade Quant pullover hoodie to stay warm during late-night study sessions.",
    type: "merchandise",
    pointsCost: 2500,
    requiresSize: true,
    sizes: ["S", "M", "L", "XL"],
    active: true,
  },
];

export async function ensureDefaultRewards(): Promise<void> {
  for (const reward of DEFAULT_REWARDS) {
    await Reward.findOneAndUpdate({ key: reward.key }, reward, { upsert: true, new: true });
  }
  logger.info("Reward catalog seeded", { count: DEFAULT_REWARDS.length });
}

const VOUCHER_VALIDITY_DAYS = 90;

export async function redeemReward(
  studentId: string,
  rewardId: string,
  selectedSize?: string
): Promise<RewardRedemptionDoc> {
  const [student, reward] = await Promise.all([
    Student.findById(studentId),
    Reward.findById(rewardId),
  ]);
  if (!student) throw ApiError.notFound("Student not found");
  if (!reward || !reward.active) throw ApiError.notFound("Reward not found");

  if (reward.requiresSize && !selectedSize) {
    throw ApiError.badRequest("This reward requires a size");
  }
  if (reward.requiresSize && selectedSize && !reward.sizes.includes(selectedSize)) {
    throw ApiError.badRequest(`Invalid size. Choose one of: ${reward.sizes.join(", ")}`);
  }
  if (student.points < reward.pointsCost) {
    throw ApiError.badRequest("Insufficient points for this reward");
  }

  student.points -= reward.pointsCost;
  if (reward.type === "token_conversion") {
    student.tokens += reward.tokensGranted ?? 0;
  }
  await student.save();

  const redemption = await RewardRedemption.create({
    student: student._id,
    reward: reward._id,
    pointsCost: reward.pointsCost,
    status: "success",
    selectedSize,
    ...(reward.type === "voucher"
      ? {
          voucherCode: crypto.randomBytes(6).toString("hex").toUpperCase(),
          expiresAt: new Date(Date.now() + VOUCHER_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
        }
      : {}),
  });

  await PointsTransaction.create({
    student: student._id,
    type: "reward_redeemed",
    amount: -reward.pointsCost,
    balanceAfter: student.points,
    description: `Redeemed: ${reward.name}`,
    refType: "RewardRedemption",
    refId: redemption._id,
  });

  return redemption;
}
