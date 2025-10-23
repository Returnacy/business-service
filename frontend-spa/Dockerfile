FROM node:20-alpine AS build
WORKDIR /app
# Build the da_salva frontend from monorepo path
COPY businesses/da_salva/frontend/package.json businesses/da_salva/frontend/pnpm-lock.yaml* businesses/da_salva/frontend/.npmrc* ./
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# Install without enforcing lockfile if missing
RUN pnpm install --frozen-lockfile || pnpm install
# Vite build-time environment variables (passed via build args)
ARG VITE_KEYCLOAK_BASE_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_REDIRECT_URI
ARG VITE_USER_SERVICE_URL
ARG VITE_API_BASE_URL
ARG VITE_BUSINESS_SERVICE_URL
ARG VITE_CAMPAIGN_SERVICE_URL
ARG VITE_BUSINESS_ID
ENV VITE_KEYCLOAK_BASE_URL=${VITE_KEYCLOAK_BASE_URL}
ENV VITE_KEYCLOAK_REALM=${VITE_KEYCLOAK_REALM}
ENV VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID}
ENV VITE_REDIRECT_URI=${VITE_REDIRECT_URI}
ENV VITE_USER_SERVICE_URL=${VITE_USER_SERVICE_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BUSINESS_SERVICE_URL=${VITE_BUSINESS_SERVICE_URL}
ENV VITE_CAMPAIGN_SERVICE_URL=${VITE_CAMPAIGN_SERVICE_URL}
ENV VITE_BUSINESS_ID=${VITE_BUSINESS_ID}
# Ensure missing runtime deps used in source are present
RUN pnpm add date-fns@^3.6.0
# Copy only source and config (avoid node_modules)
COPY businesses/da_salva/frontend/index.html ./index.html
COPY businesses/da_salva/frontend/vite.config.ts ./vite.config.ts
COPY businesses/da_salva/frontend/tailwind.config.ts ./tailwind.config.ts
COPY businesses/da_salva/frontend/postcss.config.js ./postcss.config.js
COPY businesses/da_salva/frontend/components.json ./components.json
COPY businesses/da_salva/frontend/attached_assets ./attached_assets
COPY businesses/da_salva/frontend/src ./src
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
ENV PORT=5173
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /app .
EXPOSE 5173
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "5173"]
