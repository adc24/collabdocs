# Container build for CollabDocs (frontend + backend in one image).
# Not built in the authoring sandbox: Docker was unavailable there.
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Standalone output is enabled only for this image.
ENV NEXT_OUTPUT=standalone
# Build-time placeholder only. No database queries occur during the build.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 collabdocs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=collabdocs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=collabdocs:nodejs /app/.next/static ./.next/static
# Schema bootstrap, run before the server starts.
COPY --from=builder /app/scripts ./scripts
# Public assessment source export: no .env, database data, or dependencies.
COPY --from=builder /app/src ./src
COPY --from=builder /app/tests ./tests
COPY --from=builder /app/examples ./examples
COPY --from=builder /app/README.md /app/ARCHITECTURE.md /app/AI_WORKFLOW.md /app/SUBMISSION.md /app/DEPLOYMENT.md /app/WALKTHROUGH_SCRIPT.md /app/WALKTHROUGH_VIDEO_URL.txt ./
COPY --from=builder /app/package.json /app/package-lock.json /app/tsconfig.json /app/next.config.ts /app/drizzle.config.ts /app/playwright.config.ts /app/postcss.config.mjs /app/eslint.config.mjs /app/compose.yaml /app/render.yaml /app/Dockerfile /app/.dockerignore /app/.gitignore /app/.env.example /app/.node-version ./
USER collabdocs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
