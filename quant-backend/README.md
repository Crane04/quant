# Quant Backend API

Backend for **Quant** — a WhatsApp academic assistant (lecture summaries,
assignment reminders, PDFs, timetable access, CGPA tracking). This repo is
the REST API **and** the WhatsApp bot itself: the webhook receiver, the
WhatsApp Flow endpoint, and the Groq-powered tool-calling agent all live here
(`controllers/webhookController.ts`, `controllers/flowController.ts`,
`services/wa*.ts`). The `admin/` dashboard (a separate package in this repo)
is the only other client.

Stack: TypeScript, Express, MongoDB (Mongoose), Zod, Groq (WhatsApp agent).

## Getting started

```bash
npm install
cp .env.example .env   # fill in MONGO_URI, BOT_SERVICE_API_KEY, etc.
npm run dev
```

Health check: `GET /health`. All routes are mounted under `/api/v1`.

## How auth works

Two different callers hit this API, so there are two auth paths:

1. **A student's own client** (e.g. a future web dashboard) — email+password
   login issuing an opaque, DB-backed session token (`src/models/Session.ts`,
   `src/utils/session.ts`) — not a JWT, so it's instantly revocable by deleting
   the session row instead of waiting out an expiry or tracking a token version:
   - `POST /auth/register` → creates the student (with a password) and sends an
     email OTP for email verification
   - `POST /auth/verify-phone`, `POST /auth/verify-email` — account verification only
   - `POST /auth/student-login` → email + password, returns `token` (ambassadors only)
   - `POST /auth/logout` → revokes all of the student's sessions
   - Authenticated requests: `Authorization: Bearer <token>`
   - Session lifetime: `STUDENT_SESSION_EXPIRES_IN` (default 30d)

2. **The WhatsApp bot process** — it already knows who it's talking to (the
   sender's WhatsApp number), so it doesn't need a session token. It
   authenticates with a shared secret instead:
   - Header: `x-api-key: <BOT_SERVICE_API_KEY>`
   - Pass the student's `phone` in the query string or body on any `/mine`-style
     route, and the API resolves it to a student for you.

Both paths are handled by the same `resolveStudentContext` middleware
(`src/middleware/resolveStudentContext.ts`), so "my timetable" / "my
assignments" / "my CGPA" endpoints work identically for either caller.

Catalogue-mutating routes (creating courses, timetable slots, assignments,
lecture summaries, documents) are gated behind `requireBotApiKey` for now —
treat that as a generic "trusted service" key until you build a real admin
role. See the `TODO` comments in `src/routes/courseRoutes.ts` etc.

## Data model

| Model                         | Purpose                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `Student`                     | phone (WhatsApp identity), email+password, matric number, verification flags                |
| `Admin`                       | email+password dashboard admin, role (`super_admin`/`admin`)                                |
| `Session`                     | opaque session token (hashed) for a Student or Admin; TTL-indexed, auto-expires             |
| `OtpVerification`             | short-lived OTP codes (TTL-indexed, auto-expires)                                           |
| `Course`                      | catalogue entry: code, title, university, department, level, session, semester              |
| `StudentCourse`               | enrollment — links a student to courses for a session/semester                              |
| `TimetableSlot`               | a course's weekly recurring slot (day, time, venue)                                         |
| `Assignment`                  | belongs to a course; has a due date                                                         |
| `StudentAssignmentStatus`     | per-student completion tracking for an assignment                                           |
| `LectureSummary`              | text summary tied to a course                                                               |
| `DocumentFile`                | metadata + URL for a PDF/other file tied to a course; category + review status drive points |
| `GradeRecord`                 | one course grade for a student in a session/semester; feeds CGPA                            |
| `PointsTransaction`           | ledger entry (earn/spend) behind a student's points balance                                 |
| `Badge` / `StudentBadge`      | the fixed 12-badge catalog, and which ones a student has earned                             |
| `Reward` / `RewardRedemption` | the fixed rewards catalog, and each student's redemption history                            |
| `Announcement`                | a lecture alert or general announcement posted by an ambassador (HOC Hub)                   |

## Gamification (points, badges, rewards, leaderboard, HOC Hub)

Points only exist for ambassadors, and only come from **approved** document
uploads:

1. A student uploads via `POST /documents/mine` with a `category`
   (`lecture_note` / `exam_summary` / `past_question` / `other`) — it lands as
   `status: "pending"` and earns nothing yet.
2. An admin reviews it via `PATCH /documents/:id/review`. Approving calls
   `pointsService.awardPointsForApprovedDocument` (category-rate points +
   upload-streak bump) and `badgeService.evaluateBadgesForStudent` (checks all
   12 badge criteria, awards any newly met + their bonus points). Rejecting
   just records a reason — no points.
