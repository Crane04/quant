import { loadImage } from "@napi-rs/canvas";
import { ApiError } from "../utils/ApiError";

export const PROFILE_PHOTO_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const PROFILE_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ProfilePhotoMimeType = "image/jpeg" | "image/png" | "image/webp";

export function isAllowedProfilePhotoMimeType(
  mimeType: string,
): mimeType is ProfilePhotoMimeType {
  return PROFILE_PHOTO_MIME_TYPES.has(mimeType);
}

function detectImageMimeType(buffer: Buffer): ProfilePhotoMimeType | undefined {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    buffer.subarray(8, 12).equals(Buffer.from("WEBP"))
  ) {
    return "image/webp";
  }

  return undefined;
}

export async function validateProfilePhoto(
  file: Express.Multer.File,
): Promise<void> {
  const detectedMimeType = detectImageMimeType(file.buffer);
  if (!detectedMimeType || detectedMimeType !== file.mimetype) {
    throw ApiError.badRequest("The uploaded file is not a valid profile image");
  }

  try {
    const image = await loadImage(file.buffer);
    if (image.width < 1 || image.height < 1) {
      throw new Error("Image has no dimensions");
    }
  } catch {
    throw ApiError.badRequest("The uploaded file is not a valid profile image");
  }
}

export function getProfilePhotoExtension(mimeType: ProfilePhotoMimeType): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}
