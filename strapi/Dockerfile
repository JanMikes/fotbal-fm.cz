FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY ./package.json ./package-lock.json ./

RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

RUN npm run build

EXPOSE 1337

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:1337/_health').then(r => process.exit(r.status === 204 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
