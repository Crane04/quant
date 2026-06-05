import { logInfo, logWarn, truncate } from "../utils/logger";

export type BotIntent =
  | "greeting"
  | "thanks"
  | "goodbye"
  | "help"
  | "menu"
  | "find_document"
  | "search_documents"
  | "select_document"
  | "unsupported_request"
  | "unknown";

export type AiIntent = {
  intent: BotIntent;
  courseCode?: string;
  query?: string;
  selectionNumber?: number;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const intents: BotIntent[] = [
  "greeting",
  "thanks",
  "goodbye",
  "help",
  "menu",
  "find_document",
  "search_documents",
  "select_document",
  "unsupported_request",
  "unknown",
];

const systemPrompt = `
You classify WhatsApp messages for a university PDF delivery bot.
Return only valid JSON with these fields:
{
  "intent": "greeting" | "thanks" | "goodbye" | "help" | "menu" | "find_document" | "search_documents" | "select_document" | "unsupported_request" | "unknown",
  "courseCode": string | null,
  "query": string | null,
  "selectionNumber": number | null
}

Rules:
- Use "greeting" for pleasantries like hello, good morning, how far.
- Use "thanks" for appreciation.
- Use "goodbye" when the user wants to end, stop, quit, cancel, or says bye.
- Use "help" when the user asks what the bot can do.
- Use "menu" when the user wants to restart or go back.
- Use "find_document" when the user mentions a course code or asks for a specific course material.
- Use "search_documents" when the user asks to search by topic, keyword, title, or general subject.
- Use "select_document" when the user chooses a numbered result.
- Use "unsupported_request" when the user asks for anything outside PDF/material search, like unregistering, account deletion, registration, personal advice, school fees, admissions, or changing profile details.
- Normalize course codes with a space between letters and numbers when obvious, e.g. "mee305" -> "MEE 305".
- Keep query short and useful for database search.
- Do not invent course codes.
`;

const extractJson = (content: string): string => {
  const match = content.match(/\{[\s\S]*\}/);
  return match ? match[0] : content;
};

const isBotIntent = (intent: string): intent is BotIntent => {
  return intents.includes(intent as BotIntent);
};

const parseIntent = (content: string): AiIntent | null => {
  try {
    const parsed = JSON.parse(extractJson(content)) as Partial<AiIntent>;

    if (!parsed.intent || !isBotIntent(parsed.intent)) return null;

    return {
      intent: parsed.intent,
      courseCode: typeof parsed.courseCode === "string" ? parsed.courseCode : undefined,
      query: typeof parsed.query === "string" ? parsed.query : undefined,
      selectionNumber:
        typeof parsed.selectionNumber === "number" ? parsed.selectionNumber : undefined,
    };
  } catch {
    return null;
  }
};

export const detectIntent = async (message: string): Promise<AiIntent | null> => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!message.trim()) {
    logWarn("AI intent skipped: empty message");
    return null;
  }

  if (!apiKey) {
    logWarn("AI intent skipped: GROQ_API_KEY is not set");
    return null;
  }

  try {
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

    logInfo("AI intent request started", {
      model,
      message: truncate(message),
    });

    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      logWarn("AI intent request failed", {
        status: response.status,
        statusText: response.statusText,
        body: truncate(await response.text()),
      });
      return null;
    }

    const data = (await response.json()) as GroqChatResponse;
    const content = data.choices?.[0]?.message?.content;

    const intent = content ? parseIntent(content) : null;

    if (!intent) {
      logWarn("AI intent returned invalid payload", {
        content: truncate(content || ""),
      });
      return null;
    }

    logInfo("AI intent parsed", {
      intent: intent.intent,
      courseCode: intent.courseCode,
      query: intent.query,
      selectionNumber: intent.selectionNumber,
    });

    return intent;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Groq error";
    logWarn("AI intent unavailable", { error: message });
    return null;
  }
};
