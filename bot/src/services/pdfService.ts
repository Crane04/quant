import { PDFDocument, IDocument } from "../models/Document";

export const findByCourseCode = async (query: string): Promise<IDocument[]> => {
  const normalized = query
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Try exact course code match first (global search, no department/level filters)
  const codeQuery = {
    courseCode: { $regex: new RegExp(escapeRegExp(normalized), "i") },
  };
  let docs = await PDFDocument.find(codeQuery).sort({ title: 1 });

  // Fall back to course name match (global)
  if (docs.length === 0) {
    const nameQuery = { courseName: { $regex: new RegExp(query.trim(), "i") } };
    docs = await PDFDocument.find(nameQuery).sort({ title: 1 });
  }

  return docs;
};

export const searchDocuments = async (query: string): Promise<IDocument[]> => {
  const docs = await PDFDocument.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } },
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
