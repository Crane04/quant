import { Schema, model, Types, InferSchemaType } from "mongoose";

const pointsTransactionSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    type: {
      type: String,
      enum: ["document_approved", "badge_bonus", "reward_redeemed", "admin_adjustment"],
      required: true,
    },
    amount: { type: Number, required: true }, // positive = earned, negative = spent
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true, trim: true },

    // Optional polymorphic reference to whatever caused this transaction
    // (a DocumentFile, a Badge, a RewardRedemption).
    refType: { type: String, enum: ["DocumentFile", "Badge", "RewardRedemption"] },
    refId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

pointsTransactionSchema.index({ student: 1, createdAt: -1 });

export type PointsTransactionDoc = InferSchemaType<typeof pointsTransactionSchema> & {
  _id: Types.ObjectId;
};
export const PointsTransaction = model("PointsTransaction", pointsTransactionSchema);
