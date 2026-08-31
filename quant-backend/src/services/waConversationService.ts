import crypto from "crypto";
import { Student, StudentDoc } from "../models/Student";
import * as authService from "./authService";
import { verifyOtp, issueOtp } from "./otpService";
import { sendWhatsAppText } from "./waService";
import { getWaSession, setWaSession, clearWaSession, appendWaHistory, WaState } from "./waSession";
import { completeChat, ChatMessage } from "./groqAgentService";
import { TOOL_DEFINITIONS, executeTool } from "./waTools";
import { logger } from "../utils/logger";
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
obvious match, in which case just get its link directly.

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

export function processIncomingMessage(from: string, body: string): Promise<void> {
  const previous = processingQueues.get(from) ?? Promise.resolve();
  const next = previous
    .then(() => processIncomingMessageInner(from, body))
    .catch((err) => {
      logger.error("WhatsApp message processing failed", {
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
  // Never trust the model to transcribe a URL correctly when paraphrasing a tool
  // result — collect real links out-of-band and append them verbatim instead.
  const verifiedLinks: { title: string; url: string }[] = [];

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
          const r = result as { found?: boolean; url?: string; title?: string };
          if (r.found && r.url && !verifiedLinks.some((l) => l.url === r.url)) {
            verifiedLinks.push({ title: r.title ?? "Document", url: r.url });
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

  if (verifiedLinks.length > 0) {
    // Strip whatever URL(s) the model wrote — it may have mistyped one — and
    // append the verified links itself, so what's sent always matches the DB exactly.
    finalReply = finalReply.replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n").trim();
    finalReply += "\n\n" + verifiedLinks.map((l) => `${l.title}: ${l.url}`).join("\n");
  }

  await reply(from, finalReply);
  appendWaHistory(from, [
    { role: "user", content: input },
    { role: "assistant", content: finalReply },
  ]);
}

async function handleRegistration(
  from: string,
  input: string,
  state: WaState,
  data: Record<string, unknown>
): Promise<void> {
  if (state === "IDLE") {
    setWaSession(from, "AWAITING_REG_NAME");
    await reply(from, fmt.formatWelcome());
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
      try {
        await authService.registerStudent(
          {
            fullName: data.fullName as string,
            phone: from,
            email: data.email as string,
            // Bot-registered students only ever interact over WhatsApp — a web
            // portal password only matters if they're later made an ambassador,
            // at which point they'd need a password-reset flow (not built yet).
            password: crypto.randomBytes(24).toString("hex"),
            matricNumber: data.matricNumber as string,
            university: data.university as string,
            department: data.department as string,
            level: input,
          },
          true // bot-origin: phone auto-verified, only an email OTP goes out
        );
      } catch (err) {
        // registerStudent creates the Student row before it sends the email OTP, so a
        // failure here (e.g. the email provider rejecting the address) can still leave
        // an account behind. Retrying "register" would then dead-end on a duplicate-
        // account conflict — recover by just re-sending the OTP for that account instead.
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
