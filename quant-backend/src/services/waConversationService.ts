import crypto from "crypto";
import { Student, StudentDoc } from "../models/Student";
import { Announcement } from "../models/Announcement";
import { deliverAnnouncementNow } from "./announcementDeliveryService";
import * as authService from "./authService";
import { verifyOtp, issueOtp } from "./otpService";
import { sendWelcomeEmailInBackground } from "./mailService";
import {
  sendWhatsAppText,
  sendWhatsAppDocument,
  sendWhatsAppFlow,
  sendWhatsAppCtaUrl,
  sendWhatsAppButtons,
  sendWhatsAppList,
} from "./waService";
import {
  getWaSession,
  setWaSession,
  clearWaSession,
  appendWaHistory,
  WaState,
} from "./waSession";
import {
  completeChat,
  completeJson,
  ChatMessage,
  GroqUsage,
} from "./groqAgentService";
import {
  balanceText,
  canAffordMessage,
  chargeForMessage,
  detectQuantIntent,
  getPricing,
  isLowBalance,
  isOutOfQuants,
  parseTopupSelection,
  sendTopupLink,
  sendTopupOptions,
} from "./quantService";
import { TOOL_DEFINITIONS, HOC_ONLY_TOOLS, executeTool } from "./waTools";
import { createRegistrationToken } from "./registrationTokenService";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import * as fmt from "./waFormatter";
import { finalizeSuggestions, suggestionsForTool } from "./waSuggestions";

const MAX_TOOL_ITERATIONS = 5;

