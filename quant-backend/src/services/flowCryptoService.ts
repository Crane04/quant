import crypto from "crypto";
import { env } from "../config/env";

export interface DecryptedFlowRequest {
  version: string;
  action: "ping" | "INIT" | "data_exchange" | "BACK" | string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
}

export interface DecryptedFlowPayload {
  request: DecryptedFlowRequest;
  aesKey: Buffer;
  iv: Buffer;
}

const AUTH_TAG_LENGTH = 16;

function getPrivateKeyPem(): string {
  if (!env.META_WA_FLOW_PRIVATE_KEY_B64) {
    throw new Error("META_WA_FLOW_PRIVATE_KEY_B64 is not configured");
  }
  return Buffer.from(env.META_WA_FLOW_PRIVATE_KEY_B64, "base64").toString("utf8");
}

/**
 * Every request Meta sends to a WhatsApp Flow's data endpoint is encrypted:
 * an RSA-OAEP-wrapped AES key, plus the actual payload as AES-128-GCM
 * ciphertext (with the auth tag appended to the end of the buffer).
 */
export function decryptFlowRequest(body: {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
}): DecryptedFlowPayload {
  const aesKey = crypto.privateDecrypt(
    {
      key: getPrivateKeyPem(),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(body.encrypted_aes_key, "base64")
  );

  const iv = Buffer.from(body.initial_vector, "base64");
  const flowDataBuffer = Buffer.from(body.encrypted_flow_data, "base64");
  const ciphertext = flowDataBuffer.subarray(0, flowDataBuffer.length - AUTH_TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return { request: JSON.parse(decrypted.toString("utf8")), aesKey, iv };
}

/**
 * The response must be encrypted with the *same* AES key but a bit-flipped IV
 * (every byte XORed with 0xFF) — one of Meta's spec quirks. Returned as a raw
 * base64 string; the HTTP response body is just this string, Content-Type text/plain.
 */
export function encryptFlowResponse(payload: unknown, aesKey: Buffer, iv: Buffer): string {
  const flippedIv = Buffer.from(iv.map((b) => b ^ 0xff));

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([encrypted, authTag]).toString("base64");
}
