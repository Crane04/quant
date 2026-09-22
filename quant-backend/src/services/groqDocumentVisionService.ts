import { z } from "zod";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_VISION_TIMEOUT_MS = 15_000;
const MAX_GROQ_VISION_KEY_RETRIES = 2;
const GROQ_VISION_RETRY_DELAY_MS = 500;

const semanticValidationResultSchema = z
  .object({
    isAcademicMaterial: z.boolean(),
    matchesExpectedCourse: z.enum(["yes", "no", "uncertain"]),
    appearsMixedAcrossCourses: z.boolean(),
    legibility: z.enum(["good", "poor", "uncertain"]),
    detectedCourseCodes: z.array(z.string().trim().min(1)).max(6),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().trim().min(1).max(180)).max(4),
  })
  .strict();

export type SemanticValidationResult = z.infer<
  typeof semanticValidationResultSchema
>;

export type SemanticValidationMetadata = {
  university: string;
  department: string;
  level: string;
  courseCode: string;
  courseTitle: string;
  category: string;
};

type GroqResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function getApiKeys(): string[] {
  return env.GROQ_API_KEY.split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isGroqVisionConfigured(): boolean {
  return getApiKeys().length > 0 && Boolean(env.GROQ_VISION_MODEL.trim());
}

function createVisionMessages(
  metadata: SemanticValidationMetadata,
  pageImages: Buffer[],
) {
  const prompt = [
    "Assess only the visible sampled pages of this uploaded document.",
    "Metadata is context, not evidence: do not claim a course match solely because it was supplied.",
    "Determine academic-material status, course plausibility, mixed/unrelated subjects, legibility, and visible course identifiers.",
    "Return short, admin-facing reasons. Do not provide reasoning or prose outside the JSON schema.",
    `Expected metadata: university=${metadata.university}; department=${metadata.department}; level=${metadata.level}; courseCode=${metadata.courseCode}; courseTitle=${metadata.courseTitle}; category=${metadata.category}.`,
  ].join(" ");

  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...pageImages.map((image) => ({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${image.toString("base64")}` },
        })),
      ],
    },
  ];
}

const semanticResultJsonSchema = {
  type: "object",
  properties: {
    isAcademicMaterial: { type: "boolean" },
    matchesExpectedCourse: { type: "string", enum: ["yes", "no", "uncertain"] },
    appearsMixedAcrossCourses: { type: "boolean" },
    legibility: { type: "string", enum: ["good", "poor", "uncertain"] },
    detectedCourseCodes: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: [
    "isAcademicMaterial",
    "matchesExpectedCourse",
    "appearsMixedAcrossCourses",
    "legibility",
    "detectedCourseCodes",
    "confidence",
    "reasons",
  ],
  additionalProperties: false,
};

async function requestVisionValidation(
  apiKey: string,
  metadata: SemanticValidationMetadata,
  pageImages: Buffer[],
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_VISION_TIMEOUT_MS);

  try {
    return await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.GROQ_VISION_MODEL,
        temperature: 0,
        max_completion_tokens: 300,
        reasoning_effort: "none",
        reasoning_format: "hidden",
        messages: createVisionMessages(metadata, pageImages),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "semantic_document_validation",
            strict: true,
            schema: semanticResultJsonSchema,
          },
        },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateDocumentSemantics(
  metadata: SemanticValidationMetadata,
  pageImages: Buffer[],
): Promise<SemanticValidationResult | null> {
  if (!isGroqVisionConfigured() || pageImages.length === 0) return null;

  const images = pageImages.slice(0, 3);
  const keys = getApiKeys();

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    for (let attempt = 0; attempt <= MAX_GROQ_VISION_KEY_RETRIES; attempt += 1) {
      try {
        const response = await requestVisionValidation(keys[keyIndex], metadata, images);
        if (response.ok) {
          const data = (await response.json()) as GroqResponse;
          const content = data.choices?.[0]?.message?.content;
          const parsed = content ? semanticValidationResultSchema.safeParse(JSON.parse(content)) : undefined;
          if (parsed?.success) return parsed.data;

          logger.warn("Groq vision returned an invalid semantic validation result", {
            keyIndex,
          });
          return null;
        }

        if (response.status === 429 && attempt < MAX_GROQ_VISION_KEY_RETRIES) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(
            Math.min(
              Number.isFinite(retryAfter)
                ? retryAfter * 1000
                : GROQ_VISION_RETRY_DELAY_MS,
              3000,
            ),
          );
          continue;
        }

        logger.warn("Groq vision request failed", {
          keyIndex,
          status: response.status,
        });
        break;
      } catch (error) {
        logger.warn("Groq vision request failed", {
          keyIndex,
          error: error instanceof Error ? error.name : "unknown",
        });
        break;
      }
    }
  }

  return null;
}
