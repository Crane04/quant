import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import {
  adjustQuants,
  getPricing,
  getQuantHistory,
  getRecentUsageStats,
  listTransactions,
  TransactionFilters,
  updatePricing,
} from "../services/quantService";

// Pricing plus last-7-day averages, so the admin page can preview a typical
// message's cost under the current (or edited) rates.
export const getQuantPricing = asyncHandler(
  async (_req: Request, res: Response) => {
    const [pricing, stats] = await Promise.all([
      getPricing(),
      getRecentUsageStats(),
    ]);
    sendSuccess(res, { pricing, stats });
  },
);

export const adjustStudentQuants = asyncHandler(
  async (req: Request, res: Response) => {
    const { amount, reason } = req.body as { amount: number; reason: string };
    const result = await adjustQuants(
      req.params.studentId,
      amount,
      reason,
      req.admin?.id,
    );
    sendSuccess(res, result, amount > 0 ? "Quants added" : "Quants removed");
  },
);

export const getStudentQuantHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    sendSuccess(res, await getQuantHistory(req.params.studentId, limit));
  },
);

export const getTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await listTransactions(req.query as unknown as TransactionFilters),
    );
  },
);

export const updateQuantPricing = asyncHandler(
  async (req: Request, res: Response) => {
    const pricing = await updatePricing(req.body, req.admin?.id);
    sendSuccess(res, pricing, "Pricing updated");
  },
);
