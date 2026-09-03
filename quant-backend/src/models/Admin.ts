import { Schema, model, Types, InferSchemaType } from "mongoose";

const adminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "admin"], default: "admin" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type AdminRole = "super_admin" | "admin";
export type AdminDoc = InferSchemaType<typeof adminSchema> & {
  _id: Types.ObjectId;
};
export const Admin = model("Admin", adminSchema);
