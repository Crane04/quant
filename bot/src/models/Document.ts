import mongoose, { Document, Schema } from "mongoose";

export interface IDocument extends Document {
  title: string;
  courseCode: string;
  courseName: string;
  faculty: string;
  department: string;
  level: string; // "100", "200", "300", "400", "500"
  semester: "first" | "second";
  tags: string[]; // e.g. ["week1", "thermodynamics", "lecture"]
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  sourceDriveFileId?: string;
  fileSize: number; // bytes
  uploadedAt: Date;
  downloadCount: number;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, trim: true },
    courseCode: { type: String, required: true, trim: true, uppercase: true },
    courseName: { type: String, required: true, trim: true },
    faculty: { type: String, required: true, default: "General" },
    department: { type: String, required: true, trim: true },
    level: {
      type: String,
      required: true,
      enum: ["100", "200", "300", "400", "500"],
    },
    semester: { type: String, required: true, enum: ["first", "second"] },
    tags: [{ type: String, lowercase: true, trim: true }],
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    sourceDriveFileId: { type: String, trim: true },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// text index for search
DocumentSchema.index({
  title: "text",
  courseCode: "text",
  courseName: "text",
  tags: "text",
});

DocumentSchema.index({ courseCode: 1, level: 1 });
DocumentSchema.index({ sourceDriveFileId: 1 }, { unique: true, sparse: true });

export const PDFDocument = mongoose.model<IDocument>(
  "PDFDocument",
  DocumentSchema
);
