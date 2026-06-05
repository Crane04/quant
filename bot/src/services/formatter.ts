import { IDocument } from "../models/Document";

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
    `👋 Welcome to *Quant App*!\n\n` +
    `Your academic material support system.\n\n` +
    `Type *menu* to see what you can do.`
  );
};

export const formatMenu = (): string => {
  return (
    `📋 *Main Menu*\n\n` +
    `1️⃣  Get PDF\n` +
    `2️⃣  Search material\n\n` +
    `Reply with a number or option name.\n` +
    `e.g. _Get PDF_ or _1_`
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
    `Send me the course code or name.\n\n` +
    `Examples:\n` +
    `• _ENG 201_\n` +
    `• _Fluid Mechanics_\n` +
    `• _CHE 301_`
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
    `• *get pdf* — Browse PDFs by course\n` +
    `• *search <term>* — Search all materials\n` +
    `• *help* — This message\n\n` +
    `For issues, contact your administrator.`
  );
};

export const formatUnsupportedRequest = (): string => {
  return (
    `I can't help with that yet.\n\n` +
    `For now, I can help you:\n` +
    `• Get PDFs by course code or course name\n` +
    `• Search materials by topic or keyword\n\n` +
    `Type *menu* to continue.`
  );
};
