FROM node:22 AS base

EXPOSE 3000

WORKDIR /app

COPY package.json package-lock.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

COPY . .

ENV NODE_ENV=production

# Accept SENTRY_AUTH_TOKEN as build argument for source map upload
# Using ARG only (not ENV) ensures the token is not baked into the final image
ARG SENTRY_AUTH_TOKEN

# Pass ARG as environment variable only for the build step (not persisted in image)
RUN SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN npm run build

CMD ["npm", "run", "start"]
