# Single-container image for Cloud Run: builds the SPA and serves it together
# with the API from ONE Node process on $PORT. One URL, no CORS, no separate
# frontend host — this is what removes the Vercel/API split-routing problem.
#
#   docker build -t mortgage-reminders .
#   gcloud run deploy --source .        # uses this Dockerfile

# ---- Stage 1: build the SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Same-origin: empty API base => the SPA calls /api/* on its own host.
ARG VITE_USE_MOCK=false
ARG VITE_API_BASE_URL=
ENV VITE_USE_MOCK=$VITE_USE_MOCK
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- Stage 2: runtime (API + the static dist it now serves) ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run injects PORT (default 8080); the server reads process.env.PORT.
ENV PORT=8080

# Runtime deps only (date-fns, node-cron); vite etc. stay in the build stage.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Server + shared engine + the built SPA. Secrets are NOT copied (.dockerignore);
# inject them at deploy time (Cloud Run env vars / Secret Manager).
COPY server ./server
COPY src ./src
COPY --from=build /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
