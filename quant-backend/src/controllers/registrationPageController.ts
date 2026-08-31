import { Request, Response } from "express";
import { peekRegistrationToken, consumeRegistrationToken } from "../services/registrationTokenService";
import { completeRegistration } from "../services/waConversationService";

const LEVELS = ["100", "200", "300", "400", "500"];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px; min-height: 100vh;
    background: #0a0a0a; color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: flex-start; justify-content: center;
  }
  .card { width: 100%; max-width: 420px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { color: #a1a1aa; font-size: 14px; margin: 0 0 24px; }
  label { display: block; font-size: 13px; color: #a1a1aa; margin: 16px 0 6px; }
  input, select {
    width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #27272a;
    background: #18181b; color: #f4f4f5; font-size: 15px;
  }
  input:focus, select:focus { outline: none; border-color: #16a34a; }
  button {
    width: 100%; margin-top: 24px; padding: 14px; border-radius: 10px; border: none;
    background: #16a34a; color: white; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button:active { transform: scale(0.98); }
  .error { background: #451a1a; border: 1px solid #7f1d1d; color: #fca5a5; padding: 12px 14px; border-radius: 10px; font-size: 14px; margin-bottom: 16px; }
  .success { text-align: center; padding-top: 60px; }
  .success h1 { font-size: 22px; }
  .success p { color: #a1a1aa; font-size: 15px; line-height: 1.5; }
  .badge { display: inline-block; background: #16a34a1a; color: #4ade80; font-size: 12px; padding: 4px 10px; border-radius: 999px; margin-bottom: 12px; }
</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

export function showRegistrationForm(req: Request, res: Response): void {
  const phone = peekRegistrationToken(req.params.token);
  if (!phone) {
    res.status(410).send(
      pageShell(
        "Link expired",
        `<div class="success"><h1>This link has expired</h1><p>Go back to WhatsApp and type <b>hi</b> to get a fresh registration link.</p></div>`
      )
    );
    return;
  }

  res.send(pageShell("Register — Quant", renderForm(req.params.token)));
}

function renderForm(token: string, errorMessage?: string, values: Record<string, string> = {}): string {
  const v = (name: string) => escapeHtml(values[name] ?? "");
  return `
    <span class="badge">Quant</span>
    <h1>Create your account</h1>
    <p class="sub">Fill this in to finish registering over WhatsApp.</p>
    ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ""}
    <form method="POST" action="/register/${token}">
      <label>Full Name</label>
      <input name="fullName" required value="${v("fullName")}" />

      <label>Email Address</label>
      <input name="email" type="email" required value="${v("email")}" />

      <label>Matric Number</label>
      <input name="matricNumber" required value="${v("matricNumber")}" />

      <label>University</label>
      <input name="university" required value="${v("university")}" />

      <label>Department</label>
      <input name="department" required value="${v("department")}" />

      <label>Level</label>
      <select name="level" required>
        <option value="">Select level</option>
        ${LEVELS.map((l) => `<option value="${l}" ${values.level === l ? "selected" : ""}>${l} Level</option>`).join("")}
      </select>

      <label>Referral Code (optional)</label>
      <input name="referredByCode" value="${v("referredByCode")}" />

      <button type="submit">Submit</button>
    </form>
  `;
}

export async function submitRegistrationForm(req: Request, res: Response): Promise<void> {
  const token = req.params.token;
  const phone = peekRegistrationToken(token);
  if (!phone) {
    res.status(410).send(
      pageShell(
        "Link expired",
        `<div class="success"><h1>This link has expired</h1><p>Go back to WhatsApp and type <b>hi</b> to get a fresh registration link.</p></div>`
      )
    );
    return;
  }

  const body = req.body as Record<string, string>;
  const required = ["fullName", "email", "matricNumber", "university", "department", "level"];
  const missing = required.filter((field) => !body[field]?.trim());

  if (missing.length > 0) {
    res.status(400).send(pageShell("Register — Quant", renderForm(token, "Please fill in all required fields.", body)));
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    res.status(400).send(pageShell("Register — Quant", renderForm(token, "That email address doesn't look valid.", body)));
    return;
  }

  consumeRegistrationToken(token);

  await completeRegistration(phone, {
    fullName: body.fullName.trim(),
    email: body.email.trim().toLowerCase(),
    matricNumber: body.matricNumber.trim(),
    university: body.university.trim(),
    department: body.department.trim(),
    level: body.level.trim(),
    referredByCode: body.referredByCode?.trim() || undefined,
  });

  res.send(
    pageShell(
      "Check WhatsApp",
      `<div class="success"><h1>✅ Almost done</h1><p>Go back to WhatsApp — we've sent a verification code to your email. Reply with it there to finish.</p></div>`
    )
  );
}
