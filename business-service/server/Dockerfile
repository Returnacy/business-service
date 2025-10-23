###############################################
# Build stage
###############################################
FROM node:20-bullseye-slim AS build
WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY tsconfig.base.json ./tsconfig.base.json
COPY package.json ./package.json

# Copy packages manifests
COPY db/package.json ./db/package.json
COPY server/package.json ./server/package.json

# Copy sources
COPY db ./db
COPY server ./server

ARG GITHUB_PACKAGES_TOKEN
ENV CI=true \
    GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN}

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
	(pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)

RUN pnpm --filter @business-service/db exec prisma generate || true
RUN pnpm --filter @business-service/db build && \
    pnpm --filter @business-service/server build

RUN pnpm --filter @business-service/db install --prod --no-optional --frozen-lockfile && \
    pnpm --filter @business-service/server install --prod --no-optional --frozen-lockfile

###############################################
# Runtime stage
###############################################
FROM node:20-bullseye-slim
ENV NODE_ENV=production NODE_PATH=/app/db/node_modules
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/dist ./db/dist
COPY --from=build /app/db/node_modules ./db/node_modules

USER node
CMD ["node", "server/dist/src/app.js"]
