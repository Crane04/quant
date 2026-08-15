import { Schema, model, Types, InferSchemaType } from "mongoose";

export type SessionActorType = "Student" | "Admin";

const sessionSchema = new Schema(
  {
    actorType: { type: String, enum: ["Student", "Admin"], required: true },
    actorId: { type: Schema.Types.ObjectId, required: true, refPath: "actorType" },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ actorType: 1, actorId: 1 });

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };
export const Session = model("Session", sessionSchema);
