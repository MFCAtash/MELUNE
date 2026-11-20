# Same build as api.Dockerfile through the build stage; different entrypoint
# (BullMQ consumer) and a runtime image that additionally has ffmpeg.
# Build context is the repo root. Requires a committed package-lock.json.
# Requires a committed package-lock.json — see docs/lockfile.md.

# --- Dependencies -------------------------------------------------------
# All workspace manifests are copied so npm can validate the lockfile
# (npm ci fails if a workspace listed in the root package.json is missing).
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config packages/config
RUN npm ci --workspace=apps/api --include-workspace-root

# --- Build --------------------------------------------------------------
FROM deps AS build
COPY apps/api apps/api
RUN npm run prisma:generate --workspace=apps/api \
 && npm run build --workspace=apps/api

# --- Runtime ------------------------------------------------------------
FROM node:20-alpine AS runtime
# The only container in the stack that needs ffmpeg — see
# apps/api/src/queue/workers/audio-transcode.worker.ts.
RUN apk add --no-cache ffmpeg
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json

# Same reasoning as api.Dockerfile: drop root before running.
RUN chown -R node:node /repo
USER node

WORKDIR /repo/apps/api

# This worker is a BullMQ consumer with no HTTP server to probe (unlike
# api.Dockerfile), so "healthy" here just means the Node process that
# `CMD` starts is still running — a liveness check, not a readiness one.
# `pgrep` is provided by busybox, already in node:20-alpine; no extra
# package installed just for this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD pgrep -f "dist/queue/workers/audio-transcode.worker.js" || exit 1

CMD ["node", "dist/queue/workers/audio-transcode.worker.js"]
