# ---- Base Node ----
FROM node:20-alpine AS base
WORKDIR /usr/src/app
# Install OS-level dependencies for Prisma (e.g., openssl for some DB connectors)
RUN apk add --no-cache openssl libgcc libstdc++

# ---- Dependencies ----
FROM base AS dependencies
# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# Copy prisma schema early, so 'prisma generate' can work after npm install
COPY prisma ./prisma/
# Install all dependencies (including devDependencies for build and prisma generate)
RUN npm install

# PRISMA
# Generate Prisma Client
RUN npx prisma generate

# ---- Development ----
FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 4000

# Command to run your application
CMD ["npm", "run", "start:dev"]