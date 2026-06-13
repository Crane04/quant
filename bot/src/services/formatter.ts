import { IDocument } from "../models/Document";
import { IStudent } from "../models/Student";

export const formatDocumentList = (docs: IDocument[]): string => {
  if (docs.length === 0) {
    return "No materials found for that course. Type *menu* to go back.";
  }

  let msg = `📚 *${docs[0].courseCode} - ${docs[0].courseName}*\n`;
  msg += `Found *${docs.length}* document(s):\n\n`;

  docs.forEach((doc, i) => {
    const sizeMB = (doc.fileSize / 1024 / 1024).toFixed(1);
    msg += `*${i + 1}.* ${doc.title}\n`;
    msg += `    📄 ${sizeMB} MB\n`;
    if (doc.tags.length > 0) {
      msg += `    🏷️ ${doc.tags.join(", ")}\n`;
    }
    msg += "\n";
  });

  msg += `Reply with the number to get the PDF (e.g. *1*)`;
  return msg;
};

export const formatWelcome = (): string => {
  return (
    `Hi. I am Quant. I organize your academic workflow and instantly retrieve your course materials.\n\n` +
    `Tap the button below to set up your student profile.\n\n` +
    `[Register Profile]`
  );
};

export const formatReturningWelcome = (): string => {
  return `Hi. I am Quant. Select an action from the menu below.`;
};

export const formatMenu = (): string => {
  return (
    `📋 *Main Menu*\n\n` +
    `1. Get Course PDF\n` +
    `2. View Assignments\n` +
    `3. Track CGPA\n` +
    `4. Edit Profile\n` +
    `5. Support/Help\n\n` +
    `Reply with a number or option name.`
  );
};

export const formatRegistrationComplete = (student: IStudent): string => {
  return (
    `Registration complete. You are registered as a ${student.level}L ${student.department} student from ${student.school}.\n\n` +
    `Select an action from the menu below.\n\n` +
    `[Main Menu]`
  );
};

export const formatProfileSummary = (student: IStudent): string => {
  return (
    `*Student Profile*\n\n` +
    `Name: ${student.name}\n` +
    `School: ${student.school}\n` +
    `Campus: ${student.campus}\n` +
    `Faculty: ${student.faculty}\n` +
    `Department: ${student.department}\n` +
    `Level: ${student.level}L\n` +
    `Current CGPA: ${student.currentCgpa?.toFixed(2) || "Not set"}`
  );
};

export const formatNotFound = (): string => {
  return (
    `❌ I couldn't find that.\n\n` +
    `Try:\n` +
    `• Type a course code (e.g. *ENG 201*)\n` +
    `• Type *menu* to start over\n` +
    `• Type *search <keyword>* to search`
  );
};

export const formatCoursePrompt = (): string => {
  return (
    `📖 *Get PDF*\n\n` +
    `Reply with the course code you need. (e.g., ECE 316).`
  );
};

export const formatSearchPrompt = (): string => {
  return (
    `🔍 *Search Material*\n\n` +
    `What topic or keyword are you looking for?\n\n` +
    `Examples:\n` +
    `• _thermodynamics week 3_\n` +
    `• _statics lecture notes_`
  );
};

export const formatSendingPDF = (doc: IDocument): string => {
  return `📤 Sending *${doc.title}*...\nCourse: ${doc.courseCode}`;
};

export const formatHelp = (): string => {
  return (
    `🆘 *Help*\n\n` +
    `Commands you can use:\n\n` +
    `• *menu* — Main menu\n` +
    `• *register profile* — Set up your student profile\n` +
    `• *get course pdf* — Access course materials\n` +
    `• *view assignments* — See active deadlines\n` +
    `• *track cgpa* — Check standing and goals\n` +
    `• *edit profile* — Update your academic data\n\n` +
    `[Talk to Support]`
  );
};

export const formatUnsupportedRequest = (): string => {
  return (
    `I'm sorry, I didn't get that.\n\n` +
    `Tap [Main Menu] to restart or [Talk to Support] to connect with a representative.`
  );
};

export const formatProfilePrompt = (field: string, hint?: string): string => {
  return `${field}${hint ? `\n${hint}` : ""}`;
};

export const formatFeedbackPrompt = (): string => {
  return `Was this helpful? [Yes] [No]`;
};
