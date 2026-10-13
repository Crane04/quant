import { StudentDoc } from "../models/Student";

// Contextual quick-reply suggestions, picked from what the agent actually did
// this turn (which tools it called and what they returned) — deterministic,
// no extra LLM call. Tapping a button sends its title back as the student's
// next message, so each title must read as something they'd say, and stay
// within WhatsApp's 20-character button limit.

export const MAX_SUGGESTIONS = 3;
export const MENU_SUGGESTION = "Menu"; // a greeting word — opens the main menu, free
export const TOPUP_SUGGESTION = "Top up"; // caught by detectQuantIntent — shows payment options, free

type Result = Record<string, unknown> | null | undefined;

const failed = (r: Result) =>
  !r || "error" in r || r.success === false || r.found === false;

export function suggestionsForTool(
  name: string,
  result: Result,
  student: StudentDoc,
): string[] {
  switch (name) {
    case "search_course_materials":
      // On a hit the reply lists the documents and asks which one — let the
      // student answer that rather than steering them elsewhere.
      return failed(result) ? ["Search another"] : [];

    case "get_document_link":
      return failed(result) ? ["Search materials"] : ["Past questions", "More materials"];

    case "get_timetable":
      if (result?.enrolled === false) return ["Enroll in courses"];
      return ["Tomorrow's classes", "My assignments"];

    case "get_course_schedule": {
      if (!student.isHOC || failed(result)) return [];
      const slots = (result?.slots as unknown[] | undefined) ?? [];
      return slots.length === 0
        ? ["Schedule class"]
        : ["Schedule class", "Edit a class"];
    }

    case "schedule_class":
    case "update_class_schedule":
    case "cancel_class":
      return failed(result) ? [] : ["Course schedule", "Broadcast"];

    case "save_assignment":
      return failed(result) ? [] : ["My assignments", "Add another"];

    case "get_assignments": {
      const assignments =
        (result?.assignments as { completed?: boolean }[] | undefined) ?? [];
      if (assignments.length === 0) return ["Add reminder"];
      const incomplete = assignments.filter((a) => !a.completed);
      // "Mark done" only with exactly one candidate — with several it
      // wouldn't tell the model which one.
      return incomplete.length === 1
        ? ["Mark done", "Add reminder"]
        : ["Add reminder"];
    }

    case "mark_assignment_done":
      return failed(result) ? [] : ["My assignments"];

    case "get_cgpa": {
      const r = result as {
        hasGrades?: boolean;
        target?: { status?: string } | null;
      } | null;
      if (!r?.hasGrades) return ["Record a grade"];
      if (r.target === null) return ["Set target", "Record a grade"];
      if (r.target?.status === "unrealistic") return ["Adjust target", "Record a grade"];
      return ["Record a grade"];
    }

    case "set_cgpa_target":
      return failed(result) ? [] : ["Check CGPA", "Record a grade"];

    case "record_grade":
      return failed(result) ? [] : ["Record another", "Check CGPA"];

    case "enroll_in_courses":
      return failed(result) ? [] : ["My timetable", "My courses"];

    case "get_profile":
      return ["My courses", "Check CGPA"];

    case "subscribe_to_course":
    case "unsubscribe_from_course":
      return failed(result) ? [] : ["My courses"];

    default:
      return [];
  }
}

/**
 * Final button set for a reply: the turn's tool suggestions (deduped, in the
 * order they came up), then "Top up" when the student is running low, then
 * "Menu" if there's room — so every AI reply leaves a tap to go somewhere.
 */
export function finalizeSuggestions(
  collected: string[],
  { topUp = false }: { topUp?: boolean } = {},
): string[] {
  const reserved = [
    ...(topUp ? [TOPUP_SUGGESTION] : []),
    MENU_SUGGESTION,
  ].filter((t) => !collected.includes(t));
  const fromTools = [...new Set(collected)]
    .filter((t) => t.length > 0 && t.length <= 20)
    // Keep at least one tool suggestion, then make room for Top up when low.
    .slice(0, Math.max(1, MAX_SUGGESTIONS - (topUp ? 2 : 1)));
  return [...fromTools, ...reserved].slice(0, MAX_SUGGESTIONS);
}
