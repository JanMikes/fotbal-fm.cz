# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for dependency installation
COPY package.json package-lock.json ./
COPY packages/strapi-client/package.json ./packages/strapi-client/
COPY backoffice/package.json ./backoffice/

# Create stubs for other workspace members
RUN mkdir -p web && echo '{"name":"@fotbal-fm/web","version":"0.1.0","private":true}' > web/package.json \
 && mkdir -p api && echo '{"name":"@fotbal-fm/api","version":"0.1.0","private":true}' > api/package.json \
 && mkdir -p packages/form && echo '{"name":"@fotbal-fm/form","version":"0.1.0","private":true}' > packages/form/package.json \
 && mkdir -p packages/cache && echo '{"name":"@fotbal-fm/cache","version":"0.1.0","private":true}' > packages/cache/package.json

# Remove lockfile to avoid npm optional dependency bug (https://github.com/npm/cli/issues/4828)
# where platform-specific bindings are skipped when lockfile was generated on a different OS
RUN --mount=type=cache,target=/root/.npm rm package-lock.json && npm install

# ---

FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app ./

# Copy source code (overwrites package.json-only copies)
COPY packages/ ./packages/
COPY backoffice/ ./backoffice/

WORKDIR /app/backoffice

ENV NODE_ENV=production

ARG APP_VERSION
ENV SENTRY_RELEASE="${APP_VERSION}"

# SENTRY_AUTH_TOKEN arrives as a BuildKit SECRET mount (exposed to this RUN only,
# never baked into a layer or the image history). CI passes it through the shared
# TheDevs-cz/ci workflow's BUILD_SECRETS input.
RUN --mount=type=cache,target=/app/backoffice/.next/cache \
    --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    npx next build --webpack

# ---

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/backoffice/.next/standalone ./
COPY --from=builder /app/backoffice/.next/static ./backoffice/.next/static
COPY --from=builder /app/backoffice/public ./backoffice/public

EXPOSE 3000

CMD ["node", "backoffice/server.js"]
