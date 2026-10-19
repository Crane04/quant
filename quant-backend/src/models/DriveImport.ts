import { Schema, model, Types, InferSchemaType } from "mongoose";

export const DRIVE_IMPORT_ITEM_STATUSES = [
  "pending",
  "imported",
  "duplicate", // already in the library (same Drive file or same file bytes)
  "no_course", // no known course code in the file name or folder path
  "unsupported", // not a PDF/DOCX/PPTX/Google Doc/Google Slides
  "failed",
] as const;

const driveImportItemSchema = new Schema(
  {
    driveFileId: { type: String, required: true },
    name: { type: String, required: true },
    path: { type: String, default: "" },
    mimeType: { type: String, required: true },
    status: {
      type: String,
      enum: DRIVE_IMPORT_ITEM_STATUSES,
      default: "pending",
    },
    reason: { type: String },
    courseCode: { type: String },
    document: { type: Schema.Types.ObjectId, ref: "DocumentFile" },
  },
  { _id: false },
);

// One pasted Drive link. Runs in the background; the admin page polls it.
const driveImportSchema = new Schema(
  {
    url: { type: String, required: true },
    folderName: { type: String },
    // "auto" = from each file name ("past questions" -> past_question, …).
    category: {
      type: String,
      enum: ["auto", "lecture_note", "exam_summary", "past_question", "other"],
      default: "auto",
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    error: { type: String },
    items: { type: [driveImportItemSchema], default: [] },
    // Courses this import had to create for codes the catalogue didn't have —
    // titled with just the code, so worth a look in Courses afterwards.
    createdCourses: {
      type: [
        {
          _id: false,
          code: { type: String, required: true },
          course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
        },
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    finishedAt: { type: Date },
  },
  { timestamps: true },
);

driveImportSchema.index({ createdAt: -1 });

export type DriveImportDoc = InferSchemaType<typeof driveImportSchema> & {
  _id: Types.ObjectId;
};
export const DriveImport = model("DriveImport", driveImportSchema);
