FROM node:20-slim

WORKDIR /app

ARG GITHUB_PACKAGES_TOKEN
ENV GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN}

# Copy base tsconfig for extended config
COPY tsconfig.base.json ./tsconfig.base.json

# Copy db package files
WORKDIR /app/db
COPY db/package.json ./package.json
COPY db/tsconfig.json ./tsconfig.json
COPY db/prisma ./prisma
COPY db/src ./src

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
    (pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)

RUN pnpm run build
