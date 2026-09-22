import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api.js";
import { logger } from "../utils/logger";
import { withValidatedPdfBuffer } from "./pdfValidationService";
import {
  renderPdfPageForInspection,
  PDF_PAGE_INSPECTION_SCALE,
} from "./pdfPageInspectionService";
import { createPageFingerprint } from "./pdfPageFingerprintService";
import {
  calculatePageScanQuality,
  MAX_BAD_PAGE_RATIO,
  summarizeScanQuality,
  type PageScanQuality,
  type ScanQualitySummary,
} from "./pdfScanQualityService";

export const BLANK_PAGE_RENDER_SCALE = PDF_PAGE_INSPECTION_SCALE;
export const BACKGROUND_BRIGHTNESS_PERCENTILE = 0.9;
export const MINIMUM_CONTENT_CONTRAST = 18;
export const MINIMUM_MEANINGFUL_CONTENT_RATIO = 0.0015;

export type PdfDocumentInspection = {
  isBlank: boolean;
  pageCount: number;
  meaningfulPageNumbers: number[];
  pageFingerprints: string[];
  scanQuality: ScanQualitySummary;
};

function estimateBackgroundBrightness(grayscale: Float32Array): number {
  const sortedValues = Array.from(grayscale).sort((a, b) => a - b);
  const backgroundIndex = Math.floor(
    (sortedValues.length - 1) * BACKGROUND_BRIGHTNESS_PERCENTILE,
  );
  return sortedValues[backgroundIndex];
}

function pageHasMeaningfulContent(grayscale: Float32Array): boolean {
  const backgroundBrightness = estimateBackgroundBrightness(grayscale);
  let meaningfulPixelCount = 0;

  for (const brightness of grayscale) {
    if (
      Math.abs(brightness - backgroundBrightness) >= MINIMUM_CONTENT_CONTRAST
    ) {
      meaningfulPixelCount += 1;
    }
  }

  return meaningfulPixelCount / grayscale.length >= MINIMUM_MEANINGFUL_CONTENT_RATIO;
}

function getFallbackInspection(): PdfDocumentInspection {
  return {
    isBlank: false,
    pageCount: 0,
    meaningfulPageNumbers: [],
    pageFingerprints: [],
    scanQuality: {
      status: "review",
      badPageCount: 0,
      pageCount: 0,
      badPageRatio: 0,
    },
  };
}

async function inspectPdfPages(
  pdf: PDFDocumentProxy,
): Promise<PdfDocumentInspection> {
  const contentResults: boolean[] = [];
  const meaningfulPageNumbers: number[] = [];
  const pageFingerprints: string[] = [];
  const qualityResults: PageScanQuality[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    try {
      const renderedPage = await renderPdfPageForInspection(page);
      const hasMeaningfulContent = pageHasMeaningfulContent(
        renderedPage.grayscale,
      );
      contentResults.push(hasMeaningfulContent);
      if (hasMeaningfulContent) meaningfulPageNumbers.push(pageNumber);
      pageFingerprints.push(createPageFingerprint(renderedPage));
      qualityResults.push(calculatePageScanQuality(renderedPage));
    } finally {
      page.cleanup();
    }
  }

  const scanQuality = summarizeScanQuality(qualityResults);
  return {
    isBlank: !contentResults.some(Boolean),
    pageCount: pdf.numPages,
    meaningfulPageNumbers,
    pageFingerprints,
    scanQuality,
  };
}

export async function inspectPdfBuffer(
  pdfBuffer: Buffer,
): Promise<PdfDocumentInspection> {
  return withValidatedPdfBuffer(pdfBuffer, async (pdf) => {
    try {
      return await inspectPdfPages(pdf);
    } catch (error) {
      logger.warn("Failed to inspect PDF pages", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return getFallbackInspection();
    }
  });
}

export async function isPdfEffectivelyBlank(pdfBuffer: Buffer): Promise<boolean> {
  const inspection = await inspectPdfBuffer(pdfBuffer);
  return inspection.isBlank;
}

export function shouldRejectForScanQuality(
  scanQuality: ScanQualitySummary,
): boolean {
  return scanQuality.badPageRatio >= MAX_BAD_PAGE_RATIO;
}
