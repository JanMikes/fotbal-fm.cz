FROM node:22

WORKDIR /app
EXPOSE 1337

ENV NODE_ENV=production

COPY ./package.json ./package-lock.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "start"]
