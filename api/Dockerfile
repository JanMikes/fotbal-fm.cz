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
