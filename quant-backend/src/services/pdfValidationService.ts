import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api.js";

export type PdfValidationFailure = "password-protected" | "invalid";
export type PdfDocumentInspector<T> = (
  pdf: PDFDocumentProxy,
) => Promise<T>;

export class PdfValidationError extends Error {
  constructor(readonly failure: PdfValidationFailure) {
    super(failure);
    this.name = "PdfValidationError";
  }
}

function hasPdfStructuralMarkers(pdfBuffer: Buffer): boolean {
  const headerWindow = pdfBuffer.subarray(0, 1024);
  return (
    headerWindow.includes(Buffer.from("%PDF-")) &&
    pdfBuffer.includes(Buffer.from("%%EOF"))
  );
}

function isPasswordException(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "PasswordException"
  );
}

export async function withValidatedPdfBuffer<T>(
  pdfBuffer: Buffer,
  inspect: PdfDocumentInspector<T>,
): Promise<T> {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });

  try {
    let pdf: PDFDocumentProxy;
    try {
      pdf = await loadingTask.promise;
      await pdf.getPage(1);
      if (!hasPdfStructuralMarkers(pdfBuffer)) {
        throw new PdfValidationError("invalid");
      }
    } catch (error) {
      if (error instanceof PdfValidationError) {
        throw error;
      }

      if (isPasswordException(error)) {
        throw new PdfValidationError("password-protected");
      }

      throw new PdfValidationError("invalid");
    }

    return await inspect(pdf);
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

export async function validatePdfBuffer(pdfBuffer: Buffer): Promise<void> {
  await withValidatedPdfBuffer(pdfBuffer, async () => undefined);
}
