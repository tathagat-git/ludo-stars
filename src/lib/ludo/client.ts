'use client'

// Ludo client — socket connection + `useGameRoom` React hook.
//
// Connects to the game-service websocket mini-service (port 3003 via the
// Caddy XTransformPort gateway). Exposes a single hook that manages:
//   - connection lifecycle
//   - room:join on connect
//   - room state (pre-game lobby)
//   - game state (during play)
//   - last game event (transient highlight info)
//   - chat messages
//   - errors
//
// All socket URLs use the relative path `/` + `?XTransformPort=3003` — NEVER
// write the port in the URL itself (Caddy rewrites via the query).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GameEvent, GameState, LegalMove } from './engine'

export const GAME_SERVICE_PORT = 3003

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

/// Create a connected game socket for a given room/user. The caller is
/// responsible for emitting `room:join` (the hook does this on connect).
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
  const socket = io('/?XTransformPort=' + GAME_SERVICE_PORT, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
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
  // Create the socket lazily on first render. Re-create it only if the
  // (code, userId, username) tuple changes (rare in practice — the GameRoom
  // is usually mounted fresh per game). Using a lazy initializer avoids the
  // "setState in effect" lint warning while keeping the socket stable across
  // re-renders.
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
      // Always emit room:join on connect. The server is idempotent: if we
      // already have a seat, it re-binds the socket; otherwise it adds us.
      // This handles both the initial connect and reconnects (StrictMode
      // double-mount, network blips, HMR).
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
        // Full room state is delivered separately via `room:state`. We just
        // log the seat assignment here.
        // (No state mutation — `room:state` will arrive immediately after.)
      },
    )
    s.on(SERVER_EV.ROOM_ERROR, (err: { message?: string } | string) => {
      const msg = typeof err === 'string' ? err : (err?.message ?? 'Room error')
      setError(msg)
    })
    s.on(SERVER_EV.GAME_STARTED, (payload: { gameState: GameState }) => {
      const gs = payload?.gameState
      if (gs) {
        setGameState(gs)
        setRoom((prev) =>
          prev ? { ...prev, gameState: gs, started: true, phase: gs.phase } : prev,
        )
      }
    })
    s.on(SERVER_EV.GAME_STATE, (state: GameState) => {
      setGameState(state)
      setRoom((prev) => (prev ? { ...prev, gameState: state, phase: state.phase } : prev))
    })
    s.on(SERVER_EV.GAME_EVENT, (ev: GameEvent) => {
      setLastEvent(ev)
    })
    s.on(
      SERVER_EV.GAME_OVER,
      (payload: { winners: number[]; players: GameState['players'] }) => {
        // We have the full state already (last `game:state` emission). The
        // payload is just a summary; we use it to refresh `winners`/`players`
        // if needed.
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

    // Auto-connect if not already connected.
    if (!s.connected) s.connect()

    // socket.io auto-connects on creation, so by the time this effect runs
    // the socket may already be connected — in which case the `connect`
    // handler above was registered too late and never fired. Handle that
    // case by emitting room:join immediately.
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

  // ── Derived state ──────────────────────────────────────────────────────────
  const mySeat = useMemo(() => {
    if (!room) return null
    // The server conveniently provides `yourSeat`. Fall back to a manual
    // lookup if it's not set.
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

  // ── Actions ────────────────────────────────────────────────────────────────
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

  // The server's `room:remove-bot` handler doesn't take a seat arg — it
  // always removes the last-added bot. We keep the param for API
  // forward-compat but the server will ignore it.
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
