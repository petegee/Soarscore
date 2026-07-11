# Tactical demo image: the base server serves the companion SPA + API as one
# process (apps/base/src/app.ts serves apps/companion/dist when NODE_ENV=production).
# SQLite lives at ./data/soarscore.db and is deliberately EPHEMERAL here — it
# resets on every redeploy/restart, which is fine for a throwaway demo.

# ---- build stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Build toolchain for better-sqlite3's native addon (falls back to compile if
# no prebuilt binary matches the platform).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install deps against the workspace manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/base/package.json apps/base/
COPY apps/companion/package.json apps/companion/
RUN npm ci

# Build shared -> companion -> base (see root "build" script).
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ---------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Preserve the workspace layout so the @soarscore/shared symlink and the
# ../../companion/dist static path both resolve.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/base/package.json ./apps/base/package.json
COPY --from=build /app/apps/base/dist ./apps/base/dist
COPY --from=build /app/apps/companion/dist ./apps/companion/dist

# Render injects PORT; index.ts reads it (defaults to 3000) and binds 0.0.0.0.
EXPOSE 3000
CMD ["node", "apps/base/dist/index.js"]
