FROM node:22-alpine

WORKDIR /app

EXPOSE 1337

ENV NODE_ENV=production

COPY ./package.json ./package-lock.json ./

RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

CMD ["npm", "run", "start"]
