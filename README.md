# Quant

Quant is a WhatsApp-native academic assistant for university students (built for
LASU Engineering). Students do almost everything by chatting with a WhatsApp
number — no app to install. An admin web dashboard sits behind it for staff to
manage the course catalogue, review uploaded material, and run the
gamification program.

## What it actually does

Talking to the WhatsApp bot, a student can:

- **Register** via a WhatsApp Flow form (falls back to a web page or a
  plain-text chat wizard if the Flow can't be sent), then verify their email
  with an OTP.
- **Find course material** — lecture notes, past questions, exam summaries —
  by course code or topic, and get the PDF sent to them as a real WhatsApp
  file attachment.
- **Check their timetable**, based on the courses they're enrolled in.
- **Save personal assignment reminders** and mark them done.
- **Enroll in courses** and **record grades**, then ask for their **CGPA** —
  including a projection of what GPA they need each remaining semester to hit
  a target they set.
- **Subscribe/unsubscribe** to a course's schedule notifications (useful for
  carryovers or borrowed courses outside their own class).
- Get an automatic **"class starts in 10 minutes"** nudge for every course
  they're subscribed to.

All of this is handled by a tool-calling LLM agent (via Groq), not a fixed
decision tree — see [How the WhatsApp bot works](#how-the-whatsapp-bot-works).

Two extra roles layer on top of the base student:

- **HOC (Head of Class)** — can schedule, edit, or cancel a class time for
  their own class via chat; subscribed students are notified automatically.
- **Ambassador** — can log into a web portal (implicit — no separate ambassador
  app exists yet, this is API-level), upload course material for admin review,
  post lecture alerts / announcements to their (university, department,
  level) scope, and earns points/badges/rewards for approved uploads, visible
  on a leaderboard.

## Repo layout

| Package                            | What it is                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`quant-backend/`](quant-backend/) | Everything: the REST API, the MongoDB models, **and** the WhatsApp bot logic (webhook, WhatsApp Flow endpoint, Groq agent, schedulers) — TypeScript, Express, Mongoose, Zod |
| [`admin/`](admin/)                 | The admin dashboard — React 18 + TypeScript + Vite, Tailwind, TanStack Query                    |

There is no separate bot codebase — an earlier standalone `bot/` package was
removed once its logic was folded into `quant-backend` (see `services/wa*.ts`,
`controllers/webhookController.ts`, `controllers/flowController.ts`).

Each package has its own README with setup, environment variables, and
endpoint/feature details — this file is the map between them.

## Architecture

`quant-backend` is the single source of truth. It's reached by three kinds of
caller, all resolved by the same `resolveStudentContext` middleware:

- **WhatsApp** (the primary interface) — Meta sends messages to
  `POST /webhook/whatsapp`; the backend knows who's texting from their phone
  number, so no login is needed. Replies go out asynchronously via the Meta
  Graph API.
- **The admin dashboard** (`admin/`) — email+password login issuing a
  DB-backed session token, scoped to `admin`/`super_admin` roles.
- **A trusted service caller** — anything else automating the catalogue
  (course/timetable/assignment seeding) authenticates with a shared
  `x-api-key` (`BOT_SERVICE_API_KEY`) instead of a session.

See [`quant-backend/README.md`](quant-backend/README.md) for the full auth,
data model, and gamification write-up.

## How the WhatsApp bot works

1. **Registration** (`services/waConversationService.ts`): an unregistered or
   unverified number is owned by a structured wizard, not the free-form
   agent — registration needs exact field-by-field data behind an OTP, which
   a paraphrasing tool-calling model isn't a good fit for. It tries a
   WhatsApp Flow form first; if that fails (e.g. unpublished), it falls back
   to either a hosted `/register/:token` web page or a plain-text
   extraction wizard (`REGISTRATION_FALLBACK` env var), then gates on an
   email OTP before handing off to the agent.
2. **The agent loop** (`runAgent` in `waConversationService.ts`): once
   registered and verified, every message goes through a Groq chat-completion
   call with a system prompt describing the student and a set of tool
   definitions (`services/waTools.ts`) — search material, get/update
   timetable, manage assignments, CGPA math, enroll/record grades, HOC
   scheduling, subscriptions. The model decides which tools to call, the
   backend executes them against MongoDB, and the loop continues (up to 5
   tool round-trips) until it has a final reply. Documents are sent as real
   WhatsApp attachments the moment a tool resolves them — never left to the
   model to type out a link.
3. **Resilience**: `GROQ_API_KEY` accepts a comma-separated list of keys,
   each with its own rate-limit budget, with automatic 429 retry and
   failover across keys (`services/groqAgentService.ts`). Per-phone-number
   messages are serialized through an in-memory queue so two messages
   arriving close together can't race on the same conversation's session
   state.
4. **Background schedulers** (started in `server.ts`): a class-starting-soon
   sweep (`classReminderService.ts`, every minute, fires 10 minutes before a
   class starts), an assignment-due-date reminder sweep
   (`reminderService.ts`), and an announcement delivery sweep
   (`announcementDeliveryService.ts`, every 2 minutes) that pushes lecture
   alerts/announcements straight to WhatsApp for every student in the
   announcement's (university, department, level) scope.

## Admin dashboard

Pages: **Overview** (library stats), **Upload** (staff-side document upload),
**Documents** (approve/reject the ambassador upload review queue),
**Courses** (catalogue CRUD), **Students** (edit profile fields, points,
badges, ambassador/HOC flags), **Leaderboard** (points ranking),
**Rewards** (redemption fulfillment queue), **Announcements** (moderation),
and **Admins** (super_admin only — manage other admin accounts).

## Getting started

Both packages run independently. In separate terminals:

```bash
# API
cd quant-backend
npm install
cp .env.example .env   # MONGO_URI, BOT_SERVICE_API_KEY, and (for the bot) META_WA_*/GROQ_API_KEY
npm run dev             # http://localhost:4000

# Admin dashboard
cd admin
npm install
cp .env.example .env   # VITE_API_URL
npm run dev             # proxies /api -> http://localhost:4000
```

The backend seeds a default super admin on startup (see
[`admin/README.md`](admin/README.md) for credentials) — use it to log into the
dashboard. API docs are served at `/api-docs` (Swagger UI) once the backend is
running; the WhatsApp bot itself only comes alive once the `META_WA_*` env
vars point at a real Meta WhatsApp Cloud API app — without them the backend
still runs, it just can't send/receive WhatsApp messages.

## License

MIT — see [LICENSE](LICENSE).
