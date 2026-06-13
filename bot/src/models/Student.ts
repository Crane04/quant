import mongoose, { Document, Schema } from "mongoose";

export interface IStudent extends Document {
  phoneNumber: string; // WhatsApp number e.g. "whatsapp:+2348012345678"
  name: string;
  school: string;
  faculty: string;
  matricNumber: string;
  department: string;
  level: string;
  semester: "first" | "second";
  currentCgpa?: number;
  targetCgpa?: number;
  assignments: Array<{
    courseCode: string;
    description: string;
    dueDate: Date;
    reminderSent: boolean;
    createdAt: Date;
  }>;
  registeredAt: Date;
  lastActive: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    phoneNumber: { type: String, required: true, unique: true },
    name: { type: String, default: "Student" },
    school: { type: String, trim: true },
    faculty: { type: String, trim: true },
    matricNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    level: { type: String, enum: ["100", "200", "300", "400", "500"] },
    semester: { type: String, enum: ["first", "second"] },
    currentCgpa: { type: Number, min: 0, max: 5 },
    targetCgpa: { type: Number, min: 0, max: 5 },
    assignments: [
      {
        courseCode: { type: String, required: true, trim: true, uppercase: true },
        description: { type: String, required: true, trim: true },
        dueDate: { type: Date, required: true },
        reminderSent: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    registeredAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Student = mongoose.model<IStudent>("Student", StudentSchema);
