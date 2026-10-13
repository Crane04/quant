import { Schema, model, Types, InferSchemaType } from "mongoose";

// Admin-editable pricing for AI replies, stored as a single document (key
// "default"). A message costs, rounded up and capped at maxPerMessage:
//
//   perMessage
//   + (student message chars / 100)   × per100Chars
//   + (Groq prompt tokens / 1000)     × per1kInputTokens
//   + (Groq completion tokens / 1000) × per1kOutputTokens
//
// Any rate set to 0 drops that component, so a flat price is just perMessage.
//
// Defaults aim at ~10 quants (₦10) for a typical reply — ~100 chars, ~12k
// prompt / ~1.5k completion tokens across the tool loop → 4 + 1 + 3.6 + 2.25
// = 11. The token rates sit above Groq's cost for gpt-oss-120b (~$0.15/M in,
// ~$0.60/M out ≈ ₦0.23 / ₦0.90 per 1k at ₦1,500/$), and the flat fee covers
// Flutterwave fees and margin. Recheck if the model, Groq prices or FX move.
const quantPricingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    billingEnabled: { type: Boolean, default: false },
    perMessage: { type: Number, default: 4, min: 0 },
    per100Chars: { type: Number, default: 1, min: 0 },
    per1kInputTokens: { type: Number, default: 0.3, min: 0 },
    per1kOutputTokens: { type: Number, default: 1.5, min: 0 },
    maxPerMessage: { type: Number, default: 40, min: 0 }, // 0 = no cap
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

export type QuantPricingDoc = InferSchemaType<typeof quantPricingSchema> & {
  _id: Types.ObjectId;
};
export const QuantPricing = model("QuantPricing", quantPricingSchema);
