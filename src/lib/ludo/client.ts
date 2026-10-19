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

// ─── Socket event names (must match mini-services/game-service/index.ts) ─────
// Client → server
export const EV = {
  ROOM_JOIN: 'room:join',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_ADD_BOT: 'room:add-bot',
  ROOM_REMOVE_BOT: 'room:remove-bot',
  ROOM_LEAVE: 'room:leave',
  GAME_ROLL: 'game:roll',
  GAME_MOVE: 'game:move',
  CHAT_MESSAGE: 'chat:message',
} as const

// Server → client
export const SERVER_EV = {
  ROOM_STATE: 'room:state',
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  GAME_STARTED: 'game:started',
  GAME_STATE: 'game:state',
  GAME_EVENT: 'game:event',
  GAME_OVER: 'game:over',
  CHAT_MESSAGE: 'chat:message',
} as const

// ─── Room types (mirrors what mini-services/game-service/index.ts emits) ────

export interface SeatInfo {
  seat: number
  userId: string | null
  isBot: boolean
  name: string // server-side field for both human username and bot name
  ready: boolean
  connected: boolean
  forfeited: boolean
  isHost: boolean
}

export interface RoomState {
  id: string
  code: string
  mode: 'classic' | 'twist'
  maxPlayers: number
  botCount: number
  seats: SeatInfo[]
  gameState: GameState | null
  hostUserId: string
  yourSeat: number | null
  started: boolean
  phase: 'roll' | 'move' | 'gameover' | null
}

export interface ChatMessage {
  id: string // generated client-side (server doesn't send one)
  userId: string | null
  username: string
  content: string
  type: 'user' | 'system'
  timestamp: number
}

export interface UseGameRoomResult {
  socket: Socket | null
  connected: boolean
  room: RoomState | null
  gameState: GameState | null
  lastEvent: GameEvent | null
  chat: ChatMessage[]
  error: string | null
  mySeat: number | null
  isMyTurn: boolean
  legalMoves: LegalMove[]
  // Actions
  roll: () => void
  move: (tokenId: number, direction: 'forward' | 'backward') => void
  sendMessage: (content: string) => void
  setReady: () => void
  startGame: () => void
  addBot: () => void
  removeBot: (seat?: number) => void
  leaveRoom: () => void
}

/// Optional room configuration carried alongside the join payload. When the
/// room is created via the lobby API (which persists a Game row with the
/// chosen mode + maxPlayers), the GameRoom fetches that config and passes it
/// here so the websocket `room:join` creates the room with the right settings
/// (instead of the server defaulting to 4 players).
export interface RoomConfig {
  mode?: 'classic' | 'twist'
  maxPlayers?: number
}

export function createGameSocket(
  code: string,
  userId: string,
  username: string,
  config?: RoomConfig,
): Socket {
  // Build the socket.io connection URL.
  // - If NEXT_PUBLIC_GAME_SERVICE_URL is set (production), connect directly.
  // - Otherwise (local dev with Caddy), connect to same origin + the
  //   XTransformPort query so Caddy routes to the game-service port.
  const socketUrl = GAME_SERVICE_URL || '/'
  const socketQuery = GAME_SERVICE_URL
    ? undefined
    : { XTransformPort: String(GAME_SERVICE_PORT) }

  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    query: socketQuery,
  })
  // Stash join payload (including optional room config) so we can re-emit on
  // reconnect. The server reads mode/maxPlayers only when creating a NEW
  // room; on reconnect it ignores them (the room already exists).
  ;(
    socket as unknown as {
      __joinPayload?: {
        code: string
        userId: string
        username: string
        mode?: string
        maxPlayers?: number
      }
    }
  ).__joinPayload = {
    code,
    userId,
    username,
    mode: config?.mode,
    maxPlayers: config?.maxPlayers,
  }
  return socket
}

