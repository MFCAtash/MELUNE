# Build context is the repo root (see docker-compose.yml).
# Requires a committed package-lock.json — see docs/lockfile.md.

# --- Dependencies -------------------------------------------------------
# All workspace manifests are copied so npm can validate the lockfile
# (npm ci fails if a workspace listed in the root package.json is missing).
FROM node:26-alpine AS deps
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
# npm workspaces hoist dependencies to /repo/node_modules, so that is what
# must be shipped (copying only apps/api/node_modules leaves no packages).
FROM node:26-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json

# Runs as the "node" user node:20-alpine already creates (uid/gid 1000),
# not root — nothing here needs root once files are copied in, and the
# app listens on 4000 (unprivileged) so a non-root bind is fine.
# --chown on every COPY above defaults to root:root, which "node" can
# still read (world-readable from npm/tsc's own umask), but ownership is
# set explicitly on this final layer's WORKDIR so a future step that
# writes here (temp files, etc.) doesn't need root either.
RUN chown -R node:node /repo
USER node

WORKDIR /repo/apps/api
EXPOSE 4000

# Self-contained (no curl/wget dependency in the image): hits the same
# /api/health Terminus endpoint (health/health.controller.ts) that checks
# Postgres and Redis connectivity, so this fails if either is unreachable,
# not just if the Node process is technically still running.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main"]
