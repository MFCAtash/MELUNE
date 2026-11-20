# Build context is the repo root (see docker-compose.yml).
# Requires a committed package-lock.json — see docs/lockfile.md.

# --- Dependencies -------------------------------------------------------
# apps/web depends on the @melune/* workspace packages, so they must be
# present (previously they were not copied, so npm tried to download
# non-existent "@melune/types" from the public registry).
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/types packages/types
COPY packages/api-client packages/api-client
COPY packages/config packages/config
RUN npm ci --workspace=apps/web --workspace=packages/types --workspace=packages/api-client --include-workspace-root

# --- Build --------------------------------------------------------------
FROM deps AS build
# Empty default = same-origin (`fetch("/api/...")`), which is what the
# production compose stack wants. Local Docker dev passes an explicit
# http://localhost:4000 build arg in docker-compose.yml.
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Absolute site URL baked into metadata/OpenGraph/sitemap. Pass the public
# production URL at build time (compose does this from .env.production).
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

# --- Runtime ------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages packages
COPY --from=build /repo/apps/web/.next apps/web/.next
COPY --from=build /repo/apps/web/public apps/web/public
COPY --from=build /repo/apps/web/package.json apps/web/package.json
COPY --from=build /repo/apps/web/next.config.js apps/web/next.config.js

# Same reasoning as api.Dockerfile: drop root before running the app.
RUN chown -R node:node /repo
USER node

WORKDIR /repo/apps/web
EXPOSE 3000

# `next start` doesn't ship a dedicated health route; a 200 (or any
# non-5xx/refused) on "/" is enough to say the server is accepting
# connections and rendering, which is what this container being "healthy"
# means here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["npm", "run", "start"]
