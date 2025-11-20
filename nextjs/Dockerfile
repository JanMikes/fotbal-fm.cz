FROM node:22 AS base

EXPOSE 3000

WORKDIR /app

# Install dependencies (including devDependencies needed for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Set production env for runtime
ENV NODE_ENV=production

CMD ["npm", "run", "start"]
