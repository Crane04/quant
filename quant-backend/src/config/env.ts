import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  STUDENT_SESSION_EXPIRES_IN: z.string().default("30d"),
  ADMIN_SESSION_EXPIRES_IN: z.string().default("7d"),
  OTP_EXPIRES_IN_MINUTES: z.coerce.number().default(10),

  BOT_SERVICE_API_KEY: z.string().min(1, "BOT_SERVICE_API_KEY is required"),

  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@gmail.com"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(1).default("xyz123"),

  META_WA_PHONE_NUMBER_ID: z.string().optional().default(""),
  META_WA_ACCESS_TOKEN: z.string().optional().default(""),
  META_WA_VERIFY_TOKEN: z.string().optional().default(""),
  META_WA_APP_SECRET: z.string().optional().default(""), // for X-Hub-Signature-256 verification
  META_WA_FLOW_PRIVATE_KEY_B64: z.string().optional().default(""), // RSA private key, base64-encoded PEM
  META_WA_REGISTRATION_FLOW_ID: z.string().optional().default(""),

  // Fallback used when the WhatsApp Flow send fails (e.g. it's unpublished) — "web"
  // sends a link to the /register page, "text" uses the field-by-field chat wizard.
  REGISTRATION_FALLBACK: z.enum(["web", "text"]).default("text"),

  GROQ_API_KEY: z.string().optional().default(""),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),

  // Base URL this API is reachable at — used to build the /view/:id links sent over WhatsApp
  APP_BASE_URL: z.string().default("http://localhost:4000"),

  RESEND_API_KEY: z.string().optional().default(""),
  MAIL_FROM: z.string().optional().default("Quant <no-reply@quant.app>"),

  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET: z.string().optional().default(""),
  R2_PUBLIC_BASE_URL: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
