import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const MAX_SEMANTIC_VALIDATION_IMAGES = 3;
const SEMANTIC_PAGE_RENDER_SCALE = 0.75;

function uniquePageNumbers(pageNumbers: number[], pageCount: number): number[] {
  return [...new Set(pageNumbers)].filter(
    (pageNumber) => pageNumber >= 1 && pageNumber <= pageCount,
  );
}

/** Selects an early, interior, and later meaningful page without retaining page images. */
export function selectSemanticSamplePages(
  pageCount: number,
  meaningfulPageNumbers: number[],
): number[] {
  const candidates = uniquePageNumbers(meaningfulPageNumbers, pageCount);
  const pages =
    candidates.length > 0
      ? candidates
      : Array.from({ length: pageCount }, (_, index) => index + 1);

  if (pages.length === 0) return [];

  return uniquePageNumbers(
    [
      pages[0],
      pages[Math.floor((pages.length - 1) / 2)],
      pages[pages.length - 1],
    ],
    pageCount,
  ).slice(0, MAX_SEMANTIC_VALIDATION_IMAGES);
}

/** Renders only the previously selected semantic-review pages. */
export async function renderSemanticSamplePages(
  pdfBuffer: Buffer,
  pageNumbers: number[],
): Promise<Buffer[]> {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;

  try {
    const selectedPages = uniquePageNumbers(pageNumbers, pdf.numPages).slice(
      0,
      MAX_SEMANTIC_VALIDATION_IMAGES,
    );
    const images: Buffer[] = [];

    for (const pageNumber of selectedPages) {
      const page = await pdf.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: SEMANTIC_PAGE_RENDER_SCALE });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        const context = canvas.getContext("2d");

        await page.render({ canvas, canvasContext: context, viewport }).promise;
        images.push(canvas.toBuffer("image/png"));
      } finally {
        page.cleanup();
      }
    }

    return images;
  } finally {
    await loadingTask.destroy();
  }
}
