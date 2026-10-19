import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { DriveImport } from "../models/DriveImport";
import { startDriveImport, summarize } from "../services/driveImportService";

export const createDriveImport = asyncHandler(
  async (req: Request, res: Response) => {
    const job = await startDriveImport(
      req.body.url,
      req.body.category,
      req.admin!.id,
    );
    sendSuccess(res, { ...job.toJSON(), summary: summarize(job) }, undefined, 202);
  },
);

export const listDriveImports = asyncHandler(
  async (_req: Request, res: Response) => {
    const jobs = await DriveImport.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("createdBy", "email");
    sendSuccess(
      res,
      jobs.map((job) => {
        const { items: _items, ...rest } = job.toJSON();
        return { ...rest, summary: summarize(job) };
      }),
    );
  },
);

export const getDriveImport = asyncHandler(
  async (req: Request, res: Response) => {
    const job = await DriveImport.findById(req.params.id).populate(
      "createdBy",
      "email",
    );
    if (!job) throw ApiError.notFound("Import not found");
    sendSuccess(res, { ...job.toJSON(), summary: summarize(job) });
  },
);
