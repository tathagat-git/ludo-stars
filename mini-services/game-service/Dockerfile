# ─── Build stage ─────────────────────────────────────────────────────────────
# The game-service imports the Ludo engine from ../../src/lib/ludo/, so we
# need the full repo (not just mini-services/game-service/).
FROM oven/bun:1 AS build

WORKDIR /app

# Install root dependencies (for the shared engine imports).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Install game-service dependencies.
COPY mini-services/game-service/package.json mini-services/game-service/bun.lock ./
RUN cd /app && mkdir -p mini-services/game-service && \
    cp mini-services/game-service/package.json mini-services/game-service/bun.lock mini-services/game-service/ 2>/dev/null || true
WORKDIR /app/mini-services/game-service
RUN bun install
WORKDIR /app

# Copy the full source (engine + game-service).
COPY . .

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM oven/bun:1 AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy the repo (engine + game-service + node_modules).
COPY --from=build /app ./

# Render assigns the port via PORT env; default to 3003 for other hosts.
EXPOSE 3003

# Run the game-service. It reads PORT from env and binds to 0.0.0.0.
CMD ["bun", "mini-services/game-service/index.ts"]
