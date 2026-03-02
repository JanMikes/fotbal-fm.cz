FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for npm ci caching
COPY package.json package-lock.json ./
COPY packages/strapi-client/package.json ./packages/strapi-client/
COPY api/package.json ./api/

# Create stubs for other workspace members
RUN mkdir -p nextjs && echo '{"name":"@fotbal-fm/nextjs","version":"0.1.0","private":true}' > nextjs/package.json \
 && mkdir -p presentation && echo '{"name":"@fotbal-fm/presentation","version":"0.1.0","private":true}' > presentation/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

# ---

FROM node:22-alpine

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app ./

# Copy source code (overwrites package.json-only copies)
COPY packages/ ./packages/
COPY api/ ./api/

WORKDIR /app/api

EXPOSE 4000
ENV PORT=4000

CMD ["npx", "tsx", "src/index.ts"]
