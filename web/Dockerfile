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
COPY web/ ./web/

WORKDIR /app/web

ENV NODE_ENV=production

ARG PUBLIC_UPLOADS_URL=http://localhost:8080
ENV PUBLIC_UPLOADS_URL=${PUBLIC_UPLOADS_URL}

RUN --mount=type=cache,target=/app/web/.next/cache \
    npx next build

# ---

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public

EXPOSE 3000

CMD ["node", "web/server.js"]
