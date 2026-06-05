import { AiIntent, detectIntent } from "./aiIntentService";
import {
  formatCoursePrompt,
  formatDocumentList,
  formatHelp,
  formatMenu,
  formatNotFound,
  formatSearchPrompt,
  formatUnsupportedRequest,
  formatWelcome,
} from "./formatter";
import { findByCourseCode, findById, incrementDownload, searchDocuments } from "./pdfService";
import { detectLocalIntent } from "./localIntentService";
import { clearSession, getSession, setSession } from "./session";
import { touchStudentActivity } from "./studentService";
import { sendPDF, sendText } from "./twilioService";
import { logInfo, logPhone, truncate } from "../utils/logger";
import { normalizeInput } from "../utils/string";

const getLookupTerm = (body: string, intent: AiIntent | null): string => {
  return intent?.courseCode || intent?.query || body;
};

const getSearchTerm = (body: string, intent: AiIntent | null): string => {
  return intent?.query || intent?.courseCode || body;
};

const handleGlobalIntent = async (
  from: string,
  intent: AiIntent | null
): Promise<boolean> => {
  if (intent?.intent === "greeting") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    clearSession(from);
    await sendText(from, formatWelcome());
    await sendText(from, formatMenu());
    return true;
  }

  if (intent?.intent === "thanks") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    await sendText(from, "You're welcome. Type *menu* whenever you need another PDF.");
    return true;
  }

  if (intent?.intent === "help") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    await sendText(from, formatHelp());
    return true;
  }

  if (intent?.intent === "menu") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    clearSession(from);
    await sendText(from, formatMenu());
    return true;
  }

  if (intent?.intent === "goodbye") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    clearSession(from);
    await sendText(from, "Alright, I've ended this session. Type *hi* whenever you need a PDF.");
    return true;
  }

  if (intent?.intent === "unsupported_request") {
    logInfo("Global intent handled", {
      from: logPhone(from),
      intent: intent.intent,
      query: intent.query,
    });
    await sendText(from, formatUnsupportedRequest());
    return true;
  }

  return false;
};

const sendDocumentResults = async (from: string, docs: Awaited<ReturnType<typeof findByCourseCode>>) => {
  logInfo("Document lookup completed", {
    from: logPhone(from),
    count: docs.length,
  });

  if (docs.length > 0) {
    setSession(from, "AWAITING_DOCUMENT_SELECTION", {
      docs: docs.map((doc) => doc._id.toString()),
    });
    await sendText(from, formatDocumentList(docs));
    return;
  }

  await sendText(from, formatNotFound());
};

const sendSearchResults = async (from: string, query: string): Promise<void> => {
  logInfo("Document search started", {
    from: logPhone(from),
    query: truncate(query),
  });

  const results = await searchDocuments(query);

  logInfo("Document search completed", {
    from: logPhone(from),
    query: truncate(query),
    count: results.length,
  });

  if (results.length === 0) {
    await sendText(
      from,
      `🔍 No results for _"${query}"_.\n\nTry different keywords or type *menu* to go back.`
    );
    return;
  }

  setSession(from, "AWAITING_DOCUMENT_SELECTION", {
    docs: results.map((doc) => doc._id.toString()),
  });
  await sendText(from, formatDocumentList(results));
};

