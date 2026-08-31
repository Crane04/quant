import crypto from "crypto";
import { Student, StudentDoc } from "../models/Student";
import * as authService from "./authService";
import { verifyOtp, issueOtp } from "./otpService";
import { sendWhatsAppText, sendWhatsAppDocument, sendWhatsAppFlow, sendWhatsAppCtaUrl } from "./waService";
import { getWaSession, setWaSession, clearWaSession, appendWaHistory, WaState } from "./waSession";
import { completeChat, ChatMessage } from "./groqAgentService";
import { TOOL_DEFINITIONS, executeTool } from "./waTools";
import { createRegistrationToken } from "./registrationTokenService";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import * as fmt from "./waFormatter";

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

function buildSystemPrompt(student: StudentDoc): string {
  return `You are Quant, a WhatsApp assistant for university students. You're chatting with:
- Name: ${student.fullName}
- University: ${student.university}
- Department: ${student.department}
- Level: ${student.level}
Today's date: ${new Date().toISOString().slice(0, 10)}

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

For enroll_in_courses and record_grade, ask for any missing required detail (session, semester,
etc.) in a normal sentence before calling the tool — don't guess values the student didn't give you.

Keep replies short and WhatsApp-appropriate: plain text, *single asterisks* for bold, no markdown
tables or headers, no long paragraphs.`;
}

// Serializes processing per phone number. The webhook handler fires-and-forgets each
// message (it has to — Meta needs a fast 200 ack), so without this, two messages
// arriving close together for the same user race on the in-memory WaSession: the
// second can read state the first hasn't finished writing yet. Different phone
// numbers still run fully in parallel — only same-phone calls are chained.
const processingQueues = new Map<string, Promise<void>>();

