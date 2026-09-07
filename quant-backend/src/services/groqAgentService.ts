import { env } from "../config/env";
import { logger } from "../utils/logger";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type GroqResponse = {
  choices?: Array<{ message?: ChatMessage }>;
};

// Groq's per-minute token limit resets quickly — a 429 usually asks for a
// retry within tens of milliseconds, not seconds (see the rate_limit_exceeded
// error body). A couple of short retries clears most of these transparently
// instead of surfacing "having trouble right now" for what's often a ~1s blip.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// GROQ_API_KEY can be a comma-separated list — each key has its own
// independent rate-limit budget (separate Groq account/org), so a key that's
// currently rate-limited doesn't have to block the request if another key
// still has headroom.
function getApiKeys(): string[] {
  return env.GROQ_API_KEY.split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Tries each configured API key in turn (retrying briefly on 429 within a
 *  key before moving to the next). Returns null (after logging) once every
 *  key has been exhausted. */
async function fetchGroq(
  body: Record<string, unknown>,
  errorLabel: string,
): Promise<Response | null> {
  const keys = getApiKeys();

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const apiKey = keys[keyIndex];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        res = await fetch(GROQ_CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        logger.error(`${errorLabel} errored`, {
          keyIndex,
          error: err instanceof Error ? err.message : "unknown",
        });
        break; // network-level failure — no point retrying the same key, try the next one
      }

      if (res.ok) return res;

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("retry-after");
        const delayMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : RETRY_DELAY_MS;
        logger.warn(`${errorLabel} rate limited, retrying`, {
          keyIndex,
          attempt: attempt + 1,
          delayMs,
        });
        await sleep(Math.min(delayMs, 3000));
        continue;
      }

      logger.error(`${errorLabel} failed`, {
        keyIndex,
        status: res.status,
        body: await res.text(),
      });
      break; // exhausted retries (or non-retryable error) on this key — fall through to the next
    }
  }

  return null;
}

/** One raw Groq chat-completion call. Returns null on any failure — callers fall back gracefully. */
export async function completeChat(
  messages: ChatMessage[],
  tools: readonly unknown[],
): Promise<ChatMessage | null> {
  if (getApiKeys().length === 0) {
    logger.warn("GROQ_API_KEY not configured — agent unavailable");
    return null;
  }

  const res = await fetchGroq(
    {
      model: env.GROQ_MODEL,
      temperature: 0.3,
      // Hard ceiling on reply length — WhatsApp messages should be short, and
      // the system prompt's own brevity guidance isn't always followed strictly
      // enough on its own. ~300 tokens is generous for a legitimate multi-item
      // list (e.g. scheduling fields) but stops rambling well before it turns
      // into an essay.
      max_tokens: 300,
      messages,
      tools,
      tool_choice: "auto",
    },
    "Groq agent request",
  );
  if (!res) return null;

  const data = (await res.json()) as GroqResponse;
  return data.choices?.[0]?.message ?? null;
}

/** One-shot structured extraction — no tools, forces a JSON object response. */
export async function completeJson(
  messages: ChatMessage[],
): Promise<Record<string, unknown> | null> {
  if (getApiKeys().length === 0) {
    logger.warn("GROQ_API_KEY not configured — extraction unavailable");
    return null;
  }

  const res = await fetchGroq(
    {
      model: env.GROQ_MODEL,
      temperature: 0,
      messages,
      response_format: { type: "json_object" },
    },
    "Groq extraction request",
  );
  if (!res) return null;

  const data = (await res.json()) as GroqResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    logger.error("Groq extraction returned invalid JSON", { content });
    return null;
  }
}
