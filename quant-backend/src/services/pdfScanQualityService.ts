import type { RenderedPdfPage } from "./pdfPageInspectionService";

export const MIN_SHARPNESS_SCORE = 12;
export const MIN_CONTRAST_SCORE = 8;
export const CRITICAL_SHARPNESS_SCORE = 3;
export const CRITICAL_CONTRAST_SCORE = 4;
export const EXTREME_BRIGHTNESS_THRESHOLD = 248;
export const EXTREME_DARKNESS_THRESHOLD = 8;
export const MAX_EXTREME_PIXEL_RATIO = 0.995;
export const MAX_BAD_PAGE_RATIO = 0.75;

export type PageScanQuality = {
  sharpnessScore: number;
  contrastScore: number;
  extremeBrightnessRatio: number;
  extremeDarknessRatio: number;
  needsReview: boolean;
  criticallyBad: boolean;
};

export type ScanQualitySummary = {
  status: "clear" | "review";
  badPageCount: number;
  pageCount: number;
  badPageRatio: number;
};

function calculateMean(values: Float32Array): number {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function calculateVariance(values: Float32Array, mean: number): number {
  let squaredDifferenceTotal = 0;
  for (const value of values) {
    const difference = value - mean;
    squaredDifferenceTotal += difference * difference;
  }
  return squaredDifferenceTotal / values.length;
}

function calculateLaplacianVariance(
  grayscale: Float32Array,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  let laplacianTotal = 0;
  let laplacianSquaredTotal = 0;
  let sampleCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian =
        4 * grayscale[index] -
        grayscale[index - 1] -
        grayscale[index + 1] -
        grayscale[index - width] -
        grayscale[index + width];
      laplacianTotal += laplacian;
      laplacianSquaredTotal += laplacian * laplacian;
      sampleCount += 1;
    }
  }

  if (sampleCount === 0) return 0;
  const mean = laplacianTotal / sampleCount;
  return laplacianSquaredTotal / sampleCount - mean * mean;
}

export function calculatePageScanQuality(
  renderedPage: RenderedPdfPage,
): PageScanQuality {
  const { grayscale, width, height } = renderedPage;
  const meanBrightness = calculateMean(grayscale);
  const contrastScore = Math.sqrt(calculateVariance(grayscale, meanBrightness));
  const sharpnessScore = calculateLaplacianVariance(grayscale, width, height);

  let brightPixelCount = 0;
  let darkPixelCount = 0;
  for (const brightness of grayscale) {
    if (brightness >= EXTREME_BRIGHTNESS_THRESHOLD) brightPixelCount += 1;
    if (brightness <= EXTREME_DARKNESS_THRESHOLD) darkPixelCount += 1;
  }

  const extremeBrightnessRatio = brightPixelCount / grayscale.length;
  const extremeDarknessRatio = darkPixelCount / grayscale.length;
  const hasExtremeExposure =
    extremeBrightnessRatio >= MAX_EXTREME_PIXEL_RATIO ||
    extremeDarknessRatio >= MAX_EXTREME_PIXEL_RATIO;
  const needsReview =
    sharpnessScore < MIN_SHARPNESS_SCORE ||
    contrastScore < MIN_CONTRAST_SCORE ||
    hasExtremeExposure;
  const criticallyBad =
    sharpnessScore < CRITICAL_SHARPNESS_SCORE ||
    contrastScore < CRITICAL_CONTRAST_SCORE ||
    (hasExtremeExposure && contrastScore < MIN_CONTRAST_SCORE);

  return {
    sharpnessScore,
    contrastScore,
    extremeBrightnessRatio,
    extremeDarknessRatio,
    needsReview,
    criticallyBad,
  };
}

export function summarizeScanQuality(
  pageQuality: PageScanQuality[],
): ScanQualitySummary {
  const badPageCount = pageQuality.filter((page) => page.criticallyBad).length;
  const hasQuestionablePage = pageQuality.some((page) => page.needsReview);
  const pageCount = pageQuality.length;
  const badPageRatio = pageCount === 0 ? 0 : badPageCount / pageCount;

  return {
    status: hasQuestionablePage ? "review" : "clear",
    badPageCount,
    pageCount,
    badPageRatio,
  };
}
