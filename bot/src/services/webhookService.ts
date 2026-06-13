import { AiIntent, detectIntent } from "./aiIntentService";
import {
  formatCoursePrompt,
  formatDocumentList,
  formatFeedbackPrompt,
  formatHelp,
  formatMenu,
  formatNotFound,
  formatProfilePrompt,
  formatProfileSummary,
  formatRegistrationComplete,
  formatReturningWelcome,
  formatSearchPrompt,
  formatUnsupportedRequest,
  formatWelcome,
} from "./formatter";
import { findByCourseCode, findById, incrementDownload, searchDocuments } from "./pdfService";
import { detectLocalIntent } from "./localIntentService";
import { clearSession, getSession, setSession } from "./session";
import {
  addStudentAssignment,
  getStudentByPhone,
  isProfileComplete,
  setStudentCgpaTarget,
  touchStudentActivity,
  updateStudentProfileField,
  upsertStudentProfile,
} from "./studentService";
import { sendPDF, sendText } from "./twilioService";
import { logInfo, logPhone, truncate } from "../utils/logger";
import { normalizeInput } from "../utils/string";

const getLookupTerm = (body: string, intent: AiIntent | null): string => {
  return intent?.courseCode || intent?.query || body;
};

const getSearchTerm = (body: string, intent: AiIntent | null): string => {
  return intent?.query || intent?.courseCode || body;
};

const normalizeButtonInput = (input: string): string => {
  return input.replace(/^\[/, "").replace(/\]$/, "").trim();
};

const parseCgpa = (value: string): number | null => {
  const cgpa = Number.parseFloat(value);
  return Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= 5 ? cgpa : null;
};

const normalizeLevel = (value: string): string | null => {
  const match = value.match(/\b(100|200|300|400|500)\b/);
  return match ? match[1] : null;
};

const parseAssignment = (value: string): { courseCode: string; description: string; dueDate: Date } | null => {
  const courseMatch = value.match(/\b[A-Z]{2,4}\s?\d{3}\b/i);
  if (!courseMatch) return null;

  const dateMatch =
    value.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?\b/i) ||
    value.match(/\b\d{4}-\d{2}-\d{2}\b/);

  if (!dateMatch) return null;

  const withYear = /\d{4}/.test(dateMatch[0]) ? dateMatch[0] : `${dateMatch[0]}, ${new Date().getFullYear()}`;
  const dueDate = new Date(withYear);

  if (Number.isNaN(dueDate.getTime())) return null;

  const description = value
    .replace(courseMatch[0], "")
    .replace(dateMatch[0], "")
    .replace(/\b(due|course|code|on|by|:|-)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    courseCode: courseMatch[0].toUpperCase().replace(/([A-Z]+)\s?(\d+)/, "$1 $2"),
    description: description || "Assignment",
    dueDate,
  };
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const startProfileRegistration = async (from: string): Promise<void> => {
  setSession(from, "AWAITING_PROFILE_NAME", { profile: {} });
  await sendText(from, formatProfilePrompt("Let's set up your student profile.\n\n1/7 Name:"));
};

const completeProfileStep = async (
  from: string,
  nextState: Parameters<typeof setSession>[1],
  data: Record<string, unknown>,
  prompt: string
): Promise<void> => {
  setSession(from, nextState, data);
  await sendText(from, prompt);
};

const sendFeedbackPrompt = async (from: string): Promise<void> => {
  setSession(from, "AWAITING_FEEDBACK");
  await sendText(from, formatFeedbackPrompt());
};