export const processIncomingMessage = async (
  from: string,
  body: string
): Promise<void> => {
  const input = normalizeInput(body);

  logInfo("Incoming WhatsApp message", {
    from: logPhone(from),
    body: truncate(body),
  });

  await touchStudentActivity(from);

  const session = getSession(from);
  const localIntent = detectLocalIntent(body);

  logInfo("Session loaded", {
    from: logPhone(from),
    state: session.state,
  });

  if (localIntent) {
    logInfo("Local intent detected", {
      from: logPhone(from),
      intent: localIntent.intent,
      courseCode: localIntent.courseCode,
      query: localIntent.query,
      selectionNumber: localIntent.selectionNumber,
    });
  } else {
    logInfo("Local intent not detected", { from: logPhone(from) });
  }

  if (await handleGlobalIntent(from, localIntent)) return;

  const intent = localIntent || (await detectIntent(body));

  if (intent && intent !== localIntent) {
    logInfo("AI intent selected", {
      from: logPhone(from),
      intent: intent.intent,
      courseCode: intent.courseCode,
      query: intent.query,
      selectionNumber: intent.selectionNumber,
    });
  }

  if (!intent) {
    logInfo("No intent detected, falling back to direct course lookup", {
      from: logPhone(from),
      body: truncate(body),
    });
  }

  if (await handleGlobalIntent(from, intent)) return;

  switch (session.state) {
    case "IDLE": {
      if (["1", "get pdf", "pdf"].includes(input)) {
        logInfo("Command branch selected", { from: logPhone(from), branch: "get_pdf" });
        setSession(from, "AWAITING_COURSE_CODE");
        await sendText(from, formatCoursePrompt());
        return;
      }

      if (["2", "search", "search material"].includes(input)) {
        logInfo("Command branch selected", { from: logPhone(from), branch: "search_prompt" });
        setSession(from, "AWAITING_SEARCH_QUERY");
        await sendText(from, formatSearchPrompt());
        return;
      }

      if (intent?.intent === "search_documents") {
        logInfo("Intent branch selected", {
          from: logPhone(from),
          branch: "search_documents",
          query: truncate(getSearchTerm(body, intent)),
        });
        await sendSearchResults(from, getSearchTerm(body, intent));
        return;
      }

      if (intent?.intent === "find_document") {
        const lookupTerm = getLookupTerm(body, intent);
        logInfo("Intent branch selected", {
          from: logPhone(from),
          branch: "find_document",
          lookupTerm: truncate(lookupTerm),
        });
        const docs = await findByCourseCode(lookupTerm);
        await sendDocumentResults(from, docs);
        return;
      }

      logInfo("Fallback branch selected", {
        from: logPhone(from),
        branch: "direct_course_lookup",
        lookupTerm: truncate(body),
      });
      const docs = await findByCourseCode(body);
      await sendDocumentResults(from, docs);
      return;
    }

    case "AWAITING_COURSE_CODE": {
      if (intent?.intent === "search_documents") {
        logInfo("State branch selected", {
          from: logPhone(from),
          state: session.state,
          branch: "search_documents",
          query: truncate(getSearchTerm(body, intent)),
        });
        await sendSearchResults(from, getSearchTerm(body, intent));
        return;
      }

      const lookupTerm = getLookupTerm(body, intent);
      logInfo("State branch selected", {
        from: logPhone(from),
        state: session.state,
        branch: "course_lookup",
        lookupTerm: truncate(lookupTerm),
      });
      const docs = await findByCourseCode(lookupTerm);

      if (docs.length === 0) {
        await sendText(
          from,
          `❌ No materials found for *${lookupTerm.toUpperCase()}*.\n\nCheck the course code and try again, or type *search <keyword>* to search by topic.`
        );
        return;
      }

      setSession(from, "AWAITING_DOCUMENT_SELECTION", {
        docs: docs.map((doc) => doc._id.toString()),
      });
      await sendText(from, formatDocumentList(docs));
      return;
    }

    case "AWAITING_DOCUMENT_SELECTION": {
      const docIds = (session.data.docs as string[]) || [];
      const choice = intent?.selectionNumber || parseInt(input, 10);

      logInfo("State branch selected", {
        from: logPhone(from),
        state: session.state,
        branch: "document_selection",
        choice,
        availableChoices: docIds.length,
      });

      if (isNaN(choice) || choice < 1 || choice > docIds.length) {
        await sendText(
          from,
          `Please reply with a number between *1* and *${docIds.length}*, or type *menu* to start over.`
        );
        return;
      }

      const docId = docIds[choice - 1];
      const doc = await findById(docId);

      if (!doc) {
        clearSession(from);
        await sendText(from, `❌ Document not found. Type *menu* to start over.`);
        return;
      }

      clearSession(from);
      await sendPDF(from, doc);
      await incrementDownload(docId);

      logInfo("PDF sent", {
        from: logPhone(from),
        documentId: docId,
        title: doc.title,
      });

      setTimeout(async () => {
        await sendText(
          from,
          `✅ Done! Type *menu* to get another PDF or *help* for all commands.`
        );
      }, 3000);

      return;
    }

    case "AWAITING_SEARCH_QUERY": {
      logInfo("State branch selected", {
        from: logPhone(from),
        state: session.state,
        branch: "search_query",
        query: truncate(getSearchTerm(body, intent)),
      });
      await sendSearchResults(from, getSearchTerm(body, intent));
      return;
    }

    default: {
      logInfo("Unknown session state, returning menu", {
        from: logPhone(from),
        state: session.state,
      });
      clearSession(from);
      await sendText(from, formatMenu());
    }
  }
};