function enqueue(from: string, task: () => Promise<void>, errorLabel: string): Promise<void> {
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

export function processIncomingMessage(from: string, body: string): Promise<void> {
  return enqueue(from, () => processIncomingMessageInner(from, body), "WhatsApp message processing failed");
}

async function processIncomingMessageInner(from: string, body: string): Promise<void> {
  const input = body.trim();
  if (!input) return;

  await Student.updateOne({ phone: from }, { lastSeenAt: new Date() });
  const student = await Student.findOne({ phone: from });
  const wa = getWaSession(from);

  // Unregistered, or mid-registration (e.g. still waiting on the email OTP) — the
  // structured wizard owns this conversation until it's done. Registration needs
  // exact field-by-field data collection gated by an OTP, which isn't a good fit
  // for a tool-calling agent that might paraphrase or skip a field.
  if (!student || wa.state !== "IDLE") {
    await handleRegistration(from, input, wa.state, wa.data);
    return;
  }

  // Fast, free hard-reset — no LLM call needed.
  if (["menu", "reset", "restart"].includes(input.toLowerCase())) {
    clearWaSession(from);
    await reply(
      from,
      `Hey ${student.fullName.split(" ")[0]}! Ask me anything — course material, your timetable, assignments, CGPA, or enrolling in a course.`
    );
    return;
  }

  await runAgent(from, student, input);
}

async function runAgent(from: string, student: StudentDoc, input: string): Promise<void> {
  const history = getWaSession(from).messages;
  const turn: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(student) },
    ...history,
    { role: "user", content: input },
  ];

  let finalReply: string | null = null;
  // Documents are sent as real attachments the moment the tool resolves them — never
  // routed through the model's own text, so it can't mistype a link or an id.
  const sentFileUrls = new Set<string>();

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const message = await completeChat(turn, TOOL_DEFINITIONS);
    if (!message) break;

    if (message.tool_calls && message.tool_calls.length > 0) {
      turn.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // leave args empty — the tool executor will just get no params
        }

        const result = await executeTool(call.function.name, args, student).catch((err) => ({
          error: err instanceof Error ? err.message : "Tool execution failed",
        }));

        if (call.function.name === "get_document_link") {
          const r = result as { found?: boolean; fileUrl?: string; filename?: string };
          if (r.found && r.fileUrl && !sentFileUrls.has(r.fileUrl)) {
            sentFileUrls.add(r.fileUrl);
            await sendWhatsAppDocument(from, r.fileUrl, r.filename ?? "document.pdf").catch((err) => {
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

  if (!finalReply) {
    finalReply = "Sorry, I'm having trouble right now — please try again in a moment.";
  }

  // Defense in depth: strip any URL the model wrote anyway, despite the system
  // prompt telling it not to — the file already went out as a real attachment.
  if (sentFileUrls.size > 0) {
    finalReply = finalReply.replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n").trim();
    if (!finalReply) finalReply = "Here you go!";
  }

  await reply(from, finalReply);
  appendWaHistory(from, [
    { role: "user", content: input },
    { role: "assistant", content: finalReply },
  ]);
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
export async function completeRegistration(from: string, fields: RegistrationFields): Promise<void> {
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
      true // bot-origin: phone auto-verified, only an email OTP goes out
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
            "Type *hi* to start over with a different email."
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
export function processFlowSubmission(from: string, responseJson: string): Promise<void> {
  return enqueue(from, () => processFlowSubmissionInner(from, responseJson), "WhatsApp flow submission processing failed");
}

async function processFlowSubmissionInner(from: string, responseJson: string): Promise<void> {
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
  data: Record<string, unknown>
): Promise<void> {
  if (state === "IDLE") {
    try {
      await sendWhatsAppFlow(from, {
        headerText: "Welcome to Quant",
        bodyText: "Let's get you registered — tap below to fill in your details.",
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
            bodyText: "Let's get you registered — tap below to fill in your details. (Link expires in 30 minutes.)",
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
        setWaSession(from, "AWAITING_REG_NAME");
        await reply(from, fmt.formatWelcome());
      }
    }
    return;
  }

  if (state === "AWAITING_FLOW_SUBMISSION") {
    await reply(from, "Just fill in the form above 👆 to finish registering — or type *hi* to restart.");
    return;
  }

  if (state === "AWAITING_WEB_REGISTRATION") {
    await reply(from, "Just fill in the form from the link above 👆 to finish registering — or type *hi* for a new link.");
    return;
  }

  switch (state) {
    case "AWAITING_REG_NAME": {
      if (input.length < 2) return void (await reply(from, "That name looks too short — try again?"));
      setWaSession(from, "AWAITING_REG_EMAIL", { fullName: input });
      await reply(from, fmt.formatRegistrationPrompt("email"));
      return;
    }
    case "AWAITING_REG_EMAIL": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
        return void (await reply(from, "That doesn't look like a valid email — try again?"));
      }
      setWaSession(from, "AWAITING_REG_MATRIC", { email: input.toLowerCase() });
      await reply(from, fmt.formatRegistrationPrompt("matric"));
      return;
    }
    case "AWAITING_REG_MATRIC": {
      setWaSession(from, "AWAITING_REG_UNIVERSITY", { matricNumber: input });
      await reply(from, fmt.formatRegistrationPrompt("university"));
      return;
    }
    case "AWAITING_REG_UNIVERSITY": {
      setWaSession(from, "AWAITING_REG_DEPARTMENT", { university: input });
      await reply(from, fmt.formatRegistrationPrompt("department"));
      return;
    }
    case "AWAITING_REG_DEPARTMENT": {
      setWaSession(from, "AWAITING_REG_LEVEL", { department: input });
      await reply(from, fmt.formatRegistrationPrompt("level"));
      return;
    }
    case "AWAITING_REG_LEVEL": {
      await completeRegistration(from, {
        fullName: data.fullName as string,
        email: data.email as string,
        matricNumber: data.matricNumber as string,
        university: data.university as string,
        department: data.department as string,
        level: input,
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

      try {
        await verifyOtp(email, "email_verification", input.trim());
        const student = await Student.findOneAndUpdate(
          { email },
          { isEmailVerified: true },
          { new: true }
        );
        clearWaSession(from);
        await reply(from, fmt.formatEmailVerified(student!));
      } catch (err) {
        const message = err instanceof Error ? err.message : "That code didn't work";
        await reply(from, `⚠️ ${message} — try again.`);
      }
      return;
    }
    default:
      clearWaSession(from);
      await reply(from, "Type *hi* to get started.");
  }
}
