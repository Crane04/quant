import type { RenderedPdfPage } from "./pdfPageInspectionService";

const D_HASH_WIDTH = 9;
const D_HASH_HEIGHT = 8;

function averageRegion(
  grayscale: Float32Array,
  pageWidth: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
): number {
  let total = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      total += grayscale[y * pageWidth + x];
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

function getDownsampledBrightness(
  renderedPage: RenderedPdfPage,
): number[][] {
  const { grayscale, width, height } = renderedPage;
  const downsampledBrightness: number[][] = [];

  for (let y = 0; y < D_HASH_HEIGHT; y += 1) {
    const startY = Math.floor((y * height) / D_HASH_HEIGHT);
    const endY = Math.min(
      height,
      Math.max(startY + 1, Math.floor(((y + 1) * height) / D_HASH_HEIGHT)),
    );
    const row: number[] = [];

    for (let x = 0; x < D_HASH_WIDTH; x += 1) {
      const startX = Math.floor((x * width) / D_HASH_WIDTH);
      const endX = Math.min(
        width,
        Math.max(startX + 1, Math.floor(((x + 1) * width) / D_HASH_WIDTH)),
      );
      row.push(
        averageRegion(grayscale, width, startX, endX, startY, endY),
      );
    }

    downsampledBrightness.push(row);
  }

  return downsampledBrightness;
}

export function createPageFingerprint(renderedPage: RenderedPdfPage): string {
  const brightness = getDownsampledBrightness(renderedPage);
  let hash = 0n;

  for (let y = 0; y < D_HASH_HEIGHT; y += 1) {
    for (let x = 0; x < D_HASH_WIDTH - 1; x += 1) {
      hash <<= 1n;
      if (brightness[y][x] > brightness[y][x + 1]) hash |= 1n;
    }
  }

  return hash.toString(16).padStart(16, "0");
}

export function calculateFingerprintHammingDistance(
  firstFingerprint: string,
  secondFingerprint: string,
): number {
  try {
    let difference = BigInt(`0x${firstFingerprint}`) ^ BigInt(`0x${secondFingerprint}`);
    let distance = 0;

    while (difference > 0n) {
      distance += 1;
      difference &= difference - 1n;
    }

    return distance;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
