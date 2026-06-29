# Deployment Guide

Production deployment for the Ascot Remortgage Reminder app.

## Stack at a glance

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 18 + Vite SPA | Static build (`dist/`), env baked at **build time** |
| Backend | Node 20, native `http` (no framework) | `server/index.mjs`, no build step |
| Scheduler | `node-cron`, in-process | Fires the 08:30 run — needs an always-on, single instance |
| Integrations | Asana, Insightly, Gmail (OAuth) | Server-side only |
| Database | **None wired yet** | Queue + audit are in-memory; Supabase is a future phase |
| Auth | **None** | API is unauthenticated unless `API_TOKEN` is set |
| Package manager | npm | `package-lock.json` committed |

This is **one repo, two deployables**: a static frontend and a long-running API.

## Recommended target (simplest reliable)

- **Single container → Google Cloud Run** — one image serves the SPA + API on
  one URL. Config: `Dockerfile`, guide: **[CLOUDRUN.md](CLOUDRUN.md)**.
- **Local / any Docker host:** `docker compose up --build` → http://localhost:8080
  (the same single image).
- **Split alternative (legacy):** Vercel for the SPA (`vercel.json`) + Render for
  the API (`render.yaml`). Workable, but it's the split that caused the root-404
  routing confusion — the single container avoids it.

> ⚠️ The scheduler is in-process. Do **not** use a scale-to-zero / free
> sleeping plan or multiple replicas — the cron would miss runs or double-fire.
> Use one always-on instance, **or** replace it with a platform cron that POSTs
> `/api/run/now` and remove `startScheduler()` from `server/index.mjs`.

---

## Environment variables

### Frontend (build-time, `VITE_` prefix — baked into the bundle)
| Var | Prod value | Purpose |
|-----|-----------|---------|
| `VITE_USE_MOCK` | `false` | Use the live backend, not mock data |
| `VITE_API_BASE_URL` | `https://<api-host>` | API URL **as the browser reaches it** |
| `VITE_SUPABASE_URL` | _(blank)_ | Future Supabase phase |
| `VITE_SUPABASE_ANON_KEY` | _(blank)_ | Future Supabase phase |

### Backend (runtime — set as platform secrets, never commit)
| Var | Example | Purpose |
|-----|---------|---------|
| `PORT` | injected by host | Listen port |
| `CORS_ALLOWED_ORIGINS` | `https://<frontend-host>` | CORS allowlist (`*` = any) |
| `API_TOKEN` | _(optional)_ | Bearer token for `/api/send`, `/api/run/now` |
| `SEND_MODE` | `dry` → `live` | `dry` resolves+logs only; `live` actually sends |
| `TEST_RECIPIENTS_ONLY` | `true` | Only the 4 allowlisted test contacts may be emailed |
| `SEND_REDIRECT_TO` | _(optional)_ | Route all mail to one test inbox |
| `ASANA_ACCESS_TOKEN` | secret | Task pull + comments |
| `ASANA_PROJECT_ID` / `ASANA_WORKSPACE_ID` | id | Project scope |
| `INSIGHTLY_API_KEY` / `INSIGHTLY_API_URL` | secret / url | Contact email lookup |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | secret | Send mail |
| `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` / `MAIL_REPLY_TO` / `MAIL_BCC` | addresses | Headers |
| `RUN_CRON` / `RUN_TIMEZONE` / `RUN_WEEKENDS` | `30 8 * * *` / `Europe/London` / `yes` | Schedule |

Full template: `server/.env.example`. Frontend template: `.env.example`.

---

## Deploy steps

### Backend (Render)
1. Push this repo to GitHub.
2. Render → **New → Blueprint**, point at the repo (`render.yaml` is detected).
3. Fill every `sync: false` secret in the dashboard from `server/.env.example`.
4. Set `CORS_ALLOWED_ORIGINS` to the frontend URL (after step below, or update later).
5. Deploy. Confirm `GET /api/health` returns `{ ok: true }`.

### Frontend (Vercel)
1. Vercel → **Import** the same repo. Framework auto-detects Vite (`vercel.json`).
2. Set build env: `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=https://<render-api-host>`.
3. Deploy. Open the site; the Review Queue should load from the live API.
4. Back in Render, set `CORS_ALLOWED_ORIGINS` to the Vercel URL; redeploy API.

### Commands
| | Command |
|--|--|
| Install | `npm ci` |
| Frontend build | `npm run build` → `dist/` |
| Frontend preview | `npm run preview` |
| Backend start | `node server/index.mjs` (or `npm run server` locally) |
| Docker (single container) | `docker compose up --build` → :8080 |

---

## Production readiness checklist

- [ ] Secrets set as platform env vars; nothing real in committed files
- [ ] **Rotate** any credential ever present in a tracked file (Asana token from the Zap export)
- [ ] `CORS_ALLOWED_ORIGINS` = exact frontend origin (not `*`)
- [ ] `VITE_USE_MOCK=false` and `VITE_API_BASE_URL` set for the frontend build
- [ ] `SEND_MODE` and `TEST_RECIPIENTS_ONLY` set deliberately (start: `dry` + `true`)
- [ ] Backend on an always-on, single instance (scheduler requirement)
- [ ] `/api/health` green; uptime check configured
- [ ] Gmail OAuth refresh token valid (they can expire if unused/revoked)
- [ ] Logs visible in the platform dashboard
- [ ] DB: N/A until the Supabase phase (queue/audit currently reset on restart)

## Security review summary
- API is **unauthenticated** and CORS-exposed by design (browser-called). Mitigations:
  keep `SEND_MODE`/`TEST_RECIPIENTS_ONLY` guards on, restrict `CORS_ALLOWED_ORIGINS`,
  and set `API_TOKEN` only if the API is fronted by a server (not the SPA).
- No SQL/DB → no injection surface yet. No file uploads. No payments/webhooks.
- Service-role / OAuth secrets are server-only and gitignored.

## Post-deployment smoke tests
1. `curl https://<api>/api/health` → `{ "ok": true, "mode": "live", "sendMode": "dry" }`
2. `curl https://<api>/api/run` → JSON run with `candidates` (Asana reachable).
3. Open the frontend → Review Queue populates from the live API (no CORS error in console).
4. Open a candidate → Confirm & Send in **dry mode** → audit shows "DRY-RUN".
5. (When going live) set `SEND_MODE=live`, keep `TEST_RECIPIENTS_ONLY=true`, send to a
   test contact, confirm receipt, then decide on real-client rollout.

## Rollback plan
- **Vercel / Render:** dashboard → Deployments → promote the previous successful build (instant).
- **Docker host:** `docker compose down` then redeploy the previous image tag.
- **Fast kill-switch (stop all sends without redeploy):** set `SEND_MODE=dry`
  (and/or `TEST_RECIPIENTS_ONLY=true`) in the platform env and restart the API.
- **Code:** `git revert <sha>` and redeploy; history is linear on `main`.

## Backup strategy
- No app database yet, so nothing to back up server-side. Source of truth stays in
  Asana + Insightly (their own backups). When the Supabase phase lands, enable
  Supabase point-in-time recovery and export the audit table on a schedule.
