import cloudinary from "../config/cloudinary";

type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
};

export const uploadPdf = async (
  buffer: Buffer,
  courseCode: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "quant-app/pdfs",
        public_id: `${courseCode.replace(/\s/g, "_")}_${Date.now()}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result as CloudinaryUploadResult);
      }
    );

    stream.end(buffer);
  });
};

export const deletePdf = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
};
