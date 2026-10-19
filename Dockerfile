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
FROM oven/bun:1 AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Copy the standalone server + static assets + public folder.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copy the Prisma client (generated for Postgres) so runtime DB queries work.
# The standalone bundle includes @prisma/client (traced by Next.js), but we
# also copy the prisma CLI + schema for the pre-deploy `prisma db push`.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# The standalone server.js is a Node file — Bun runs it fine.
# prisma db push runs as a Render pre-deploy hook (see render.yaml), so by
# the time this CMD runs the DB schema is already in place.
CMD ["bun", "server.js"]
