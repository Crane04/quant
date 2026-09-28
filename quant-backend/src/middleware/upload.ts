import multer from "multer";
import { ApiError } from "../utils/ApiError";
import {
  isAllowedProfilePhotoMimeType,
  PROFILE_PHOTO_MAX_FILE_SIZE_BYTES,
} from "../services/profilePhotoValidationService";
import { getDocumentFileType } from "../services/officeDocumentValidationService";

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (getDocumentFileType(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(ApiError.badRequest("Supported file types are PDF, DOCX, and PPTX"));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (isAllowedProfilePhotoMimeType(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(ApiError.badRequest("Only JPEG, PNG, and WebP profile photos are allowed"));
  },
  limits: { fileSize: PROFILE_PHOTO_MAX_FILE_SIZE_BYTES },
});
