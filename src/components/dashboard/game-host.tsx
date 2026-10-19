'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { GameRoom } from '@/components/game/game-room'

/**
 * GameHost — small client wrapper around Task 7's `<GameRoom />`.
 *
 * Why this exists:
 *   The route (`src/app/page.tsx`) is a React Server Component. Server
 *   components cannot pass function callbacks (like `onExit`) to client
 *   components because functions are not serializable. This wrapper lives
 *   on the client, owns the Next.js router, and forwards an `onExit`
 *   callback that performs a soft navigation back to `/`.
 *
 * Exit semantics:
 *   `onExit` calls `router.push('/')`, which strips the `?room=` query
 *   and re-runs the server component on `/` → renders the Dashboard.
 *   The GameRoom component itself may also call `window.location.search = ''`
 *   internally (per Task 7's spec) for a hard reload if it needs to fully
 *   tear down its websocket connection; both approaches end at `/`.
 */
export interface GameHostProps {
  code: string
  userId: string
  username: string
  mode: 'classic' | 'twist'
  maxPlayers: number
}

export function GameHost({ code, userId, username, mode, maxPlayers }: GameHostProps) {
  const router = useRouter()

  const handleExit = React.useCallback(() => {
    // Soft-navigate back to the dashboard.
    router.push('/')
  }, [router])

  return (
    <GameRoom
      code={code}
      userId={userId}
      username={username}
      mode={mode}
      maxPlayers={maxPlayers}
      onExit={handleExit}
    />
  )
}

export default GameHost
