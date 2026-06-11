import { IDocument, PDFDocument } from "../models/Document";
import { deletePdf, uploadPdf } from "./cloudinaryService";

type DocumentFilters = {
  courseCode?: unknown;
  level?: unknown;
  department?: unknown;
  semester?: unknown;
  search?: unknown;
};

type CreateDocumentInput = {
  title: string;
  courseCode: string;
  courseName: string;
  faculty?: string;
  department: string;
  level: string;
  semester: string;
  tags?: string;
  file: Express.Multer.File;
};

type CreateDocumentFromBufferInput = {
  title: string;
  courseCode: string;
  courseName: string;
  faculty?: string;
  department: string;
  level: string;
  semester: string;
  tags?: string;
  buffer: Buffer;
  fileSize: number;
  sourceDriveFileId?: string;
};

const editableDocumentFields = [
  "title",
  "courseCode",
  "courseName",
  "faculty",
  "department",
  "level",
  "semester",
  "tags",
];

const buildDocumentFilter = ({
  courseCode,
  level,
  department,
  semester,
  search,
}: DocumentFilters): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (courseCode) filter.courseCode = { $regex: courseCode as string, $options: "i" };
  if (level) filter.level = level;
  if (department) filter.department = { $regex: department as string, $options: "i" };
  if (semester) filter.semester = semester;
  if (search) filter.$text = { $search: search as string };

  return filter;
};

const getDocumentUpdates = (body: Record<string, unknown>): Record<string, unknown> => {
  const updates: Record<string, unknown> = {};

  for (const key of editableDocumentFields) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  return updates;
};

const parseTags = (tags?: string): string[] => {
  return tags ? tags.split(",").map((tag) => tag.trim()) : [];
};

export const createDocumentWithPdf = async ({
  title,
  courseCode,
  courseName,
  faculty,
  department,
  level,
  semester,
  tags,
  file,
}: CreateDocumentInput): Promise<IDocument> => {
  return createDocumentFromBuffer({
    title,
    courseCode,
    courseName,
    faculty,
    department,
    level,
    semester,
    tags,
    buffer: file.buffer,
    fileSize: file.size,
  });
};

export const createDocumentFromBuffer = async ({
  title,
  courseCode,
  courseName,
  faculty,
  department,
  level,
  semester,
  tags,
  buffer,
  fileSize,
  sourceDriveFileId,
}: CreateDocumentFromBufferInput): Promise<IDocument> => {
  const uploadResult = await uploadPdf(buffer, courseCode);

  return PDFDocument.create({
    title,
    courseCode: courseCode.toUpperCase(),
    courseName,
    faculty: faculty || "General",
    department,
    level,
    semester,
    tags: parseTags(tags),
    cloudinaryUrl: uploadResult.secure_url,
    cloudinaryPublicId: uploadResult.public_id,
    sourceDriveFileId,
    fileSize,
  });
};

export const listDocuments = async (filters: DocumentFilters): Promise<IDocument[]> => {
  return PDFDocument.find(buildDocumentFilter(filters)).sort({ createdAt: -1 });
};

export const getDocumentById = async (id: string): Promise<IDocument | null> => {
  return PDFDocument.findById(id);
};

export const updateDocumentById = async (
  id: string,
  body: Record<string, unknown>
): Promise<IDocument | null> => {
  return PDFDocument.findByIdAndUpdate(id, getDocumentUpdates(body), { new: true });
};

export const deleteDocumentById = async (id: string): Promise<IDocument | null> => {
  const doc = await PDFDocument.findById(id);

  if (!doc) return null;

  await deletePdf(doc.cloudinaryPublicId);
  await doc.deleteOne();

  return doc;
};
