import { AiIntent } from "./aiIntentService";
import { normalizeInput } from "../utils/string";

const greetingInputs = ["hi", "hello", "hey", "start", "good morning", "good afternoon", "good evening"];
const menuInputs = ["menu", "back", "home"];
const helpInputs = [
  "help",
  "?",
  "what do you do",
  "what can you do",
  "how does this work",
  "how do you work",
  "who are you",
];
const thanksInputs = ["thanks", "thank you", "thank u", "appreciate", "appreciate it"];
const goodbyeInputs = ["end", "stop", "quit", "cancel", "bye", "goodbye", "exit"];
const unsupportedTerms = [
  "unregister",
  "delete account",
  "remove me",
  "school fees",
  "admission",
  "admissions",
  "advice",
  "advise me",
];

const startsWithAny = (input: string, prefixes: string[]): string | null => {
  return prefixes.find((prefix) => input.startsWith(prefix)) || null;
};

const stripPrefix = (input: string, prefix: string): string => {
  return input.slice(prefix.length).trim();
};

const normalizeIntentInput = (message: string): string => {
  return normalizeInput(message).replace(/[?!.,]+$/g, "").replace(/\s+/g, " ");
};

export const detectLocalIntent = (message: string): AiIntent | null => {
  const input = normalizeIntentInput(message);

  if (greetingInputs.includes(input)) return { intent: "greeting" };
  if (menuInputs.includes(input)) return { intent: "menu" };
  if (helpInputs.includes(input)) return { intent: "help" };
  if (goodbyeInputs.includes(input)) return { intent: "goodbye" };
  if (thanksInputs.some((term) => input.includes(term))) return { intent: "thanks" };
  if (unsupportedTerms.some((term) => input.includes(term))) {
    return { intent: "unsupported_request", query: message.trim() };
  }

  const searchPrefix = startsWithAny(input, ["search for ", "search ", "find materials on ", "find material on "]);
  if (searchPrefix) {
    const query = stripPrefix(message, searchPrefix).replace(/[?!.,]+$/g, "");
    return query ? { intent: "search_documents", query } : { intent: "search_documents" };
  }

  const getPdfPrefix = startsWithAny(input, ["get pdf for ", "send pdf for ", "send me ", "i need "]);
  if (getPdfPrefix) {
    const query = stripPrefix(message, getPdfPrefix).replace(/[?!.,]+$/g, "");
    return query ? { intent: "find_document", query } : { intent: "find_document" };
  }

  if (["get course pdf", "get pdf", "pdf", "course pdf"].includes(input)) {
    return { intent: "find_document" };
  }

  const selectionNumber = Number.parseInt(input, 10);
  if (!Number.isNaN(selectionNumber) && `${selectionNumber}` === input) {
    return { intent: "select_document", selectionNumber };
  }

  return null;
};
