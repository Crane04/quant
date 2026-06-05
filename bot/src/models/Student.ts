import mongoose, { Document, Schema } from "mongoose";

export interface IStudent extends Document {
  phoneNumber: string; // WhatsApp number e.g. "whatsapp:+2348012345678"
  name: string;
  matricNumber: string;
  department: string;
  level: string;
  semester: "first" | "second";
  registeredAt: Date;
  lastActive: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    phoneNumber: { type: String, required: true, unique: true },
    name: { type: String, default: "Student" },
    matricNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    level: { type: String, enum: ["100", "200", "300", "400", "500"] },
    semester: { type: String, enum: ["first", "second"] },
    registeredAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Student = mongoose.model<IStudent>("Student", StudentSchema);
