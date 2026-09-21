import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const THUMBNAIL_RENDER_SCALE = 0.5;

export async function generatePdfThumbnail(pdfBuffer: Buffer): Promise<Buffer> {
  const pdf = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: THUMBNAIL_RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

  await page.render({
    canvas,
    canvasContext: canvas.getContext("2d"),
    viewport,
  }).promise;

  return canvas.toBuffer("image/png");
}
