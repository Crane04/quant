import { Request, Response } from "express";
import { DocumentFile } from "../models/DocumentFile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

export async function viewDocument(req: Request, res: Response): Promise<void> {
  const doc = await DocumentFile.findById(req.params.id).populate("course");
  if (!doc || doc.status !== "approved") {
    res.status(404).send("<h1>Document not found</h1>");
    return;
  }

  await DocumentFile.updateOne({ _id: doc._id }, { $inc: { downloadCount: 1 } });

  const course = doc.course as unknown as { code?: string } | undefined;
  const title = escapeHtml(`${course?.code ? `${course.code} — ` : ""}${doc.title}`);
  const fileUrl = doc.fileUrl;
  const viewerSrc = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #202124; font-family: -apple-system, system-ui, sans-serif; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #111214; color: #fff; }
  .bar h1 { font-size: 14px; font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar a { color: #4dabf7; font-size: 13px; text-decoration: none; flex-shrink: 0; margin-left: 12px; }
  iframe { width: 100%; height: calc(100% - 44px); border: none; }
</style>
</head>
<body>
  <div class="bar">
    <h1>${title}</h1>
    <a href="${fileUrl}" download>Download</a>
  </div>
  <iframe src="${viewerSrc}"></iframe>
</body>
</html>`);
}