async function reply(to: string, message: string): Promise<void> {
  try {
    await sendWhatsAppText(to, message);
  } catch (err) {
    logger.error("Failed to send WhatsApp reply", {
      to,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function buildSystemPrompt(student: StudentDoc, billingEnabled: boolean): string {
  return `You are Quant, a WhatsApp assistant for university students. You're chatting with:
- Name: ${student.fullName}
- University: ${student.university}
- Department: ${student.department}
- Level: ${student.level}
- HOC (Head of Class): ${student.isHOC ? "yes — can schedule/edit/cancel classes" : "no"}
- Quants balance: ${student.quants}
Today's date: ${new Date().toISOString().slice(0, 10)} (${new Date().toLocaleDateString("en-US", { weekday: "long" })}) — use this to resolve "today"/"tomorrow"/"next Monday" etc. directly; don't calculate the day of week yourself, read it from here.

Use the available tools to answer instead of guessing — never invent course material, grades,
deadlines, or timetable info. If a tool returns no results, say so plainly rather than making
something up.

When search_course_materials returns multiple documents, list them briefly (title + category)
and ask which one they want before calling get_document_link — unless there's exactly one
obvious match, in which case just send it directly. get_document_link delivers the actual PDF
as a WhatsApp file attachment automatically — never write out a link or URL yourself, just
briefly confirm you're sending it (e.g. "Here's the MEE 305 note!").

When search_course_materials finds nothing, assume the course code they gave you is correct —
the library just doesn't have that material *yet*. Don't tell them to double-check the code or
imply they made a mistake. Be warm and encouraging instead, e.g. "We don't have MEE 305 notes
up yet, but I'll keep an eye out!" — and offer to search a different course or topic if they'd
like.

For enroll_in_courses and record_grade, ask for any missing required detail (semester, etc.) in a
normal sentence before calling the tool — don't guess values the student didn't give you. Never ask
for the academic session — it's derived automatically from today's date.

save_assignment is a personal reminder, not tied to enrollment: never check whether the student is
enrolled in the course, and never say a course "isn't in the system" — just save whatever they tell
you, formatted, even if the course code is unfamiliar.

set_cgpa_target and get_cgpa return a target "status" — phrase your reply to match it, don't just
recite the number: "achieved" means congratulate them, it's already met; "on_track" means state the
required GPA plainly and encouragingly; "unrealistic" means gently say the target may be a stretch
given where they stand and suggest a more achievable one, without being discouraging — never just
refuse to set it.

Students are subscribed by default to notifications for courses matching their own class, and can
subscribe_to_course/unsubscribe_from_course to change that (mainly useful for a carryover or
borrowed course outside their own class, or to quiet a course they don't care about). Only mention
subscriptions if the student asks about notifications or a class they're not getting alerts for —
don't bring it up unprompted.

schedule_class, update_class_schedule, and cancel_class are HOC-only — only offered if the chat
profile above says they're a HOC. Look up the course's current slots with get_course_schedule first
if you need a slot id for an edit or cancellation. Scheduling a class notifies subscribed students
automatically — don't tell the student to notify anyone separately.

preview_broadcast is HOC-only — drafts a message to the HOC's whole class. Calling it shows the HOC
a preview with the audience size and Send/Cancel buttons automatically; it does not send anything
itself. Never say you've "sent" or "broadcast" something — only that you've drafted it for them to
confirm. Write the title and message yourself from what the HOC tells you; don't ask them to
reformat it into a template.

Quants are Quant's chat credits (₦1 = 1 quant), topped up by card or bank transfer through
Flutterwave. ${billingEnabled ? "Each of your replies costs the student some quants — the amount depends on the message, so never quote a fixed per-message price." : "Chatting is currently free; quants will be used once billing starts."}
If the student asks about quants, their balance, topping up, paying, or pricing, answer briefly
(their balance is above) and call reply_with_options with a "Top up" button — tapping it shows
the payment options. If they say they paid but didn't get quants, say quants usually land within
a minute or two of a successful payment, and that the Quant team can check it if they don't —
never claim a payment went through or promise a credit yourself.

Quick-reply suggestion buttons are added to your replies automatically, based on the tools you
used — so don't use reply_with_options for generic next steps. Reach for it only when your reply
asks the student something with a few clear answers that the automatic buttons can't know — e.g.
"Which semester?" with "First" / "Second", or a yes/no question.

Keep replies short — this is a WhatsApp chat, not an email. Default to 1-3 sentences. Only use a
numbered or bulleted list when you're genuinely asking for several distinct pieces of information
(like scheduling fields) — never as a way to pad out an otherwise simple answer. No preamble, no
restating what they asked, no closing filler like "let me know if you need anything else" — just
answer. Plain text, *single asterisks* for bold, no markdown tables or headers.`;
}

// Serializes processing per phone number. The webhook handler fires-and-forgets each
// message (it has to — Meta needs a fast 200 ack), so without this, two messages
// arriving close together for the same user race on the in-memory WaSession: the
// second can read state the first hasn't finished writing yet. Different phone
// numbers still run fully in parallel — only same-phone calls are chained.
const processingQueues = new Map<string, Promise<void>>();

function enqueue(
  from: string,
  task: () => Promise<void>,
  errorLabel: string,
): Promise<void> {
  const previous = processingQueues.get(from) ?? Promise.resolve();
  const next = previous.then(task).catch((err) => {
    logger.error(errorLabel, {
      from,
      error: err instanceof Error ? err.message : "unknown",
    });
  });

  processingQueues.set(from, next);
  next.finally(() => {
    if (processingQueues.get(from) === next) processingQueues.delete(from);
  });

  return next;
}

// Greetings/menu requests that open the main menu instead of reaching the
// agent. Matched after stripping punctuation and emoji, so "Hi!", "hello 👋"
// and "Good morning Quant" all count — but "hi, what's my timetable" doesn't,
// since anything beyond a greeting + filler words is a real question.
const GREETING_PHRASES = [
  "hi",
  "hii",
  "hello",
  "hey",
  "heyy",
  "hiya",
  "sup",
  "yo",
  "hola",
  "howdy",
  "good morning",
  "good afternoon",
  "good evening",
  "good day",
  "gm",
  "morning",
  "evening",
  "menu",
  "main menu",
  "options",
  "help",
  "start",
  "reset",
  "restart",
];
const GREETING_FILLER = new Set([
  "quant",
  "there",
  "bot",
  "again",
  "all",
  "everyone",
  "sir",
  "ma",
  "bro",
  "boss",
  "please",
  "pls",
]);

export function isGreeting(input: string): boolean {
  const words = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;

  // Longest phrase first, so "good morning" wins over "morning".
  for (const phrase of [...GREETING_PHRASES].sort((a, b) => b.length - a.length)) {
    const phraseWords = phrase.split(" ");
    const head = words.slice(0, phraseWords.length).join(" ");
    if (head !== phrase) continue;
    return words.slice(phraseWords.length).every((w) => GREETING_FILLER.has(w));
  }
  return false;
}

async function sendMainMenu(
  from: string,
  student: StudentDoc,
  bodyText: string,
): Promise<void> {
  const menuSections = [
    {
      title: "Academics",
      rows: [
        {
          id: "opt_materials",
          title: "Course materials",
          description: "Notes, past questions & summaries",
        },
        {
          id: "opt_timetable",
          title: "My timetable",
          description: "This week's class schedule",
        },
        {
          id: "opt_assignments",
          title: "My assignments",
          description: "Reminders you've saved",
        },
        {
          id: "opt_cgpa",
          title: "Check CGPA",
          description: "Your GPA & target progress",
        },
        {
          id: "opt_courses",
          title: "My courses",
          description: "Enrolled courses & credits",
        },
      ],
    },
    {
      title: "Account",
      rows: [
        {
          id: "opt_quants",
          title: "My quants",
          description: "Balance & top up",
        },
      ],
    },
    ...(student.isHOC
      ? [
          {
            title: "HOC tools",
            rows: [
              {
                id: "opt_schedule_class",
                title: "Schedule a class",
                description: "Add a new weekly class time",
              },
              {
                id: "opt_course_schedule",
                title: "Course schedule",
                description: "View or edit a course's slots",
              },
              {
                id: "opt_broadcast",
                title: "Broadcast announcement",
                description: "Send a message to your whole class",
              },
            ],
          },
        ]
      : []),
  ];

  try {
    await sendWhatsAppList(from, {
      bodyText,
      buttonText: "Menu",
      sections: menuSections,
    });
  } catch (err) {
    logger.error("Failed to send greeting menu, falling back to text", {
      to: from,
      error: err instanceof Error ? err.message : "unknown",
    });
    await reply(
      from,
      `${bodyText}\n\nAsk me anything — course material, your timetable, assignments, CGPA, or enrolling in a course.`,
    );
  }
}

export function processIncomingMessage(
  from: string,
  body: string,
): Promise<void> {
  return enqueue(
    from,
    () => processIncomingMessageInner(from, body),
    "WhatsApp message processing failed",
  );
}

async function processIncomingMessageInner(
  from: string,
  body: string,
): Promise<void> {
  const input = body.trim();
  if (!input) return;

  await Student.updateOne({ phone: from }, { lastSeenAt: new Date() });
  const student = await Student.findOne({ phone: from });
  const wa = getWaSession(from);

  // Unregistered, mid-registration, or registered-but-unverified — the structured
  // wizard owns this conversation until it's done. Registration needs exact
  // field-by-field data collection gated by an OTP, which isn't a good fit for a
  // tool-calling agent that might paraphrase or skip a field.
  //
  // Verification status is checked against the DB, not just wa.state: the in-memory
  // session has a TTL, and a student who steps away to check their email for the OTP
  // (completely normal) can easily outlast it. Without this, their session would
  // silently reset to IDLE and their code — or "resend" request — would get routed
  // to the general assistant, which has no idea a verification is pending.
  if (!student || !student.isEmailVerified || wa.state !== "IDLE") {
    const state =
      student && !student.isEmailVerified && wa.state === "IDLE"
        ? "AWAITING_EMAIL_OTP"
        : wa.state;
    await handleRegistration(from, input, state, wa.data);
    return;
  }

  // A drafted-but-unconfirmed broadcast (see preview_broadcast's handling below) —
  // intercepted deterministically rather than left to the agent, since a paraphrasing
  // model re-deciding whether "yes" means "send this to 128 people" is exactly the
  // kind of consequential action this codebase avoids trusting to the LLM for.
  const pendingBroadcast = wa.data.pendingBroadcast as
    | {
        title: string;
        message: string;
        university: string;
        department: string;
        level: string;
        audienceCount: number;
      }
    | undefined;

  if (pendingBroadcast && student.isHOC) {
    const normalized = input.toLowerCase();

    if (normalized === "send broadcast") {
      setWaSession(from, "IDLE", { pendingBroadcast: undefined });
      try {
        const announcement = await Announcement.create({
          type: "announcement",
          title: pendingBroadcast.title,
          message: pendingBroadcast.message,
          university: pendingBroadcast.university,
          department: pendingBroadcast.department,
          level: pendingBroadcast.level,
          createdByType: "Student",
          createdBy: student._id,
        });
        const stats = await deliverAnnouncementNow(announcement._id.toString());
        const delivered = stats?.delivered ?? 0;
        const targeted = stats?.targeted ?? pendingBroadcast.audienceCount;
        await reply(
          from,
          `✅ *Broadcast dispatched!*\n\nDelivered to ${delivered}/${targeted} students in ${pendingBroadcast.department} ${pendingBroadcast.level}.`,
        );
      } catch (err) {
        logger.error("Failed to dispatch WhatsApp broadcast", {
          to: from,
          error: err instanceof Error ? err.message : "unknown",
        });
        await reply(
          from,
          "⚠️ Something went wrong sending that broadcast — please try again.",
        );
      }
      return;
    }

    if (normalized === "cancel") {
      setWaSession(from, "IDLE", { pendingBroadcast: undefined });
      await reply(from, "Broadcast discarded.");
      return;
    }

    // Anything else (a correction, a new question) drops the stale draft rather than
    // silently keeping it around — a later "send broadcast" shouldn't resurrect an
    // outdated preview. Falls through to the normal flow below.
    setWaSession(from, "IDLE", { pendingBroadcast: undefined });
  }

  // Fast, free greeting/reset — no LLM call needed, and fully deterministic
  // (not left to the model's judgment, which turned out to be unreliable at
  // deciding when a quick-reply menu is warranted).
  if (isGreeting(input)) {
    clearWaSession(from);
    const firstName = student.fullName.split(" ")[0];
    await sendMainMenu(from, student, `Hey ${firstName}! 👋 What would you like to do?`);
    return;
  }

  // Quants: balance checks and top-ups are deterministic and free — they never
  // reach the agent, so a student who's out of quants can always still pay.
  const topupAmount = parseTopupSelection(input);
  if (topupAmount) {
    await sendTopupLink(student, topupAmount);
    return;
  }
  const quantIntent = detectQuantIntent(input);
  if (quantIntent?.kind === "topup") {
    if (quantIntent.amount) {
      await sendTopupLink(student, quantIntent.amount);
    } else {
      await sendTopupOptions(from, "How much would you like to top up?");
    }
    return;
  }
  if (quantIntent?.kind === "balance") {
    await sendTopupOptions(from, `${balanceText(student.quants)}\n\nWant to top up?`);
    return;
  }

  if (!(await canAffordMessage(student, input.length))) {
    await sendTopupOptions(
      from,
      `You're out of quants 💎\n\n${balanceText(student.quants)} Top up to keep chatting:`,
    );
    return;
  }

  const pricing = await getPricing();
  const usage = await runAgent(from, student, input, {
    billingEnabled: pricing.billingEnabled,
    lowBalance: await isLowBalance(student.quants),
  });
  if (!usage) return; // the agent failed — never charge for an apology

  const balance = await chargeForMessage(student._id, input.length, usage);
  if (balance !== null && (await isOutOfQuants(balance))) {
    await sendTopupOptions(
      from,
      `That was your last message for now — you have *${balance} quants* left. Top up to keep chatting:`,
    );
  }
}

// HOC-only tools (schedule/edit/cancel a class) are only offered to HOCs —
// the model never even sees them as an option otherwise. executeTool re-checks
// isHOC itself too, as defense in depth.
function buildToolDefinitions(student: StudentDoc) {
  if (student.isHOC) return TOOL_DEFINITIONS;
  return TOOL_DEFINITIONS.filter((t) => !HOC_ONLY_TOOLS.has(t.function.name));
}

// WhatsApp caps an interactive message's body at 1024 chars — a longer reply
// goes out as plain text, followed by the buttons on a short prompt of their own.
const INTERACTIVE_BODY_LIMIT = 1024;

/** Sends a reply with quick-reply buttons. Returns false if the caller should fall back to plain text. */
async function sendWithSuggestions(
  from: string,
  text: string,
  titles: string[],
): Promise<boolean> {
  if (titles.length === 0) return false;
  const buttons = titles.map((title, idx) => ({ id: `opt_${idx}`, title }));
  try {
    if (text.length <= INTERACTIVE_BODY_LIMIT) {
      await sendWhatsAppButtons(from, { bodyText: text, buttons });
    } else {
      await sendWhatsAppText(from, text);
      await sendWhatsAppButtons(from, { bodyText: "Anything else?", buttons }).catch(
        (err) =>
          logger.error("Failed to send follow-up suggestion buttons", {
            to: from,
            error: err instanceof Error ? err.message : "unknown",
          }),
      );
    }
    return true;
  } catch (err) {
    logger.error("Failed to send suggestion buttons, falling back to text", {
      to: from,
      error: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

/** Returns the turn's Groq usage, or null if no real answer came back. */
async function runAgent(
  from: string,
  student: StudentDoc,
  input: string,
  billing: { billingEnabled: boolean; lowBalance: boolean },
): Promise<GroqUsage | null> {
  const history = getWaSession(from).messages;
  const turn: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(student, billing.billingEnabled) },
    ...history,
    { role: "user", content: input },
  ];

  const tools = buildToolDefinitions(student);
  const usage: GroqUsage = { promptTokens: 0, completionTokens: 0 };

  let finalReply: string | null = null;
  // Set when reply_with_options already delivered the message as a buttons
  // interactive message — skip the plain-text send at the end in that case.
  let sentViaButtons = false;
  // Documents are sent as real attachments the moment the tool resolves them — never
  // routed through the model's own text, so it can't mistype a link or an id.
  const sentFileUrls = new Set<string>();
  // Deterministic quick-reply suggestions, collected from each tool's actual
  // result rather than hoping the model chooses to call reply_with_options —
  // tool-calling models are trained to reach for tools that fetch/do something,
  // not ones that reformat their own answer, so relying on it alone turned out
  // to be unreliable in practice. See waSuggestions.ts.
  const suggestions: string[] = [];

  outer: for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const message = await completeChat(turn, tools, usage);
    if (!message) break;

    if (message.tool_calls && message.tool_calls.length > 0) {
      turn.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // leave args empty — the tool executor will just get no params
        }

        // Terminal action, not a data tool: ends the turn by sending a
        // buttons message instead of looping back with a tool result.
        if (call.function.name === "reply_with_options") {
          const { bodyText, buttons } = args as {
            bodyText?: string;
            buttons?: string[];
          };
          finalReply = bodyText?.trim() || null;

          if (finalReply && buttons && buttons.length > 0) {
            try {
              await sendWhatsAppButtons(from, {
                bodyText: finalReply,
                buttons: buttons
                  .slice(0, 3)
                  .map((title, idx) => ({ id: `opt_${idx}`, title })),
              });
              sentViaButtons = true;
            } catch (err) {
              // Bad button title (e.g. over 20 chars) or a send failure — fall
              // back to a plain reply rather than losing the answer entirely.
              logger.error("Failed to send WhatsApp buttons, falling back to text", {
                to: from,
                error: err instanceof Error ? err.message : "unknown",
              });
            }
          }
          break outer;
        }

        const result = await executeTool(
          call.function.name,
          args,
          student,
        ).catch((err) => ({
          error: err instanceof Error ? err.message : "Tool execution failed",
        }));

        // Terminal, like reply_with_options: the preview text and Send/Cancel buttons
        // are built here deterministically — not left to the model's own phrasing —
        // since audienceCount comes straight from the DB and this is the one message
        // in the whole bot that fans out to an entire class.
        if (call.function.name === "preview_broadcast") {
          const r = result as {
            success?: boolean;
            title?: string;
            message?: string;
            university?: string;
            department?: string;
            level?: string;
            audienceCount?: number;
          };

          if (
            r.success &&
            r.title &&
            r.message &&
            r.department &&
            r.level &&
            typeof r.audienceCount === "number"
          ) {
            const previewText =
              `📋 *Broadcast Preview*\n` +
              `Target: *${r.department} ${r.level}*\n` +
              `Audience: *${r.audienceCount}* student${r.audienceCount === 1 ? "" : "s"}\n\n` +
              `"${r.message}"\n\n` +
              `Ready to send?`;

            setWaSession(from, "IDLE", {
              pendingBroadcast: {
                title: r.title,
                message: r.message,
                university: r.university,
                department: r.department,
                level: r.level,
                audienceCount: r.audienceCount,
              },
            });

            try {
              await sendWhatsAppButtons(from, {
                bodyText: previewText,
                buttons: [
                  { id: "opt_send_broadcast", title: "Send broadcast" },
                  { id: "opt_cancel_broadcast", title: "Cancel" },
                ],
              });
              sentViaButtons = true;
            } catch (err) {
              logger.error(
                "Failed to send broadcast preview buttons, falling back to text",
                { to: from, error: err instanceof Error ? err.message : "unknown" },
              );
            }
            finalReply = previewText;
          } else {
            finalReply =
              (result as { message?: string }).message ??
              "Couldn't draft that broadcast — only HOCs can send one.";
          }
          break outer;
        }

        suggestions.push(
          ...suggestionsForTool(
            call.function.name,
            result as Record<string, unknown>,
            student,
          ),
        );

        if (call.function.name === "get_document_link") {
          const r = result as {
            found?: boolean;
            fileUrl?: string;
            filename?: string;
          };
          if (r.found && r.fileUrl && !sentFileUrls.has(r.fileUrl)) {
            sentFileUrls.add(r.fileUrl);
            await sendWhatsAppDocument(
              from,
              r.fileUrl,
              r.filename ?? "document.pdf",
            ).catch((err) => {
              logger.error("Failed to send WhatsApp document", {
                to: from,
                error: err instanceof Error ? err.message : "unknown",
              });
            });
          }
        }

        turn.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    finalReply = message.content?.trim() || null;
    break;
  }

  const answered = !!finalReply;
  if (!finalReply) {
    finalReply =
      "Sorry, I'm having trouble right now — please try again in a moment.";
  }

  // Defense in depth: strip any URL the model wrote anyway, despite the system
  // prompt telling it not to — the file already went out as a real attachment.
  if (sentFileUrls.size > 0) {
    finalReply = finalReply
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (!finalReply) finalReply = "Here you go!";
  }

  if (!sentViaButtons && answered) {
    sentViaButtons = await sendWithSuggestions(
      from,
      finalReply,
      finalizeSuggestions(suggestions, { topUp: billing.lowBalance }),
    );
  }

  if (!sentViaButtons) {
    await reply(from, finalReply);
  }
  appendWaHistory(from, [
    { role: "user", content: input },
    { role: "assistant", content: finalReply },
  ]);
  return answered ? usage : null;
}

const REQUIRED_REG_FIELDS = [
  "fullName",
  "email",
  "matricNumber",
  "university",
  "department",
  "level",
] as const;
const REG_FIELD_LABELS: Record<(typeof REQUIRED_REG_FIELDS)[number], string> = {
  fullName: "full name",
  email: "email",
  matricNumber: "matric number",
  university: "university",
  department: "department",
  level: "level",
};

const REG_EXTRACTION_SYSTEM_PROMPT = `You extract student registration details from a WhatsApp message. The
student may give details in any order or format, possibly spread across multiple messages.

Fields:
- fullName: their full name
- email: a valid email address
- matricNumber: their matric/student ID number
- university: school/institution name (e.g. "LASU")
- department: academic department (e.g. "Mechanical Engineering")
- level: academic level — must be exactly one of "100", "200", "300", "400", "500"

From the student's latest message, extract any NEW values for fields not yet known, or
clear corrections to ones that are. Only include a field if you're confident about it —
never guess or invent a value, and never fabricate an email or matric number that isn't
actually present in the message. Omit a field entirely if it's not mentioned.

Return strict JSON with only the keys you extracted, e.g. {"fullName": "Ada Lovelace", "level": "300"}.`;

/** Extracts whatever registration fields it can from one free-form message. */
async function extractRegistrationFields(
  input: string,
  known: Record<string, unknown>,
): Promise<Record<string, string>> {
  const result = await completeJson([
    { role: "system", content: REG_EXTRACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Already known: ${JSON.stringify(known)}\n\nLatest message: ${input}`,
    },
  ]);
  if (!result) return {};

  const extracted: Record<string, string> = {};
  for (const field of REQUIRED_REG_FIELDS) {
    const value = result[field];
    if (typeof value === "string" && value.trim())
      extracted[field] = value.trim();
  }

  if (extracted.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extracted.email))
    delete extracted.email;
  if (extracted.email) extracted.email = extracted.email.toLowerCase();
  if (
    extracted.level &&
    !["100", "200", "300", "400", "500"].includes(extracted.level)
  )
    delete extracted.level;

  // Deterministic fallback for common shorthand ("200l", "300L", "400lvl", "yr 4") the
  // model can miss — don't rely on it alone for something a regex nails reliably.
  if (!extracted.level && !known.level) {
    const shorthand = input.match(
      /\b(100|200|300|400|500)\s*(?:l|lvl|level)\b/i,
    );
    if (shorthand) extracted.level = shorthand[1];
  }

  return extracted;
}

export interface RegistrationFields {
  fullName: string;
  email: string;
  matricNumber: string;
  university: string;
  department: string;
  level: string;
  referredByCode?: string;
}

/**
 * Shared by all three registration paths (text wizard, WhatsApp Flow, and the
 * web fallback page): creates the account and sends the email OTP, with the
 * same dead-end recovery — if the account got created but the OTP send failed,
 * resend rather than error out on a duplicate-account conflict when they retry.
 */
export async function completeRegistration(
  from: string,
  fields: RegistrationFields,
): Promise<void> {
  try {
    await authService.registerStudent(
      {
        ...fields,
        phone: from,
        // Bot-registered students only ever interact over WhatsApp — a web portal
        // password only matters if they're later made an ambassador, at which
        // point they'd need a password-reset flow (not built yet).
        password: crypto.randomBytes(24).toString("hex"),
      },
      true, // bot-origin: phone auto-verified, only an email OTP goes out
    );
  } catch (err) {
    const existing = await Student.findOne({ phone: from });
    if (existing) {
      try {
        await issueOtp(existing.email, "email", "email_verification");
        setWaSession(from, "AWAITING_EMAIL_OTP");
        await reply(from, fmt.formatRegistrationComplete());
      } catch {
        clearWaSession(from);
        await reply(
          from,
          "⚠️ I couldn't send a verification code to that email address. " +
            "Type *hi* to start over with a different email.",
        );
      }
      return;
    }

    clearWaSession(from);
    const message = err instanceof Error ? err.message : "Something went wrong";
    await reply(from, `⚠️ ${message}\n\nType *hi* to try registering again.`);
    return;
  }

  setWaSession(from, "AWAITING_EMAIL_OTP");
  await reply(from, fmt.formatRegistrationComplete());
}

// The Flow's dropdowns submit stable ids, not the display text — map back to the
// free-text values Student stores (matches how the rest of the system already
// records university/department, e.g. "LASU").
const SCHOOL_NAMES: Record<string, string> = {
  lasu: "LASU",
};

const DEPARTMENT_NAMES: Record<string, string> = {
  aeronautics_astronautics: "Aeronautics and Astronautics Engineering",
  aerospace_engineering: "Aerospace Engineering",
  chemical_engineering: "Chemical Engineering",
  electronics_computer_engineering: "Electronics and Computer Engineering",
  mechanical_engineering: "Mechanical Engineering",
};

interface FlowRegistrationResponse {
  first_name: string;
  surname: string;
  email: string;
  school: string;
  faculty: string; // collected but not persisted — Student has no faculty field
  department: string;
  matric_number: string;
  level: string;
  referral_code?: string;
}

/** Handles the final `nfm_reply` webhook message once the registration Flow is submitted. */
export function processFlowSubmission(
  from: string,
  responseJson: string,
): Promise<void> {
  return enqueue(
    from,
    () => processFlowSubmissionInner(from, responseJson),
    "WhatsApp flow submission processing failed",
  );
}

async function processFlowSubmissionInner(
  from: string,
  responseJson: string,
): Promise<void> {
  let data: FlowRegistrationResponse;
  try {
    data = JSON.parse(responseJson);
  } catch {
    logger.error("Failed to parse Flow response_json", { from });
    return;
  }

  await completeRegistration(from, {
    fullName: `${data.first_name} ${data.surname}`.trim(),
    email: data.email,
    matricNumber: data.matric_number,
    university: SCHOOL_NAMES[data.school] ?? data.school,
    department: DEPARTMENT_NAMES[data.department] ?? data.department,
    level: data.level,
    referredByCode: data.referral_code || undefined,
  });
}

async function handleRegistration(
  from: string,
  input: string,
  state: WaState,
  data: Record<string, unknown>,
): Promise<void> {
  if (state === "IDLE") {
    try {
      await sendWhatsAppFlow(from, {
        headerText: "Welcome to Quant",
        bodyText:
          "Let's get you registered — tap below to fill in your details.",
        ctaText: "Register",
        firstScreen: "PERSONAL_INFO",
      });
      setWaSession(from, "AWAITING_FLOW_SUBMISSION");
    } catch (err) {
      // Flow send failed (e.g. it's still unpublished/pending Business Verification)
      // — fall back rather than going silent. Which fallback is a toggle (env var),
      // not a code change, so it's cheap to flip once the Flow is publishable again.
      logger.warn("WhatsApp Flow send failed, using registration fallback", {
        fallback: env.REGISTRATION_FALLBACK,
        error: err instanceof Error ? err.message : "unknown",
      });

      if (env.REGISTRATION_FALLBACK === "web") {
        const token = createRegistrationToken(from);
        setWaSession(from, "AWAITING_WEB_REGISTRATION");
        try {
          // A CTA-URL button opens in WhatsApp's own in-app browser — a plain
          // link in a text message would kick out to the external browser instead.
          await sendWhatsAppCtaUrl(from, {
            bodyText:
              "Let's get you registered — tap below to fill in your details. (Link expires in 30 minutes.)",
            buttonText: "Register",
            url: `${env.APP_BASE_URL}/register/${token}`,
          });
        } catch (ctaErr) {
          logger.error("Failed to send registration CTA URL", {
            to: from,
            error: ctaErr instanceof Error ? ctaErr.message : "unknown",
          });
        }
      } else {
        setWaSession(from, "AWAITING_REG_DETAILS");
        await reply(from, fmt.formatWelcome());
      }
    }
    return;
  }

  if (state === "AWAITING_FLOW_SUBMISSION") {
    await reply(
      from,
      "Just fill in the form above 👆 to finish registering — or type *hi* to restart.",
    );
    return;
  }

  if (state === "AWAITING_WEB_REGISTRATION") {
    await reply(
      from,
      "Just fill in the form from the link above 👆 to finish registering — or type *hi* for a new link.",
    );
    return;
  }

  switch (state) {
    case "AWAITING_REG_DETAILS": {
      const extracted = await extractRegistrationFields(input, data);
      setWaSession(from, "AWAITING_REG_DETAILS", extracted);

      const merged = { ...data, ...extracted } as Record<
        string,
        string | undefined
      >;
      const missing = REQUIRED_REG_FIELDS.filter((field) => !merged[field]);

      if (missing.length > 0) {
        const list = missing.map((field) => REG_FIELD_LABELS[field]).join(", ");
        await reply(
          from,
          Object.keys(extracted).length > 0
            ? `Got it. Still need your ${list} to finish up.`
            : `I couldn't quite pick that up — still need your ${list}.`,
        );
        return;
      }

      await completeRegistration(from, {
        fullName: merged.fullName!,
        email: merged.email!,
        matricNumber: merged.matricNumber!,
        university: merged.university!,
        department: merged.department!,
        level: merged.level!,
      });
      return;
    }
    case "AWAITING_EMAIL_OTP": {
      const email = (await Student.findOne({ phone: from }))?.email;
      if (!email) {
        clearWaSession(from);
        await reply(from, "Something went wrong — type *hi* to start over.");
        return;
      }

      if (/^resend/i.test(input.trim())) {
        try {
          await issueOtp(email, "email", "email_verification");
          setWaSession(from, "AWAITING_EMAIL_OTP");
          await reply(
            from,
            "✅ Sent a new 6-digit code to your email — reply with it here.",
          );
        } catch {
          await reply(
            from,
            "⚠️ Couldn't send a new code right now — try again in a bit.",
          );
        }
        return;
      }

      try {
        await verifyOtp(email, "email_verification", input.trim());
        const student = await Student.findOneAndUpdate(
          { email },
          { isEmailVerified: true },
          { new: true },
        );
        clearWaSession(from);
        sendWelcomeEmailInBackground(student!.email, student!.fullName);
        await reply(from, fmt.formatEmailVerified(student!));
        await sendMainMenu(from, student!, "Here's what I can help with 👇");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "That code didn't work";
        await reply(
          from,
          `⚠️ ${message} — try again, or type *resend* for a new code.`,
        );
      }
      return;
    }
    default:
      clearWaSession(from);
      await reply(from, "Type *hi* to get started.");
  }
}