3. Points feed the leaderboard (`GET /leaderboard`, ambassadors only) and can
   be spent via `POST /rewards/:id/redeem` — deducted only on success, never
   on a validation failure (insufficient points / missing size).
4. `tokens` is a _separate_ balance from `points` — some rewards convert
   points into tokens, but tokens aren't currently spendable anywhere else in
   this API.

The badge catalog and reward catalog are fixed, seeded on startup
(`ensureDefaultBadges`/`ensureDefaultRewards` in `src/server.ts`), and
upserted by a stable `key` — editing `DEFAULT_BADGES`/`DEFAULT_REWARDS` and
redeploying is how you change them, there's no admin CRUD UI for either yet.

The HOC (ambassador) Hub is a student-authored broadcast, gated by
`requireAmbassador`: `POST /announcements` creates a `lecture_alert` (tied to
a course/timetable slot) or a general `announcement`, scoped to the
ambassador's own (university, department, level). Every student in that
scope sees it via `GET /announcements/mine`, and a background sweep
(`announcementDeliveryService.ts`, every 2 minutes) pushes it straight to
every matching student over WhatsApp and marks it sent — no polling, since
the bot is in-process now, not a separate consumer.

## Key endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/verify-phone
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/student-login
POST   /api/v1/auth/logout

GET    /api/v1/students/me
PATCH  /api/v1/students/me

GET    /api/v1/courses
GET    /api/v1/courses/mine
POST   /api/v1/courses/enroll
POST   /api/v1/courses            (trusted service)

GET    /api/v1/timetable/mine?session=&semester=
GET    /api/v1/timetable/course/:courseId
POST   /api/v1/timetable          (trusted service)

GET    /api/v1/assignments/mine?session=&semester=&status=pending|completed|all
GET    /api/v1/assignments/upcoming-reminders?hours=24   (trusted service — bot polls this)
POST   /api/v1/assignments/:id/status   { completed: true }
POST   /api/v1/assignments        (trusted service)

GET    /api/v1/lecture-summaries/mine?session=&semester=
GET    /api/v1/lecture-summaries/course/:courseId
POST   /api/v1/lecture-summaries  (trusted service)

GET    /api/v1/documents/mine?session=&semester=
POST   /api/v1/documents/mine     (ambassadors only — category required)
GET    /api/v1/documents/course/:courseId
GET    /api/v1/documents?status=pending&...   (admin — review queue)
PATCH  /api/v1/documents/:id/review   { status: approved|rejected }   (admin)
POST   /api/v1/documents          (admin — auto-approved, no review)

GET    /api/v1/grades/mine
GET    /api/v1/grades/mine/cgpa
POST   /api/v1/grades

GET    /api/v1/points/mine
GET    /api/v1/points/mine/history?limit=

GET    /api/v1/leaderboard?limit=

GET    /api/v1/badges/mine

GET    /api/v1/rewards
POST   /api/v1/rewards/:id/redeem   { size? }
GET    /api/v1/rewards/mine/history
GET    /api/v1/rewards/redemptions   (admin)

POST   /api/v1/announcements   (ambassadors only — lecture_alert or announcement)
GET    /api/v1/announcements/mine?type=
GET    /api/v1/announcements/unsent   (trusted service — bot polls this)
POST   /api/v1/announcements/:id/mark-sent   (trusted service)
```

## Things left for you to wire up

- **WhatsApp OTP delivery**: `src/services/waService.ts` sends via the Meta
  Cloud API using a free-form text message. Outside Meta's 24h session
  window you'll need an approved template message instead — swap it in there.
- **File uploads**: `DocumentFile` stores a `fileUrl`, it doesn't handle byte
  upload. Point `fileUrl` at wherever you're hosting PDFs (S3, etc.) — the
  `.env.example` has placeholders for S3 config if you want to add a
  presigned-URL upload endpoint later.
- **Reminders**: now sent on a schedule from inside this process
  (`reminderService.ts`, `classReminderService.ts`,
  `announcementDeliveryService.ts` — all `setInterval` sweeps started in
  `server.ts`), not polled by an external bot. `GET
  /assignments/upcoming-reminders` still exists but nothing in this repo
  calls it anymore — remove it or repurpose it if you don't need it.
- **Admin/trusted-service auth**: right now `requireBotApiKey` is one shared
  secret for both "the bot" and "whoever manages the course catalogue."
  Split these into separate keys/roles once you have an admin tool.
