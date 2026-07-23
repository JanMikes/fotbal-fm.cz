FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for dependency installation
COPY package.json package-lock.json ./
COPY packages/strapi-client/package.json ./packages/strapi-client/
COPY packages/form/package.json ./packages/form/
COPY packages/cache/package.json ./packages/cache/
COPY api/package.json ./api/

# Create stubs for other workspace members
RUN mkdir -p backoffice && echo '{"name":"@fotbal-fm/backoffice","version":"0.1.0","private":true}' > backoffice/package.json \
 && mkdir -p web && echo '{"name":"@fotbal-fm/web","version":"0.1.0","private":true}' > web/package.json

# Remove lockfile to avoid npm optional dependency bug (https://github.com/npm/cli/issues/4828)
# where platform-specific bindings are skipped when lockfile was generated on a different OS
RUN --mount=type=cache,target=/root/.npm rm package-lock.json && npm install

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
