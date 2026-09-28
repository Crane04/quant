import * as yauzl from "yauzl";

export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export type SupportedDocumentFileType = keyof typeof DOCUMENT_MIME_TYPES;

const MAX_OFFICE_PACKAGE_ENTRY_COUNT = 10_000;
const MAX_REQUIRED_OFFICE_ENTRY_BYTES = 50 * 1024 * 1024;
const CONTENT_TYPES_ENTRY = "[Content_Types].xml";
const PACKAGE_RELATIONSHIPS_ENTRY = "_rels/.rels";

const OFFICE_PACKAGE_REQUIREMENTS: Record<
  Exclude<SupportedDocumentFileType, "pdf">,
  { documentEntry: string; mainContentType: string }
> = {
  docx: {
    documentEntry: "word/document.xml",
    mainContentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  },
  pptx: {
    documentEntry: "ppt/presentation.xml",
    mainContentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  },
};

export class OfficeDocumentValidationError extends Error {
  constructor() {
    super("Invalid Office Open XML package");
    this.name = "OfficeDocumentValidationError";
  }
}

export function getDocumentFileType(
  mimeType: string,
): SupportedDocumentFileType | undefined {
  return (Object.keys(DOCUMENT_MIME_TYPES) as SupportedDocumentFileType[]).find(
    (fileType) => DOCUMENT_MIME_TYPES[fileType] === mimeType,
  );
}

function openZipBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(new OfficeDocumentValidationError());
          return;
        }

        resolve(zipFile);
      },
    );
  });
}

function closeZipFile(zipFile: yauzl.ZipFile): void {
  if (zipFile.isOpen) zipFile.close();
}

function readRequiredOfficeEntry(
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
  retainContents: boolean,
): Promise<Buffer | undefined> {
  if (entry.uncompressedSize > MAX_REQUIRED_OFFICE_ENTRY_BYTES) {
    return Promise.reject(new OfficeDocumentValidationError());
  }

  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(new OfficeDocumentValidationError());
        return;
      }

      let bytesRead = 0;
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => {
        bytesRead += chunk.length;
        if (bytesRead > MAX_REQUIRED_OFFICE_ENTRY_BYTES) {
          stream.destroy(new OfficeDocumentValidationError());
          return;
        }
        if (retainContents) chunks.push(chunk);
      });
      stream.on("error", () => reject(new OfficeDocumentValidationError()));
      stream.on("end", () => {
        resolve(retainContents ? Buffer.concat(chunks) : undefined);
      });
    });
  });
}

type OfficePackageContents = {
  entries: Set<string>;
  contentTypes?: Buffer;
};

async function listOfficePackageEntries(
  buffer: Buffer,
  requiredEntries: Set<string>,
): Promise<OfficePackageContents> {
  const zipFile = await openZipBuffer(buffer);
  if (zipFile.entryCount > MAX_OFFICE_PACKAGE_ENTRY_COUNT) {
    closeZipFile(zipFile);
    throw new OfficeDocumentValidationError();
  }

  return new Promise((resolve, reject) => {
    const entries = new Set<string>();
    let contentTypes: Buffer | undefined;
    let settled = false;

    const fail = () => {
      if (settled) return;
      settled = true;
      closeZipFile(zipFile);
      reject(new OfficeDocumentValidationError());
    };

    zipFile.on("error", fail);
    zipFile.on("entry", (entry: yauzl.Entry) => {
      if (settled || entries.size >= MAX_OFFICE_PACKAGE_ENTRY_COUNT) {
        fail();
        return;
      }

      entries.add(entry.fileName);
      if (!requiredEntries.has(entry.fileName)) {
        zipFile.readEntry();
        return;
      }

      void readRequiredOfficeEntry(
        zipFile,
        entry,
        entry.fileName === CONTENT_TYPES_ENTRY,
      )
        .then((contents) => {
          if (entry.fileName === CONTENT_TYPES_ENTRY) contentTypes = contents;
          zipFile.readEntry();
        })
        .catch(fail);
    });
    zipFile.on("end", () => {
      if (settled) return;
      settled = true;
      resolve({ entries, contentTypes });
    });

    zipFile.readEntry();
  });
}

export async function validateOfficeDocumentBuffer(
  buffer: Buffer,
  fileType: Exclude<SupportedDocumentFileType, "pdf">,
): Promise<void> {
  const requirements = OFFICE_PACKAGE_REQUIREMENTS[fileType];
  const requiredEntries = new Set([
    CONTENT_TYPES_ENTRY,
    PACKAGE_RELATIONSHIPS_ENTRY,
    requirements.documentEntry,
  ]);
  const { entries, contentTypes } = await listOfficePackageEntries(
    buffer,
    requiredEntries,
  );

  if (
    !entries.has(CONTENT_TYPES_ENTRY) ||
    !entries.has(PACKAGE_RELATIONSHIPS_ENTRY) ||
    !entries.has(requirements.documentEntry) ||
    !contentTypes?.toString("utf8").includes(requirements.mainContentType)
  ) {
    throw new OfficeDocumentValidationError();
  }
}
