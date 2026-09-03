# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps

WORKDIR /app

# Copy the root manifests + EVERY workspace package.json (npm ci needs the whole
# workspace tree to match package-lock.json)
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY backoffice/package.json ./backoffice/
COPY web/package.json ./web/
COPY packages/cache/package.json ./packages/cache/
COPY packages/form/package.json ./packages/form/
COPY packages/strapi-client/package.json ./packages/strapi-client/

# Install strictly from the lockfile so every build is reproducible. The lockfile
# records the native bindings for every platform (incl. Alpine/musl x64+arm64).
RUN --mount=type=cache,target=/root/.npm npm ci

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
