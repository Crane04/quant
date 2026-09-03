import { Schema, model, Types, InferSchemaType } from "mongoose";

const rewardSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true }, // stable id, e.g. "tokens_50"
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["token_conversion", "voucher", "merchandise"],
      required: true,
    },
    pointsCost: { type: Number, required: true },
    tokensGranted: { type: Number }, // only for type "token_conversion"
    requiresSize: { type: Boolean, default: false },
    sizes: { type: [String], default: [] }, // e.g. ["S", "M", "L", "XL"]
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type RewardDoc = InferSchemaType<typeof rewardSchema> & {
  _id: Types.ObjectId;
};
export const Reward = model("Reward", rewardSchema);
