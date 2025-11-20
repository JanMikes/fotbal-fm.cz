FROM node:22 AS base

EXPOSE 3000

WORKDIR /app

# Install dependencies (including devDependencies needed for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Set NODE_ENV to development during build to avoid prerendering issues
ENV NODE_ENV=development
RUN npm run build

# Set production env for runtime
ENV NODE_ENV=production

CMD ["npm", "run", "start"]
