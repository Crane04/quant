import { Request, Response } from "express";
import {
  createDocumentWithPdf,
  deleteDocumentById,
  getDocumentById,
  listDocuments as listDocumentsService,
  updateDocumentById,
} from "../services/documentService";
import { sendError, sendSuccess } from "../utils/apiResponse";

export const createDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, "No PDF file uploaded", 400);
      return;
    }

    const { title, courseCode, courseName, faculty, department, level, semester, tags } =
      req.body;

    if (!title || !courseCode || !courseName || !department || !level || !semester) {
      sendError(res, "Missing required fields", 400);
      return;
    }

    const doc = await createDocumentWithPdf({
      title,
      courseCode,
      courseName,
      faculty,
      department,
      level,
      semester,
      tags,
      file: req.file,
    });

    sendSuccess(res, { document: doc }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    sendError(res, message);
  }
};

export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const docs = await listDocumentsService(req.query);
    sendSuccess(res, { count: docs.length, documents: docs });
  } catch {
    sendError(res, "Failed to fetch documents");
  }
};

export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getDocumentById(req.params.id);

    if (!doc) {
      sendError(res, "Not found", 404);
      return;
    }

    sendSuccess(res, { document: doc });
  } catch {
    sendError(res, "Fetch failed");
  }
};

export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await updateDocumentById(req.params.id, req.body);

    if (!doc) {
      sendError(res, "Not found", 404);
      return;
    }

    sendSuccess(res, { document: doc });
  } catch {
    sendError(res, "Update failed");
  }
};

export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await deleteDocumentById(req.params.id);

    if (!doc) {
      sendError(res, "Not found", 404);
      return;
    }

    sendSuccess(res, { message: "Deleted" });
  } catch {
    sendError(res, "Delete failed");
  }
};
