# Deploy to Google Cloud Run (single container)

One image serves **both** the web app and the API on `$PORT`, so there's one
URL and no CORS/split-host problem. `mortgagereminders.ascotwm.com` points at
this one Cloud Run service.

## 1. Build & deploy

From the repo root (the `Dockerfile` is the combined image):

```bash
gcloud run deploy mortgage-reminders \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --memory 512Mi
```

The Dockerfile defaults bake the SPA in **live, same-origin** mode
(`VITE_USE_MOCK=false`, `VITE_API_BASE_URL=` → calls `/api/*` on its own host),
so no build args are needed. After deploy, map your domain:

```bash
gcloud run domain-mappings create \
  --service mortgage-reminders --domain mortgagereminders.ascotwm.com --region europe-west2
```
…then add the CNAME/A records it prints to your DNS.

## 2. Secrets & config (runtime env)

Put secrets in **Secret Manager**, not plain env. Example:

```bash
printf '%s' "$ASANA_TOKEN" | gcloud secrets create ASANA_ACCESS_TOKEN --data-file=-
# …repeat for INSIGHTLY_API_KEY, GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN

gcloud run services update mortgage-reminders --region europe-west2 \
  --set-secrets ASANA_ACCESS_TOKEN=ASANA_ACCESS_TOKEN:latest,\
INSIGHTLY_API_KEY=INSIGHTLY_API_KEY:latest,\
GMAIL_CLIENT_ID=GMAIL_CLIENT_ID:latest,\
GMAIL_CLIENT_SECRET=GMAIL_CLIENT_SECRET:latest,\
GMAIL_REFRESH_TOKEN=GMAIL_REFRESH_TOKEN:latest \
  --set-env-vars ASANA_PROJECT_ID=344726377347711,ASANA_WORKSPACE_ID=666438144056,\
INSIGHTLY_API_URL=https://api.na1.insightly.com/v3.1,\
MAIL_FROM_NAME=mortgages@ascotwm.com,MAIL_FROM_ADDRESS=requests@ascotwm.com,\
MAIL_REPLY_TO=mortgages@ascotwm.com,MAIL_BCC=jody.moses@ascotwm.com,\
SEND_MODE=dry,TEST_RECIPIENTS_ONLY=true,AUTO_SEND=clean,\
APP_URL=https://mortgagereminders.ascotwm.com,\
API_TOKEN=<long-random-string>
```

Keep `SEND_MODE=dry` and `TEST_RECIPIENTS_ONLY=true` until you've verified a live
send. Set `NOTIFY_EMAIL=...` to turn on the held-reminder alert.

## 3. The daily 09:00 run — use Cloud Scheduler (important)

Cloud Run **scales to zero**, so the in-process `node-cron` scheduler will NOT
reliably fire at 09:00 (no instance is running). Two options:

**Recommended — Cloud Scheduler hits the endpoint:**

```bash
gcloud scheduler jobs create http mortgage-daily-run \
  --location europe-west2 \
  --schedule "0 9 * * *" \
  --time-zone "Europe/London" \
  --uri "https://mortgagereminders.ascotwm.com/api/run/now" \
  --http-method POST \
  --headers "Authorization=Bearer <same API_TOKEN as above>"
```

This calls the same `runAndDispatch` the cron would — auto-sends clean
reminders, holds the rest, and (if `NOTIFY_EMAIL` is set) emails the summary.
The `API_TOKEN` guard means only Scheduler can trigger it.

**Alternative — keep the in-process cron:** set `--min-instances 1` so an
instance is always warm. Costs more, and you can drop the Scheduler job.

## 4. Verify

```bash
curl https://mortgagereminders.ascotwm.com/api/health      # {"ok":true,...}
open  https://mortgagereminders.ascotwm.com/                # the app loads
```

If `/api/health` works but `/` 404s, the image isn't serving `dist` — rebuild
(the `Dockerfile` build stage must succeed; check Cloud Build logs).
