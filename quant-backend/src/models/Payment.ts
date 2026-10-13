import { Schema, model, Types, InferSchemaType } from "mongoose";

// One Flutterwave checkout attempt. Created "pending" when the pay link is
// generated; flipped to "successful" exactly once, by whichever of the webhook
// or the redirect page verifies it first — that flip is what credits quants.
const paymentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    txRef: { type: String, required: true, unique: true },
    amount: { type: Number, required: true }, // NGN
    quants: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    status: {
      type: String,
      enum: ["pending", "successful", "failed"],
      default: "pending",
    },
    flutterwaveTransactionId: { type: Number },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

paymentSchema.index({ student: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & {
  _id: Types.ObjectId;
};
export const Payment = model("Payment", paymentSchema);
