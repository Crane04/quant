# quant-admin

Admin panel for Quant App — upload and manage PDFs served to students via WhatsApp.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- TanStack Query
- React Dropzone
- Lucide icons

## Setup

```bash
cp .env.example .env   # fill in values
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Bot API base URL e.g. `http://localhost:3000/api/v1` |

The Vite dev server proxies `/api` → `http://localhost:3000` so during development you can set `VITE_API_URL=/api/v1`.

## Login

The backend seeds a default super admin on startup:

```txt
email: admin@gmail.com
password: xyz123
```

Super admins can manage other admins from the **Admins** page.

## Features

- **Overview** — total PDFs, downloads, courses covered, recent uploads, top downloaded
- **Upload PDF** — drag-and-drop with metadata form (title, course code, department, level, semester, tags)
- **Documents** — searchable/filterable table with delete and open-in-Cloudinary actions
- **Admins** — create, deactivate, update, reset password, and delete admins as a super admin

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview production build
```

Deploy `dist/` to Vercel, Netlify, or any static host.
