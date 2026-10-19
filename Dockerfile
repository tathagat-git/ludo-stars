# ─── Build stage ─────────────────────────────────────────────────────────────
# Uses the official Bun image for fast installs + native TS execution.
FROM oven/bun:1 AS build

WORKDIR /app

# Install dependencies first (cached layer).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Generate the Prisma client using the POSTGRES schema (not the default
# SQLite schema) so the generated query engine matches the production DB.
# No DATABASE_URL needed for `prisma generate` — it only reads the schema.
RUN bunx prisma generate --schema=prisma/schema.render.prisma

# Build the Next.js production bundle (standalone output).
# Set a placeholder DATABASE_URL so Prisma Client doesn't throw at import
# time during Next.js's page-data collection phase of the build.
ENV DATABASE_URL="postgresql://placeholder@build-time:5432/placeholder"
RUN bun run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
# Use the official Node.js image for runtime — the Next.js standalone server.js
# is a Node file, and Node guarantees full compatibility with the Prisma CLI
# (which spawns native Rust engines and uses Node-specific APIs).
FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copy the standalone server + static assets + public folder.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copy the ENTIRE node_modules from the build stage so the prisma CLI + ALL
# its transitive deps (effect, @prisma/config, etc.) are available at runtime.
# Cherry-picking individual packages missed transitive deps; copying the whole
# tree is ~50MB bigger but guarantees `prisma db push` works at startup.
# The standalone bundle's traced node_modules is a subset of this, so the
# Next.js server.js still resolves @prisma/client correctly.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# On every container start: push the Prisma schema to Postgres (creates/updates
# tables — idempotent and ~1s when already current), then boot the Next.js
# standalone server. We invoke the prisma CLI via its direct entry file (not
# `npx prisma`) so we don't depend on node_modules/.bin symlinks being present.
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js db push --schema=prisma/schema.render.prisma --accept-data-loss && node server.js"]