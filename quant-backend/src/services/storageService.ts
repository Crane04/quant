import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { env } from "../config/env";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

function assertConfigured() {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  ) {
    throw new Error(
      "Cloudflare R2 is not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET)",
    );
  }
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const key = `documents/${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  return uploadBuffer(buffer, key, contentType);
}

export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  assertConfigured();

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return { url: `${env.R2_PUBLIC_BASE_URL}/${key}`, key };
}

export async function deleteFile(key: string): Promise<void> {
  assertConfigured();
  await client.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}
