import { createCanvas } from "@napi-rs/canvas";
import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api.js";

export const PDF_PAGE_INSPECTION_SCALE = 0.25;
const MINIMUM_OPAQUE_ALPHA = 16;

export type RenderedPdfPage = {
  width: number;
  height: number;
  grayscale: Float32Array;
};

export async function renderPdfPageForInspection(
  page: PDFPageProxy,
): Promise<RenderedPdfPage> {
  const viewport = page.getViewport({ scale: PDF_PAGE_INSPECTION_SCALE });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const context = canvas.getContext("2d");

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise;

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const grayscale = new Float32Array(canvas.width * canvas.height);

  for (
    let pixelIndex = 0, grayscaleIndex = 0;
    pixelIndex < pixels.length;
    pixelIndex += 4, grayscaleIndex += 1
  ) {
    const alpha = pixels[pixelIndex + 3];
    if (alpha < MINIMUM_OPAQUE_ALPHA) {
      grayscale[grayscaleIndex] = 255;
      continue;
    }

    const red = pixels[pixelIndex];
    const green = pixels[pixelIndex + 1];
    const blue = pixels[pixelIndex + 2];
    grayscale[grayscaleIndex] = 0.299 * red + 0.587 * green + 0.114 * blue;
  }

  return { width: canvas.width, height: canvas.height, grayscale };
}
