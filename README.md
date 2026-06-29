# Ascot · Remortgage Reminder

A human-in-the-loop replacement for the *Daily Remortgage Task Reminder* Zap.
The matching, broker mapping and templating logic is ported 1:1 from the Zap,
but **nothing sends until a reviewer approves it** — closing the silent gaps
(missing emails, stop-flags, branch mismatches) that the Zap skipped without telling anyone.

This is the **frontend-first** pass: a React + Vite SPA running on realistic mock
Asana/Insightly payloads, with all backend behind one swappable data layer.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

## Deploy to production

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full guide — recommended targets
(Vercel for the SPA, Render for the API), exact env vars, readiness checklist,
smoke tests, and rollback. Config files: `vercel.json`, `render.yaml`,
`.github/workflows/ci.yml`.

## Run with Docker (single container)

One image serves the SPA **and** the API on one port — the same image that
deploys to Cloud Run (see **[CLOUDRUN.md](CLOUDRUN.md)**).

```bash
cp server/.env.example server/.env   # then fill in real values
docker compose up --build            # -> http://localhost:8080  (app + /api)
```

Or without compose:

```bash
docker build -t mortgage-reminders .
docker run -p 8080:8080 --env-file server/.env mortgage-reminders
```

- **One origin:** the SPA is baked live + same-origin, so it calls `/api/*` on its
  own host — no CORS, no second container.
- **Secrets** live only in `server/.env`, injected at runtime via `env_file`. The
  `.dockerignore` keeps every `.env` out of the image — only `*.example` is allowed in.
- **Sending stays locked:** `SEND_MODE=dry` and `TEST_RECIPIENTS_ONLY=true` default on
  — see the Safety section below.

## What it does

The daily run scans the Asana mortgage project and matches each task's
`aU_Confirmed_Remortgage_Date` against six offsets relative to today:

| Stage | Fires when confirmed date is… | Template |
|-------|-------------------------------|----------|
| 6 / 3 / 1 Months **Before** | ahead of the deal end | pre-expiry nudges |
| 1 / 3 / 6 Months **After**  | past the deal end (on SVR) | post-expiry nudges |

Matched clients land in the **Review Queue**. Each opens a 3-step review:

1. **Review & Compliance** — client + broker + Insightly email, plus checks for
   the stop-automation flag, a client email on file, and an appointed broker.
2. **Message** — exact email (To/Cc/Bcc/Subject/body) and Asana comment that will
   be sent, editable inline.
3. **Confirm & Send** — recipient summary; send is blocked if there's no email or
   the stop-flag is set (unless explicitly overridden).

Every send/skip is written to the **Audit Log** (replacing the Google Sheet).

## Architecture / the seam

```
src/
  data/
    offsets.js          6 stages (offset → template → colour)
    brokers.js          broker map + fixed mail recipients
    emailTemplates.js   6 email + Asana-comment templates
    reminderEngine.js   PORTED ZAP LOGIC — offset matching, name parse, blockers
    mockTasks.js        mock Asana tasks + Insightly contacts (live-shaped)
    store.jsx           <-- THE ONLY SEAM. swap mock for Supabase + live APIs here
  components/           Sidebar, Stepper, StageBadge, EmailPreview, Topbar
  pages/                Overview, ReviewQueue, ReviewDetail, Audit, Settings
```

`reminderEngine.evaluateTasks(tasks, runDate, contactsById)` is pure and runs
identically on mock or live data. To go live, replace the body of
`store.jsx` (`loadCandidates`, `sendReminder`, `skipReminder`) with:

- **Supabase** for the queue + audit tables
- **Asana API** for the task pull (the Zap's pagination) and comment posting
- **Insightly API** for the contact-email lookup
- **Gmail API** for the send
- a **scheduler** (Supabase cron / edge function) to trigger the 8:30 run

No component imports anything below `store.jsx`, so the UI is untouched by that swap.

## Safety — sending is locked to test contacts

Three independent guards keep this from emailing a real client:

1. **`SEND_MODE=dry`** (default) — the backend resolves recipients and logs the
   plan but sends nothing. Only `SEND_MODE=live` actually sends.
2. **`TEST_RECIPIENTS_ONLY=true`** (default) — even in live mode, the send path
   refuses any recipient whose Insightly id isn't in the allowlist at
   `src/data/testContacts.js`. Set it to `false` to send to real clients.
3. **`SEND_REDIRECT_TO`** — optional; routes every email to one address for testing.

Secrets live only in `server/.env` (gitignored); `server/.env.example` is a
placeholder template. Rotate any credential that ever lands in a committed file.
