'use client'

// Ludo client — socket.io connection + React hook for the game room.
//
// The client connects to the game-service (a separate socket.io mini-service)
// which is the authoritative source of game state. All rolls/moves go through
// the server; the client just renders the state it receives.
//
// All socket URLs use the relative path `/` + `?XTransformPort=3003` in local
// dev (Caddy gateway), OR the full `NEXT_PUBLIC_GAME_SERVICE_URL` in production
// (Render / any host without a Caddy gateway).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GameEvent, GameState, LegalMove } from './engine'

export const GAME_SERVICE_PORT = 3003

/**
 * The public URL of the game-service (Socket.IO).
 *
 * - In LOCAL DEV (the sandbox / your laptop): this is empty, so the client
 *   connects to the same origin via the Caddy gateway using
 *   `/?XTransformPort=3003`. No extra config needed.
 *
 * - In PRODUCTION (Render / any host without a Caddy gateway): set
 *   `NEXT_PUBLIC_GAME_SERVICE_URL` to the game-service's public URL, e.g.
 *   `https://ludo-game-service.onrender.com`. The client connects directly.
 *
 * IMPORTANT: `NEXT_PUBLIC_*` env vars are inlined into the JS bundle at BUILD
 * time (not runtime). On Render, the env var is only available at runtime, so
 * we ALSO read it from `window.__ENV__` which is injected by a runtime script
 * tag (see `src/app/layout.tsx` → `RuntimeEnvScript`). The runtime value
 * takes precedence over the build-time value, so updating the env var on
 * Render (without a rebuild) takes effect immediately.
 */
function readGameServiceUrl(): string {
  // Runtime value (injected by a <script> tag in the layout that reads the
  // server-side env var and writes it to window.__ENV__).
  if (typeof window !== 'undefined') {
    const runtimeVal = (
      window as unknown as { __ENV__?: Record<string, string> }
    ).__ENV__?.NEXT_PUBLIC_GAME_SERVICE_URL
    if (runtimeVal) return runtimeVal
  }
  // Build-time value (baked into the JS bundle during `next build`).
  return process.env.NEXT_PUBLIC_GAME_SERVICE_URL ?? ''
}

export const GAME_SERVICE_URL = readGameServiceUrl()