import { Schema, model, Types, InferSchemaType } from "mongoose";

const rewardRedemptionSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    reward: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
    pointsCost: { type: Number, required: true }, // snapshot, in case the catalog changes later
    status: { type: String, enum: ["success", "failed"], default: "success" },
    selectedSize: { type: String },
    voucherCode: { type: String },
    expiresAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true },
);

rewardRedemptionSchema.index({ student: 1, createdAt: -1 });

export type RewardRedemptionDoc = InferSchemaType<
  typeof rewardRedemptionSchema
> & {
  _id: Types.ObjectId;
};
export const RewardRedemption = model(
  "RewardRedemption",
  rewardRedemptionSchema,
);
