# Node backend: pulls Asana, resolves Insightly, sends via Gmail, runs the
# 08:30 scheduler. Imports the shared engine from src/data, so that ships too.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Only runtime deps (date-fns, node-cron) — devDependencies (vite) are skipped.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Server code + the shared engine it imports (src/data). Secrets are NOT copied
# (see .dockerignore); they arrive at runtime via docker-compose env_file.
COPY server ./server
COPY src ./src

EXPOSE 8787

# Liveness via the existing /api/health route (Node 20 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
