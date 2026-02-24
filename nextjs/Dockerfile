FROM node:22 AS base

EXPOSE 3000

WORKDIR /app

# Copy workspace root and shared packages
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY nextjs/ ./nextjs/

# Create stubs for other workspace members
RUN mkdir -p presentation && echo '{"name":"@fotbal-fm/presentation","version":"0.1.0","private":true}' > presentation/package.json
RUN mkdir -p api && echo '{"name":"@fotbal-fm/api","version":"0.1.0","private":true}' > api/package.json

# Install dependencies (including devDependencies needed for build)
RUN npm ci

WORKDIR /app/nextjs

ENV NODE_ENV=production

# Accept SENTRY_AUTH_TOKEN as build argument for source map upload
# Using ARG only (not ENV) ensures the token is not baked into the final image
ARG SENTRY_AUTH_TOKEN

# Accept APP_VERSION for Sentry release tracking
# This allows Sentry to correlate errors with specific deployments
ARG APP_VERSION
ENV SENTRY_RELEASE="${APP_VERSION}"

# Pass ARG as environment variable only for the build step (not persisted in image)
# Use Webpack instead of Turbopack for production builds
# Turbopack has known issues with Route Handlers + FormData in Next.js 16
RUN SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN npx next build --webpack

CMD ["npm", "run", "start"]
