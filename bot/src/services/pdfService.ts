import { PDFDocument, IDocument } from "../models/Document";

export const findByCourseCode = async (
  query: string,
  filters: { department?: string; level?: string } = {}
): Promise<IDocument[]> => {
  const normalized = query.trim().toUpperCase().replace(/\s+/g, " ");
  const profileFilter: Record<string, unknown> = {};

  if (filters.department) profileFilter.department = { $regex: filters.department, $options: "i" };
  if (filters.level) profileFilter.level = filters.level;

  // Try exact course code match first
  let docs = await PDFDocument.find({
    ...profileFilter,
    courseCode: { $regex: new RegExp(normalized, "i") },
  }).sort({ title: 1 });

  // Fall back to course name match
  if (docs.length === 0) {
    docs = await PDFDocument.find({
      ...profileFilter,
      courseName: { $regex: new RegExp(query.trim(), "i") },
    }).sort({ title: 1 });
  }

  return docs;
};

export const searchDocuments = async (query: string): Promise<IDocument[]> => {
  const docs = await PDFDocument.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(8);

  return docs;
};

export const findById = async (id: string): Promise<IDocument | null> => {
  return PDFDocument.findById(id);
};

export const incrementDownload = async (id: string): Promise<void> => {
  await PDFDocument.findByIdAndUpdate(id, { $inc: { downloadCount: 1 } });
};
