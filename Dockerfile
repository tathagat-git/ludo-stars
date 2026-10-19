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

# Copy the Prisma client (generated for Postgres) + the prisma CLI + schema
# so the container can run `prisma db push` at startup to migrate the DB.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# On every container start: push the Prisma schema to Postgres (creates/updates
# tables — idempotent and ~1s when already current), then boot the Next.js
# standalone server. This replaces Render's preDeployCommand which isn't
# available on the free tier.
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.render.prisma --accept-data-loss && node server.js"]