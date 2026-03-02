FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for npm ci caching
COPY package.json package-lock.json ./
COPY packages/strapi-client/package.json ./packages/strapi-client/
COPY presentation/package.json ./presentation/

# Create stubs for other workspace members
RUN mkdir -p nextjs && echo '{"name":"@fotbal-fm/nextjs","version":"0.1.0","private":true}' > nextjs/package.json \
 && mkdir -p api && echo '{"name":"@fotbal-fm/api","version":"0.1.0","private":true}' > api/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

# ---

FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app ./

# Copy source code (overwrites package.json-only copies)
COPY packages/ ./packages/
COPY presentation/ ./presentation/

WORKDIR /app/presentation

ENV NODE_ENV=production

RUN --mount=type=cache,target=/app/presentation/.next/cache \
    npx next build

# ---

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/presentation/.next/standalone ./
COPY --from=builder /app/presentation/.next/static ./presentation/.next/static
COPY --from=builder /app/presentation/public ./presentation/public

EXPOSE 3000

CMD ["node", "presentation/server.js"]
