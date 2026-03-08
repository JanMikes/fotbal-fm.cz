FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for dependency installation
COPY package.json package-lock.json ./
COPY packages/strapi-client/package.json ./packages/strapi-client/
COPY packages/cache/package.json ./packages/cache/
COPY packages/form/package.json ./packages/form/
COPY web/package.json ./web/

# Create stubs for other workspace members
RUN mkdir -p backoffice && echo '{"name":"@fotbal-fm/backoffice","version":"0.1.0","private":true}' > backoffice/package.json \
 && mkdir -p api && echo '{"name":"@fotbal-fm/api","version":"0.1.0","private":true}' > api/package.json

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
