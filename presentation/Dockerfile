FROM node:22 AS base

WORKDIR /app

# Copy workspace root and shared packages
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY presentation/ ./presentation/

# Create stubs for other workspace members
RUN mkdir -p nextjs && echo '{"name":"@fotbal-fm/nextjs","version":"0.1.0","private":true}' > nextjs/package.json
RUN mkdir -p api && echo '{"name":"@fotbal-fm/api","version":"0.1.0","private":true}' > api/package.json

RUN npm ci

WORKDIR /app/presentation

ENV NODE_ENV=production

RUN npx next build

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
