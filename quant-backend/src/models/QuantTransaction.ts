import { Schema, model, Types, InferSchemaType } from "mongoose";

// Ledger for quants — the chat currency (₦1 = 1 quant). Every balance change
// gets a row, so a student's balance can always be reconciled against it.
const quantTransactionSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    type: {
      type: String,
      enum: ["topup", "chat_message", "reward_conversion", "admin_adjustment"],
      required: true,
    },
    amount: { type: Number, required: true }, // positive = credited, negative = spent
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true, trim: true },

    refType: { type: String, enum: ["Payment", "RewardRedemption"] },
    refId: { type: Schema.Types.ObjectId, refPath: "refType" },

    // admin_adjustment only — which admin granted/removed the quants.
    adjustedBy: { type: Schema.Types.ObjectId, ref: "Admin" },

    // chat_message only — the inputs to the QuantPricing formula, so a charge
    // can be explained and rates tuned against real usage.
    inputChars: { type: Number },
    costBreakdown: {
      perMessage: { type: Number },
      length: { type: Number },
      aiTokens: { type: Number },
      total: { type: Number },
    },
    groqUsage: {
      promptTokens: { type: Number },
      completionTokens: { type: Number },
    },
  },
  { timestamps: true },
);

quantTransactionSchema.index({ student: 1, createdAt: -1 });
quantTransactionSchema.index({ type: 1, createdAt: -1 });

export type QuantTransactionDoc = InferSchemaType<
  typeof quantTransactionSchema
> & {
  _id: Types.ObjectId;
};
export const QuantTransaction = model(
  "QuantTransaction",
  quantTransactionSchema,
);
