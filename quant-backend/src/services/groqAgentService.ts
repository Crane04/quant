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

/** One raw Groq chat-completion call. Returns null on any failure — callers fall back gracefully. */
export async function completeChat(
  messages: ChatMessage[],
  tools: readonly unknown[],
): Promise<ChatMessage | null> {
  if (!env.GROQ_API_KEY) {
    logger.warn("GROQ_API_KEY not configured — agent unavailable");
    return null;
  }

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.3,
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      logger.error("Groq agent request failed", {
        status: res.status,
        body: await res.text(),
      });
      return null;
    }

    const data = (await res.json()) as GroqResponse;
    return data.choices?.[0]?.message ?? null;
  } catch (err) {
    logger.error("Groq agent request errored", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

/** One-shot structured extraction — no tools, forces a JSON object response. */
export async function completeJson(
  messages: ChatMessage[],
): Promise<Record<string, unknown> | null> {
  if (!env.GROQ_API_KEY) {
    logger.warn("GROQ_API_KEY not configured — extraction unavailable");
    return null;
  }

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      logger.error("Groq extraction request failed", {
        status: res.status,
        body: await res.text(),
      });
      return null;
    }

    const data = (await res.json()) as GroqResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch {
      logger.error("Groq extraction returned invalid JSON", { content });
      return null;
    }
  } catch (err) {
    logger.error("Groq extraction request errored", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