const handleGlobalIntent = async (
  from: string,
  intent: AiIntent | null
): Promise<boolean> => {
  if (intent?.intent === "greeting") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    clearSession(from);
    const student = await getStudentByPhone(from);
    if (isProfileComplete(student)) {
      await sendText(from, formatReturningWelcome());
      await sendText(from, formatMenu());
    } else {
      await sendText(from, formatWelcome());
    }
    return true;
  }

  if (intent?.intent === "thanks") {
    logInfo("Global intent handled", { from: logPhone(from), intent: intent.intent });
    await sendText(from, "Glad I could help! Is there anything else you need?");
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
    await sendText(from, "Alright, I've ended this session. Type *hi* whenever you need Quant.");
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
  const input = normalizeButtonInput(normalizeInput(body));

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

  const studentForNumberedOnboarding = await getStudentByPhone(from);
  const needsProfile =
    session.state === "IDLE" && !isProfileComplete(studentForNumberedOnboarding);

  if (needsProfile && input === "1") {
    logInfo("Profile registration started", { from: logPhone(from), source: "numbered_onboarding" });
    await startProfileRegistration(from);
    return;
  }

  if (needsProfile && input === "2") {
    clearSession(from);
    await sendText(
      from,
      `A representative can help you here: ${process.env.SUPPORT_WHATSAPP_URL || "https://wa.me/2340000000000"}`
    );
    return;
  }

  if (["register profile", "register", "set up profile", "setup profile"].includes(input)) {
    logInfo("Profile registration started", { from: logPhone(from) });
    await startProfileRegistration(from);
    return;
  }

  if (["main menu", "main"].includes(input)) {
    clearSession(from);
    await sendText(from, formatMenu());
    return;
  }

  if (["talk to support", "support", "help me"].includes(input)) {
    clearSession(from);
    await sendText(
      from,
      `A representative can help you here: ${process.env.SUPPORT_WHATSAPP_URL || "https://wa.me/2340000000000"}`
    );
    return;
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
    case "AWAITING_FEEDBACK": {
      if (!["1", "2", "yes", "no"].includes(input)) {
        await sendText(from, "Please reply with 1 for Yes or 2 for No.");
        return;
      }

      clearSession(from);
      await sendText(
        from,
        ["1", "yes"].includes(input)
          ? "Glad I could help! Is there anything else you need?"
          : "Sorry to hear that. Reply *5* from the main menu to reach support, or tell me how I can improve."
      );
      return;
    }

    case "AWAITING_PROFILE_NAME": {
      await completeProfileStep(
        from,
        "AWAITING_PROFILE_SCHOOL",
        { profile: { ...(session.data.profile as Record<string, unknown>), name: body.trim() } },
        formatProfilePrompt("2/7 School/Institution:", "Example: LASU or Lagos State University")
      );
      return;
    }

    case "AWAITING_PROFILE_SCHOOL": {
      await completeProfileStep(
        from,
        "AWAITING_PROFILE_CAMPUS",
        { profile: { ...(session.data.profile as Record<string, unknown>), school: body.trim() } },
        formatProfilePrompt("3/7 Campus:", "Example: Ojo or Epe")
      );
      return;
    }

    case "AWAITING_PROFILE_CAMPUS": {
      await completeProfileStep(
        from,
        "AWAITING_PROFILE_FACULTY",
        { profile: { ...(session.data.profile as Record<string, unknown>), campus: body.trim() } },
        formatProfilePrompt("4/7 Faculty:", "Example: Engineering")
      );
      return;
    }

    case "AWAITING_PROFILE_FACULTY": {
      await completeProfileStep(
        from,
        "AWAITING_PROFILE_DEPARTMENT",
        { profile: { ...(session.data.profile as Record<string, unknown>), faculty: body.trim() } },
        formatProfilePrompt("5/7 Department:", "Example: ECE, MEE, CVE")
      );
      return;
    }

    case "AWAITING_PROFILE_DEPARTMENT": {
      await completeProfileStep(
        from,
        "AWAITING_PROFILE_LEVEL",
        { profile: { ...(session.data.profile as Record<string, unknown>), department: body.trim().toUpperCase() } },
        formatProfilePrompt("6/7 Level:", "Reply 100, 200, 300, 400, or 500")
      );
      return;
    }

    case "AWAITING_PROFILE_LEVEL": {
      const level = normalizeLevel(body);
      if (!level) {
        await sendText(from, "Please reply with a valid level: 100, 200, 300, 400, or 500.");
        return;
      }

      await completeProfileStep(
        from,
        "AWAITING_PROFILE_CGPA",
        { profile: { ...(session.data.profile as Record<string, unknown>), level } },
        formatProfilePrompt("7/7 Current CGPA:", "Enter a number from 0.00 to 5.00")
      );
      return;
    }

    case "AWAITING_PROFILE_CGPA": {
      const currentCgpa = parseCgpa(body);
      if (currentCgpa === null) {
        await sendText(from, "Please enter a valid CGPA from 0.00 to 5.00.");
        return;
      }

      const profile = session.data.profile as {
        name: string;
        school: string;
        campus: string;
        faculty: string;
        department: string;
        level: string;
      };

      const completedProfile = {
        ...(session.data.profile as Record<string, string>),
        currentCgpa,
      };

      const student = await upsertStudentProfile(from, {
        name: profile.name,
        school: profile.school,
        campus: profile.campus,
        faculty: profile.faculty,
        department: profile.department,
        level: profile.level,
        currentCgpa: completedProfile.currentCgpa,
      });

      clearSession(from);
      await sendText(from, formatRegistrationComplete(student));
      await sendText(from, formatMenu());
      return;
    }

    case "IDLE": {
      const student = await getStudentByPhone(from);

      if (!student || !isProfileComplete(student)) {
        await sendText(from, formatWelcome());
        return;
      }

      if (["1", "get pdf", "pdf", "get course pdf", "course pdf"].includes(input)) {
        logInfo("Command branch selected", { from: logPhone(from), branch: "get_pdf" });
        setSession(from, "AWAITING_COURSE_CODE");
        await sendText(from, formatCoursePrompt());
        return;
      }

      if (["2", "view assignments", "assignments"].includes(input)) {
        logInfo("Command branch selected", { from: logPhone(from), branch: "assignments" });
        const activeAssignments = (student.assignments || [])
          .filter((assignment) => assignment.dueDate >= new Date())
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

        if (activeAssignments.length === 0) {
          setSession(from, "AWAITING_ASSIGNMENT_EMPTY_CHOICE");
          await sendText(
            from,
            `You haven't set any assignments or reminders yet.\n\nReply with a number:\n1. Set Assignment/Reminder\n2. Main Menu`
          );
          return;
        }

        const lines = activeAssignments.map(
          (assignment) =>
            `${assignment.courseCode}: ${assignment.description} - Due: ${formatDate(assignment.dueDate)}.`
        );
        setSession(from, "AWAITING_ASSIGNMENT_ACTION_CHOICE");
        await sendText(
          from,
          `Here is your active workload:\n\n${lines.join("\n")}\n\nReply with a number:\n1. Keep reminder alerts on\n2. Main Menu`
        );
        return;
      }

      if (["set assignment/reminder", "set assignment", "set reminder", "remind me"].includes(input)) {
        setSession(from, "AWAITING_ASSIGNMENT_DETAILS");
        await sendText(
          from,
          "Please provide the assignment description, due date (e.g., June 15), and the Course Code."
        );
        return;
      }

      if (["3", "track cgpa", "cgpa"].includes(input)) {
        logInfo("Command branch selected", { from: logPhone(from), branch: "cgpa" });
        if (student.targetCgpa === undefined || student.targetCgpa === null) {
          setSession(from, "AWAITING_CGPA_EMPTY_CHOICE");
          await sendText(
            from,
            `You haven't set a CGPA target yet.\n\nReply with a number:\n1. Set Target\n2. Main Menu`
          );
          return;
        }

        const gap = student.targetCgpa - (student.currentCgpa || 0);
        await sendText(
          from,
          `Current CGPA: ${(student.currentCgpa || 0).toFixed(2)}. Target: ${student.targetCgpa.toFixed(2)}.\n` +
            `Status: You are currently ${Math.abs(gap).toFixed(2)} points ${gap > 0 ? "off your target" : "above your target"}.\n\n` +
            `Would you like to log a new CA score to update your projection?`
        );
        await sendFeedbackPrompt(from);
        return;
      }

      if (["set target", "cgpa target"].includes(input)) {
        setSession(from, "AWAITING_CGPA_TARGET");
        await sendText(from, "What is your desired target CGPA?");
        return;
      }

      if (["4", "edit profile", "update profile", "change my details"].includes(input)) {
        setSession(from, "AWAITING_PROFILE_EDIT_FIELD");
        await sendText(
          from,
          `${formatProfileSummary(student)}\n\nWhich field do you want to update? Reply with name, school, campus, faculty, department, level, or cgpa.`
        );
        return;
      }

      if (["5", "support/help", "support", "help"].includes(input)) {
        await sendText(from, formatHelp());
        return;
      }

      if (["search", "search material"].includes(input)) {
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
        const docs = await findByCourseCode(lookupTerm, {
          department: student.department,
          level: student.level,
        });
        await sendDocumentResults(from, docs);
        return;
      }

      logInfo("Fallback branch selected", {
        from: logPhone(from),
        branch: "direct_course_lookup",
        lookupTerm: truncate(body),
      });
      const docs = await findByCourseCode(body, {
        department: student.department,
        level: student.level,
      });
      await sendDocumentResults(from, docs);
      return;
    }

    case "AWAITING_ASSIGNMENT_DETAILS": {
      const assignment = parseAssignment(body);
      if (!assignment) {
        await sendText(
          from,
          "Please include a course code and due date. Example: ECE 316 Problem Set 2 due June 15."
        );
        return;
      }

      await addStudentAssignment(from, assignment);
      clearSession(from);
      await sendText(from, "Success! Your assignment has been scheduled.");
      await sendFeedbackPrompt(from);
      return;
    }

    case "AWAITING_ASSIGNMENT_EMPTY_CHOICE": {
      if (input === "1") {
        setSession(from, "AWAITING_ASSIGNMENT_DETAILS");
        await sendText(
          from,
          "Please provide the assignment description, due date (e.g., June 15), and the Course Code."
        );
        return;
      }

      if (input === "2") {
        clearSession(from);
        await sendText(from, formatMenu());
        return;
      }

      await sendText(from, "Please reply with 1 to set an assignment/reminder or 2 for the main menu.");
      return;
    }

    case "AWAITING_ASSIGNMENT_ACTION_CHOICE": {
      if (input === "1") {
        clearSession(from);
        await sendText(from, "Reminder alerts are on. I will notify you 24 hours before active assignment deadlines.");
        await sendFeedbackPrompt(from);
        return;
      }

      if (input === "2") {
        clearSession(from);
        await sendText(from, formatMenu());
        return;
      }

      await sendText(from, "Please reply with 1 to keep reminder alerts on or 2 for the main menu.");
      return;
    }

    case "AWAITING_CGPA_TARGET": {
      const targetCgpa = parseCgpa(body);
      if (targetCgpa === null) {
        await sendText(from, "Please enter a valid target CGPA from 0.00 to 5.00.");
        return;
      }

      const student = await getStudentByPhone(from);
      const currentCgpa = student?.currentCgpa || 0;
      const level = Number.parseInt(student?.level || "0", 10);

      if (currentCgpa <= 1.8 && targetCgpa > 4.5 && level >= 400) {
        setSession(from, "AWAITING_CGPA_EMPTY_CHOICE");
        await sendText(
          from,
          "Based on your current academic standing, this target may be challenging to reach. Let's look at a more achievable goal to keep you on track.\n\nReply with a number:\n1. Set Target\n2. Main Menu"
        );
        return;
      }

      await setStudentCgpaTarget(from, targetCgpa);
      clearSession(from);
      await sendText(from, "Target set successfully!");
      await sendFeedbackPrompt(from);
      return;
    }

    case "AWAITING_CGPA_EMPTY_CHOICE": {
      if (input === "1") {
        setSession(from, "AWAITING_CGPA_TARGET");
        await sendText(from, "What is your desired target CGPA?");
        return;
      }

      if (input === "2") {
        clearSession(from);
        await sendText(from, formatMenu());
        return;
      }

      await sendText(from, "Please reply with 1 to set a target or 2 for the main menu.");
      return;
    }

    case "AWAITING_PROFILE_EDIT_FIELD": {
      const fieldMap: Record<string, string> = {
        name: "name",
        school: "school",
        institution: "school",
        campus: "campus",
        faculty: "faculty",
        department: "department",
        level: "level",
        cgpa: "currentCgpa",
        "current cgpa": "currentCgpa",
      };
      const field = fieldMap[input];

      if (!field) {
        await sendText(from, "Reply with name, school, campus, faculty, department, level, or cgpa.");
        return;
      }

      setSession(from, "AWAITING_PROFILE_EDIT_VALUE", { editField: field });
      await sendText(from, `Enter the new ${input} value.`);
      return;
    }

    case "AWAITING_PROFILE_EDIT_VALUE": {
      const field = session.data.editField as
        | "name"
        | "school"
        | "campus"
        | "faculty"
        | "department"
        | "level"
        | "currentCgpa";
      let value: string | number = body.trim();

      if (field === "level") {
        const level = normalizeLevel(body);
        if (!level) {
          await sendText(from, "Please reply with a valid level: 100, 200, 300, 400, or 500.");
          return;
        }
        value = level;
      }

      if (field === "currentCgpa") {
        const cgpa = parseCgpa(body);
        if (cgpa === null) {
          await sendText(from, "Please enter a valid CGPA from 0.00 to 5.00.");
          return;
        }
        value = cgpa;
      }

      await updateStudentProfileField(from, field, field === "department" ? `${value}`.toUpperCase() : value);
      clearSession(from);
      await sendText(from, "Profile updated successfully.");
      await sendFeedbackPrompt(from);
      return;
    }

    case "AWAITING_COURSE_CODE": {
      const student = await getStudentByPhone(from);
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
      const docs = await findByCourseCode(lookupTerm, {
        department: student?.department,
        level: student?.level,
      });

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
        await sendFeedbackPrompt(from);
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
