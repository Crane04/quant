import { Schema, model, Types, InferSchemaType } from "mongoose";

const badgeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true }, // stable id, e.g. "first_upload"
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "upload_milestones",
        "streak_achievements",
        "rank_prestige",
        "special_recognition",
        "social_impact",
      ],
      required: true,
    },
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum", "diamond", "obsidian"],
      required: true,
    },
    points: { type: Number, required: true }, // bonus points awarded on unlock

    // How evaluateBadgesForStudent checks eligibility. `criteriaValue` is the
    // threshold for count/streak/rank types; ignored for "manual_flag".
    criteriaType: {
      type: String,
      enum: [
        "upload_count",
        "past_question_upload_count",
        "streak_days",
        "department_rank",
        "global_rank",
        "lifetime_points",
        "lifetime_points_ambassador",
        "download_count",
        "manual_flag",
      ],
      required: true,
    },
    criteriaValue: { type: Number },
  },
  { timestamps: true },
);

export type BadgeDoc = InferSchemaType<typeof badgeSchema> & {
  _id: Types.ObjectId;
};
export const Badge = model("Badge", badgeSchema);
