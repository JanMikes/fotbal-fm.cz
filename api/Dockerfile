FROM node:22 AS base

WORKDIR /app

# Copy workspace root and shared packages
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY api/ ./api/

# Create stubs for other workspace members
RUN mkdir -p nextjs && echo '{"name":"@fotbal-fm/nextjs","version":"0.1.0","private":true}' > nextjs/package.json
RUN mkdir -p presentation && echo '{"name":"@fotbal-fm/presentation","version":"0.1.0","private":true}' > presentation/package.json

RUN npm ci

WORKDIR /app/api

EXPOSE 4000
ENV PORT=4000

CMD ["npx", "tsx", "src/index.ts"]
