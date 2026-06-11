# quant-bot

WhatsApp PDF delivery bot for Quant App.

## Stack

- Node.js + TypeScript + Express
- MongoDB / Mongoose
- Twilio WhatsApp Business API
- Cloudinary (PDF storage)
- In-memory session store (Redis-ready)

## Setup

```bash
cp .env.example .env   # fill in all values
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_NUMBER` | Your Twilio WhatsApp number e.g. `whatsapp:+14155238886` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `JWT_SECRET` | Secret used to sign admin login tokens |
| `DEFAULT_ADMIN_EMAIL` | Optional default super admin email; defaults to `admin@gmail.com` |
| `DEFAULT_ADMIN_PASSWORD` | Optional default super admin password; defaults to `xyz123` |
| `INTERNAL_API_KEY` | Legacy fallback secret if `JWT_SECRET` is not set |
| `GROQ_API_KEY` | Optional Groq key for AI intent detection |
| `GROQ_MODEL` | Optional Groq chat model; defaults to `llama-3.3-70b-versatile` |
| `GOOGLE_DRIVE_API_KEY` | Optional Google Drive API key for bulk import from a public/shared folder |
| `GOOGLE_DRIVE_ACCESS_TOKEN` | Optional Google Drive OAuth access token for private folder import |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Optional root Drive folder for import; defaults to the Quant materials folder |
| `DRIVE_IMPORT_FACULTY` | Optional faculty value used by Drive imports |
| `DRIVE_IMPORT_DEPARTMENT` | Optional department value used by Drive imports |

## Twilio Webhook

Point your Twilio WhatsApp sandbox or number's incoming message webhook to:

```
POST https://your-domain.com/webhook/whatsapp
```

## Admin Auth

On startup, the bot creates a default super admin if none exists:

```txt
email: admin@gmail.com
password: xyz123
```

The admin panel logs in through `POST /api/v1/auth/login` and uses a bearer token for protected API calls. Super admins can create, update, deactivate, and delete other admins.

## Internal API (used by admin panel)

Document and admin routes require `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login with email/password |
| `GET` | `/api/v1/auth/me` | Get current logged-in admin |
| `GET` | `/api/v1/documents` | List all (supports `?courseCode=`, `?level=`, `?semester=`, `?search=`) |
| `POST` | `/api/v1/documents` | Upload PDF (multipart/form-data, field `pdf`) |
| `GET` | `/api/v1/documents/:id` | Get single document |
| `PATCH` | `/api/v1/documents/:id` | Update metadata |
| `DELETE` | `/api/v1/documents/:id` | Delete document + Cloudinary file |
| `GET` | `/api/v1/admins` | List admins (super admin only) |
| `POST` | `/api/v1/admins` | Create admin (super admin only) |
| `PATCH` | `/api/v1/admins/:id` | Update admin (super admin only) |
| `DELETE` | `/api/v1/admins/:id` | Delete admin (super admin only) |

## Google Drive Bulk Import

The importer recursively scans the Drive folder, finds PDFs, infers metadata from folder/file names, uploads the PDFs to Cloudinary, and creates MongoDB document records. It skips existing records by Drive file ID or matching title/course/level/semester.

Set either `GOOGLE_DRIVE_API_KEY` for a public/shared folder or `GOOGLE_DRIVE_ACCESS_TOKEN` for a private folder, then run:

```bash
npm run import:drive -- --dry-run
npm run import:drive
```

You can override the folder:

```bash
npm run import:drive -- --folder=1pAr6_0bQHPUTnj1FEDJjeQa-WlB0Wykm
```

## WhatsApp Bot Commands

Students can send:
- `hi` / `hello` / `start` — Welcome + menu
- Natural pleasantries like `good morning` or `thanks` — AI-assisted friendly replies
- `menu` / `back` — Main menu
- `1` or `get pdf` — Browse by course code
- `2` or `search` — Full-text search
- Natural requests like `please send me MEE 305 material` — AI-assisted intent detection
- Any course code directly (e.g. `CVE 301`) — Shortcut lookup
- `help` — Command list

## Session State Machine

```
IDLE
  → [1 / get pdf] → AWAITING_COURSE_CODE
      → [course code] → AWAITING_DOCUMENT_SELECTION
          → [number] → sends PDF → IDLE

  → [2 / search] → AWAITING_SEARCH_QUERY
      → [query] → AWAITING_DOCUMENT_SELECTION
          → [number] → sends PDF → IDLE

  → [any course code] → AWAITING_DOCUMENT_SELECTION
```

Sessions expire after 10 minutes of inactivity.

## Production

For Redis-backed sessions, uncomment the Redis section in `src/services/session.ts` and remove the in-memory implementation.

```bash
npm run build
npm start
```
