FROM node:22 AS base

EXPOSE 3000

WORKDIR /app

COPY package.json package-lock.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

COPY . .

ENV NODE_ENV=production

RUN npm run build

CMD ["npm", "run", "start"]
