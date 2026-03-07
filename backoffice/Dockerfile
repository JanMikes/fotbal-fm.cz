FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for npm ci caching
COPY package.json package-lock.json ./
COPY packages/strapi-client/package.json ./packages/strapi-client/
COPY backoffice/package.json ./backoffice/

# Create stubs for other workspace members
RUN mkdir -p web && echo '{"name":"@fotbal-fm/web","version":"0.1.0","private":true}' > web/package.json \
 && mkdir -p api && echo '{"name":"@fotbal-fm/api","version":"0.1.0","private":true}' > api/package.json

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

ARG SENTRY_AUTH_TOKEN
ARG APP_VERSION
ENV SENTRY_RELEASE="${APP_VERSION}"

RUN --mount=type=cache,target=/app/backoffice/.next/cache \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN npx next build --webpack

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