export function useGameRoom(
  code: string,
  userId: string,
  username: string,
  config?: RoomConfig,
): UseGameRoomResult {
  const [socket] = useState<Socket>(() =>
    createGameSocket(code, userId, username, config),
  )
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = socket

    const handleConnect = () => {
      setConnected(true)
      s.emit(EV.ROOM_JOIN, {
        code,
        userId,
        username,
        mode: config?.mode,
        maxPlayers: config?.maxPlayers,
      })
    }
    const handleDisconnect = () => setConnected(false)

    s.on('connect', handleConnect)
    s.on('disconnect', handleDisconnect)

    s.on(SERVER_EV.ROOM_STATE, (state: RoomState) => {
      setRoom(state)
      if (state.gameState) setGameState(state.gameState)
    })
    s.on(
      SERVER_EV.ROOM_JOINED,
      (_meta: {
        roomId: string
        code: string
        seat: number
        mode: 'classic' | 'twist'
        maxPlayers: number
      }) => {
        // Full room state arrives via room:state.
      },
    )
    s.on(SERVER_EV.ROOM_ERROR, (err: { message?: string } | string) => {
      const msg = typeof err === 'string' ? err : err?.message ?? 'Room error'
      setError(msg)
    })
    s.on(SERVER_EV.GAME_STARTED, (payload: { gameState: GameState }) => {
      const gs = payload?.gameState
      if (gs) {
        setGameState(gs)
        setRoom((prev) =>
          prev
            ? { ...prev, gameState: gs, started: true, phase: gs.phase }
            : prev,
        )
      }
    })
    s.on(SERVER_EV.GAME_STATE, (state: GameState) => {
      setGameState(state)
      setRoom((prev) =>
        prev ? { ...prev, gameState: state, phase: state.phase } : prev,
      )
    })
    s.on(SERVER_EV.GAME_EVENT, (ev: GameEvent) => {
      setLastEvent(ev)
    })
    s.on(
      SERVER_EV.GAME_OVER,
      (payload: { winners: number[]; players: GameState['players'] }) => {
        setGameState((prev) =>
          prev && payload
            ? {
                ...prev,
                winners: payload.winners,
                players: payload.players,
                phase: 'gameover',
              }
            : prev,
        )
        setRoom((prev) => (prev ? { ...prev, phase: 'gameover' } : prev))
      },
    )
    s.on(
      SERVER_EV.CHAT_MESSAGE,
      (msg: {
        userId: string | null
        username: string
        content: string
        timestamp: number
      }) => {
        setChat((prev) =>
          [
            ...prev,
            {
              id: `${msg.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
              userId: msg.userId,
              username: msg.username,
              content: msg.content,
              timestamp: msg.timestamp,
              type: 'user' as const,
            },
          ].slice(-200),
        )
      },
    )

    if (!s.connected) s.connect()

    if (s.connected) {
      s.emit(EV.ROOM_JOIN, {
        code,
        userId,
        username,
        mode: config?.mode,
        maxPlayers: config?.maxPlayers,
      })
    }

    return () => {
      s.off('connect', handleConnect)
      s.off('disconnect', handleDisconnect)
      s.disconnect()
    }
  }, [socket, code, userId, username])

  const mySeat = useMemo(() => {
    if (!room) return null
    if (room.yourSeat !== null && room.yourSeat !== undefined) return room.yourSeat
    const seat = room.seats.find((s) => s.userId === userId)
    return seat ? seat.seat : null
  }, [room, userId])

  const isMyTurn = useMemo(() => {
    if (!gameState || mySeat === null) return false
    if (gameState.phase === 'gameover') return false
    return gameState.currentSeat === mySeat
  }, [gameState, mySeat])

  const legalMoves = useMemo(() => {
    if (!gameState) return []
    if (mySeat === null) return []
    if (gameState.currentSeat !== mySeat) return []
    return gameState.legalMoves ?? []
  }, [gameState, mySeat])

  const roll = useCallback(() => {
    socket?.emit(EV.GAME_ROLL)
  }, [socket])

  const move = useCallback(
    (tokenId: number, direction: 'forward' | 'backward') => {
      socket?.emit(EV.GAME_MOVE, { tokenId, direction })
    },
    [socket],
  )

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      socket?.emit(EV.CHAT_MESSAGE, { content: trimmed })
    },
    [socket],
  )

  const setReady = useCallback(() => {
    socket?.emit(EV.ROOM_READY)
  }, [socket])

  const startGame = useCallback(() => {
    socket?.emit(EV.ROOM_START)
  }, [socket])

  const addBot = useCallback(() => {
    socket?.emit(EV.ROOM_ADD_BOT)
  }, [socket])

  const removeBot = useCallback(
    (_seat?: number) => {
      socket?.emit(EV.ROOM_REMOVE_BOT)
    },
    [socket],
  )

  const leaveRoom = useCallback(() => {
    socket?.emit(EV.ROOM_LEAVE)
    socket?.disconnect()
  }, [socket])

  return {
    socket,
    connected,
    room,
    gameState,
    lastEvent,
    chat,
    error,
    mySeat,
    isMyTurn,
    legalMoves,
    roll,
    move,
    sendMessage,
    setReady,
    startGame,
    addBot,
    removeBot,
    leaveRoom,
  }
}