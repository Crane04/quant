import { Types } from "mongoose";
import {
  sendWhatsAppDocument,
  sendWhatsAppList,
  sendWhatsAppText,
} from "./waService";
import { appendWaHistory, getWaSession, setWaSession } from "./waSession";
import { getDocumentLink } from "./waTools";
import { logger } from "../utils/logger";

// When a search matches several documents, the student picks from a WhatsApp
// list message built here — not from the model's own reply. The model can only
// offer 3 buttons, and document ids don't survive into the next turn's history,
// so it used to list a few titles and then lose track of which file was meant.
// Rows carry the document id, so a tap sends that exact file with no LLM call.

export interface PickerDoc {
  id: string;
  title: string;
  category: string;
  courseCode: string;
}

interface PickerState {
  docs: PickerDoc[];
  nextOffset: number;
}

const LIST_ROW_LIMIT = 10; // WhatsApp's cap across all sections
const DOC_ROW_PREFIX = "doc_";
const MORE_ROW_ID = "doc_more";

const CATEGORY_LABELS: Record<string, string> = {
  lecture_note: "Lecture note",
  exam_summary: "Exam summary",
  past_question: "Past question",
  other: "Other",
};

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Sends one page of the picker, starting at `offset`. Returns the text to
 * record in the agent's history, so a typed follow-up ("the 2019 one") still
 * has the titles to go on. Throws if the list message can't be sent.
 */
export async function sendDocPicker(
  from: string,
  docs: PickerDoc[],
  total: number,
  offset = 0,
): Promise<string> {
  const remaining = docs.length - offset;
  // Ten fit exactly; past that, keep the last row for "More results".
  const pageSize = remaining <= LIST_ROW_LIMIT ? remaining : LIST_ROW_LIMIT - 1;
  const page = docs.slice(offset, offset + pageSize);
  const hasMore = offset + pageSize < docs.length;

  const rows = page.map((d) => {
    const title = truncate(d.title, 24);
    const label = CATEGORY_LABELS[d.category] ?? d.category;
    return {
      id: `${DOC_ROW_PREFIX}${d.id}`,
      title,
      // A cut-off title is shown in full here, since titles often differ only at the end.
      description: truncate(
        title === d.title ? `${label} · ${d.courseCode}` : `${label} · ${d.title}`,
        72,
      ),
    };
  });
  if (hasMore) {
    rows.push({
      id: MORE_ROW_ID,
      title: "More results",
      description: `${docs.length - offset - pageSize} more`,
    });
  }

  const codes = new Set(docs.map((d) => d.courseCode));
  const subject = codes.size === 1 ? `${[...codes][0]} ` : "";
  const bodyText =
    offset === 0
      ? `Found ${total} ${subject}materials` +
        (total > docs.length
          ? ` — here are the newest ${docs.length}. Name a topic or type (e.g. past questions) to narrow it down.`
          : ". Tap below to pick one.")
      : `More ${subject}materials (${offset + 1}-${offset + page.length} of ${docs.length}):`;

  await sendWhatsAppList(from, {
    bodyText,
    buttonText: "View materials",
    sections: [{ rows }],
  });

  setWaSession(from, "IDLE", {
    docPicker: { docs, nextOffset: offset + pageSize } satisfies PickerState,
  });

  return `${bodyText}\n${page.map((d) => `- ${d.title}`).join("\n")}`;
}

/**
 * Handles a tap on a picker row. Returns false if `replyId` isn't a picker
 * row, so the message goes through the normal flow instead.
 */
export async function handleDocPickerReply(
  from: string,
  replyId: string,
): Promise<boolean> {
  if (!replyId.startsWith(DOC_ROW_PREFIX)) return false;

  try {
    if (replyId === MORE_ROW_ID) {
      const picker = getWaSession(from).data.docPicker as PickerState | undefined;
      if (!picker || picker.nextOffset >= picker.docs.length) {
        await sendWhatsAppText(from, "That list has expired — just ask for the course again.");
        return true;
      }
      const text = await sendDocPicker(
        from,
        picker.docs,
        picker.docs.length,
        picker.nextOffset,
      );
      appendWaHistory(from, [
        { role: "user", content: "More results" },
        { role: "assistant", content: text },
      ]);
      return true;
    }

    const documentId = replyId.slice(DOC_ROW_PREFIX.length);
    const doc = Types.ObjectId.isValid(documentId)
      ? await getDocumentLink({ documentId })
      : null;
    if (!doc || !("fileUrl" in doc) || !doc.fileUrl) {
      await sendWhatsAppText(
        from,
        "That file isn't available anymore — try searching for the course again.",
      );
      return true;
    }

    await sendWhatsAppDocument(from, doc.fileUrl, doc.filename);
    appendWaHistory(from, [
      { role: "user", content: `Send "${doc.title}"` },
      { role: "assistant", content: `Sent the ${doc.courseCode} file "${doc.title}".` },
    ]);
  } catch (err) {
    logger.error("Failed to handle document picker reply", {
      to: from,
      replyId,
      error: err instanceof Error ? err.message : "unknown",
    });
    await sendWhatsAppText(
      from,
      "Sorry, I couldn't send that file — please try again in a moment.",
    ).catch(() => undefined);
  }
  return true;
}
