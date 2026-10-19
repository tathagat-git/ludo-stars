// ============================================================================
// Ludo Stars — Real-time Game Service (WebSocket)
// ----------------------------------------------------------------------------
// Task 5 — socket.io server running on port 3003.
// Path is "/" so Caddy can route by the XTransformPort query param.
//   Client connects with: io('/?XTransformPort=3003', { transports: [...] })
//
// This service is the authoritative game-state machine. It reuses the ludo
// engine + bot AI from the Next.js source tree:
//   - ../../src/lib/ludo/engine.ts  (rules, state transitions)
//   - ../../src/lib/ludo/bot.ts     (heuristic bot AI, name + delay helpers)
//
// Bun supports native TS imports across the workspace, so we import directly.
// ============================================================================
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import {
  createInitialState,
  applyRoll,
  applyMove,
  passTurn,
  colorOf,
  COLORS,
  type GameState,
  type Player,
  type Color,
  type GameEvent,
} from '../../src/lib/ludo/engine.ts'
import { chooseBotMove, randomBotName, botThinkDelay } from '../../src/lib/ludo/bot.ts'

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
// Port: Render (and most PaaS) assign the port via the PORT env var. In local
// dev we default to 3003 (the Caddy gateway routes via ?XTransformPort=3003).
const PORT = Number(process.env.PORT) || 3003

const ALL_HUMANS_DISCONNECT_DESTROY_MS = 60_000
const EMPTY_ROOM_DESTROY_GRACE_MS = 5_000 // absorbs StrictMode reconnects + blips
const PLAYER_DISCONNECT_FORFEIT_MS = 15_000 // grace before a disconnected human forfeits

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
type GameMode = 'classic' | 'twist'

interface SeatState {
  seat: number // 0..maxPlayers-1 (matches COLORS index in the engine)
  userId: string | null // null for bots
  isBot: boolean
  name: string // display name (username or bot name)
  socketId: string | null // null when disconnected
  ready: boolean // humans toggle this; bots are always "ready"
  disconnected?: boolean // true when player dropped mid-game
  forfeited?: boolean // true when player forfeited mid-game
  joinedAt: number
  forfeitTimer?: NodeJS.Timeout | null // grace timer before real forfeit
}

interface RoomState {
  id: string // == code (uppercase); used as Map key
  code: string // 6-char uppercase code shared with users
  mode: GameMode
  maxPlayers: number // 2 | 3 | 4
  botCount: number // number of bot seats currently in the room (lobby only)
  seats: SeatState[]
  gameState: GameState | null
  hostUserId: string
  createdAt: number
  // timers
  botTimer: NodeJS.Timeout | null
  destroyTimer: NodeJS.Timeout | null
  endGameTimer: NodeJS.Timeout | null
}

interface SocketBinding {
  userId: string
  roomId: string
}

// ----------------------------------------------------------------------------
// In-memory stores
// ----------------------------------------------------------------------------
const rooms = new Map<string, RoomState>() // roomId === code → RoomState
const sockets = new Map<string, SocketBinding>() // socketId → binding

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusions
function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

function generateUniqueRoomCode(): string {
  let code = generateRoomCode()
  let tries = 0
  while (rooms.has(code) && tries < 100) {
    code = generateRoomCode()
    tries++
  }
  return code
}

function nextFreeSeat(room: RoomState): number {
  const taken = new Set(room.seats.map((s) => s.seat))
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!taken.has(i)) return i
  }
  return -1
}

function seatOfSocket(room: RoomState, socketId: string): SeatState | null {
  return room.seats.find((s) => s.socketId === socketId) ?? null
}

function emitRoomState(room: RoomState) {
  for (const seat of room.seats) {
    if (!seat.socketId) continue
    io.to(seat.socketId).emit('room:state', roomSnapshot(room, seat.socketId))
  }
}

function emitGameState(room: RoomState) {
  if (!room.gameState) return
  for (const seat of room.seats) {
    if (!seat.socketId) continue
    io.to(seat.socketId).emit('game:state', room.gameState)
  }
  if (room.gameState.lastEvent) {
    for (const seat of room.seats) {
      if (!seat.socketId) continue
      io.to(seat.socketId).emit('game:event', room.gameState.lastEvent)
    }
  }
}

function roomSnapshot(room: RoomState, forSocketId?: string) {
  const yourSeat = forSocketId ? (seatOfSocket(room, forSocketId)?.seat ?? null) : null
  return {
    id: room.id,
    code: room.code,
    mode: room.mode,
    maxPlayers: room.maxPlayers,
    botCount: room.seats.filter((s) => s.isBot).length,
    seats: room.seats.map((s) => ({
      seat: s.seat,
      userId: s.userId,
      isBot: s.isBot,
      name: s.name,
      ready: s.ready,
      connected: s.socketId !== null,
      forfeited: !!s.forfeited,
      isHost: s.userId === room.hostUserId,
    })),
    gameState: room.gameState,
    hostUserId: room.hostUserId,
    yourSeat,
    started: !!room.gameState,
    phase: room.gameState?.phase ?? null,
  }
}

function emitRoomError(socket: Socket, message: string) {
  socket.emit('room:error', { message })
}

function clearBotTimer(room: RoomState) {
  if (room.botTimer) {
    clearTimeout(room.botTimer)
    room.botTimer = null
  }
}

function clearDestroyTimer(room: RoomState) {
  if (room.destroyTimer) {
    clearTimeout(room.destroyTimer)
    room.destroyTimer = null
  }
}

function destroyRoom(room: RoomState) {
  clearBotTimer(room)
  clearDestroyTimer(room)
  rooms.delete(room.id)
  console.log(`[room ${room.code}] destroyed`)
}

// ----------------------------------------------------------------------------
// Room lifecycle
// ----------------------------------------------------------------------------
function createRoom(opts: {
  code?: string
  userId: string
  mode: GameMode
  maxPlayers: number
}): RoomState {
  const code = (opts.code ?? generateUniqueRoomCode()).toUpperCase()
  const room: RoomState = {
    id: code,
    code,
    mode: opts.mode,
    maxPlayers: opts.maxPlayers,
    botCount: 0,
    seats: [],
    gameState: null,
    hostUserId: opts.userId,
    createdAt: Date.now(),
    botTimer: null,
    destroyTimer: null,
    endGameTimer: null,
  }
  rooms.set(code, room)
  console.log(`[room ${code}] created (mode=${opts.mode}, max=${opts.maxPlayers})`)
  return room
}

function addPlayerToRoom(
  room: RoomState,
  userId: string,
  name: string,
  socketId: string,
): SeatState {
  // If user already has a seat in this room (e.g., reconnecting), reuse it.
  const existing = room.seats.find((s) => s.userId === userId && !s.isBot)
  if (existing) {
    existing.socketId = socketId
    existing.disconnected = false
    // Cancel any pending forfeit timer — the player reconnected in time.
    if (existing.forfeitTimer) {
      clearTimeout(existing.forfeitTimer)
      existing.forfeitTimer = null
      console.log(`[room ${room.code}] ${name} reconnected — forfeit cancelled`)
    }
    return existing
  }
  const seatIdx = nextFreeSeat(room)
  if (seatIdx === -1) {
    throw new Error('Room is full')
  }
  const seat: SeatState = {
    seat: seatIdx,
    userId,
    isBot: false,
    name,
    socketId,
    ready: false,
    joinedAt: Date.now(),
  }
  room.seats.push(seat)
  // keep seats sorted by seat index for stability
  room.seats.sort((a, b) => a.seat - b.seat)
  return seat
}

function addBotToRoom(room: RoomState): SeatState | null {
  const seatIdx = nextFreeSeat(room)
  if (seatIdx === -1) return null
  const bot: SeatState = {
    seat: seatIdx,
    userId: null,
    isBot: true,
    name: randomBotName(),
    socketId: null,
    ready: true,
    joinedAt: Date.now(),
  }
  room.seats.push(bot)
  room.seats.sort((a, b) => a.seat - b.seat)
  return bot
}

function removeLastBot(room: RoomState): boolean {
  // Remove the highest-seat bot.
  for (let i = room.seats.length - 1; i >= 0; i--) {
    if (room.seats[i]!.isBot) {
      room.seats.splice(i, 1)
      return true
    }
  }
  return false
}

function removeSeat(room: RoomState, seatIdx: number) {
  const i = room.seats.findIndex((s) => s.seat === seatIdx)
  if (i >= 0) room.seats.splice(i, 1)
}

// ----------------------------------------------------------------------------
// Game start / bot turn scheduling
// ----------------------------------------------------------------------------
function startGame(room: RoomState): { ok: boolean; error?: string } {
  if (room.gameState) return { ok: false, error: 'Game already started' }

  // Sort seats so humans come first (in their existing seat order), then bots.
  const humans = room.seats.filter((s) => !s.isBot && !s.forfeited)
  const bots = room.seats.filter((s) => s.isBot)

  // Validate humans are all ready.
  if (humans.length > 1) {
    const notReady = humans.find((s) => !s.ready)
    if (notReady) return { ok: false, error: 'Not all human players are ready' }
  }

  // Fill remaining seats with bots up to maxPlayers.
  const filled = [...humans, ...bots]
  while (filled.length < room.maxPlayers) {
    const bot: SeatState = {
      seat: filled.length,
      userId: null,
      isBot: true,
      name: randomBotName(),
      socketId: null,
      ready: true,
      joinedAt: Date.now(),
    }
    filled.push(bot)
  }

  if (filled.length < 2) return { ok: false, error: 'Need at least 2 players to start' }

  // Re-assign seat indices 0..N-1 (humans first, then bots).
  filled.forEach((s, i) => {
    s.seat = i
  })
  room.seats = filled
  room.maxPlayers = filled.length
  room.botCount = bots.length

  const players: Player[] = filled.map((s) => ({
    seat: s.seat,
    userId: s.userId,
    isBot: s.isBot,
    botName: s.isBot ? s.name : undefined,
    name: s.name,
    color: COLORS[s.seat] as Color,
  }))

  room.gameState = createInitialState(room.id, room.mode, room.maxPlayers, players)

  console.log(
    `[room ${room.code}] game started — ${players.length} players ` +
      `(${humans.length} human, ${bots.length} bot)`,
  )

  // Broadcast start + initial state.
  for (const seat of room.seats) {
    if (!seat.socketId) continue
    io.to(seat.socketId).emit('game:started', { gameState: room.gameState })
  }
  emitGameState(room)
  emitRoomState(room)

  // If the first seat is a bot, kick off the bot turn loop.
  scheduleBotTurn(room)

  return { ok: true }
}

function endGame(room: RoomState) {
  clearBotTimer(room)
  if (!room.gameState) return
  const payload = {
    winners: room.gameState.winners,
    players: room.gameState.players,
  }
  for (const seat of room.seats) {
    if (!seat.socketId) continue
    io.to(seat.socketId).emit('game:over', payload)
  }
  console.log(
    `[room ${room.code}] game over — winners: ${room.gameState.winners.join(',')}`,
  )
}

/**
 * If the current seat is a bot, schedule its next action (roll or move).
 * Always called after any state mutation that could change currentSeat/phase.
 * Only one bot timer is active per room at a time.
 */
function scheduleBotTurn(room: RoomState) {
  clearBotTimer(room)
  if (!room.gameState) return
  if (room.gameState.phase === 'gameover') {
    endGame(room)
    return
  }

  const seatIdx = room.gameState.currentSeat
  const seat = room.seats[seatIdx]
  if (!seat || !seat.isBot) return

  const delay = botThinkDelay()
  room.botTimer = setTimeout(() => {
    room.botTimer = null
    if (!room.gameState) return
    if (room.gameState.phase === 'gameover') {
      endGame(room)
      return
    }

    const curSeat = room.gameState.currentSeat
    const curSeatState = room.seats[curSeat]
    if (!curSeatState || !curSeatState.isBot) return // turn moved to a human

    if (room.gameState.phase === 'roll') {
      room.gameState = applyRoll(room.gameState)
      emitGameState(room)
      if (room.gameState.phase === 'gameover') {
        endGame(room)
        return
      }
      scheduleBotTurn(room)
    } else if (room.gameState.phase === 'move') {
      const mv = chooseBotMove(room.gameState)
      if (mv) {
        room.gameState = applyMove(room.gameState, mv.tokenId, mv.direction)
      } else {
        // Safety net — engine should already auto-pass when no moves,
        // but if we somehow get here, pass the turn explicitly.
        room.gameState = passTurn(room.gameState)
      }
      emitGameState(room)
      if (room.gameState.phase === 'gameover') {
        endGame(room)
        return
      }
      scheduleBotTurn(room)
    }
  }, delay)
}

// ----------------------------------------------------------------------------
// Disconnect / forfeit handling
// ----------------------------------------------------------------------------
function forfeitSeat(room: RoomState, seatIdx: number) {
  if (!room.gameState) return
  const seat = room.seats[seatIdx]
  if (!seat) return
  seat.forfeited = true
  seat.socketId = null
  seat.disconnected = true

  // Push seat to winners (engine skips winners when cycling turns).
  // Only push if not already in.
  if (!room.gameState.winners.includes(seatIdx)) {
    room.gameState.winners.push(seatIdx)
    // Mark the player as finished-last (rank = maxPlayers, last place).
    const rank = room.gameState.players.length
    room.gameState.players = room.gameState.players.map((p) =>
      p.seat === seatIdx ? { ...p, finishedAt: Date.now(), rank } : p,
    )
  }

  // If it was their turn, advance to next non-winner seat.
  if (room.gameState.currentSeat === seatIdx && room.gameState.phase !== 'gameover') {
    room.gameState = passTurn(room.gameState)
  }

  emitGameState(room)
  emitRoomState(room)

  if (room.gameState.phase === 'gameover') {
    endGame(room)
    return
  }
  // If next seat is a bot, kick off the bot loop.
  scheduleBotTurn(room)
}

function handleDisconnect(socket: Socket) {
  const binding = sockets.get(socket.id)
  sockets.delete(socket.id)
  if (!binding) return
  const room = rooms.get(binding.roomId)
  if (!room) return

  const seat = room.seats.find((s) => s.socketId === socket.id)
  if (!seat) return

  seat.socketId = null
  seat.disconnected = true
  console.log(`[room ${room.code}] user ${seat.name} disconnected (seat ${seat.seat})`)

  if (room.gameState) {
    // Mid-game disconnect: DON'T immediately forfeit. Mark as disconnected
    // and give a grace period (15s) for the player to reconnect. This
    // absorbs React StrictMode's dev double-mount (which disconnects then
    // reconnects within milliseconds) and brief network blips.
    if (seat.isBot) {
      // Bots never reconnect — forfeit immediately.
      forfeitSeat(room, seat.seat)
    } else if (!seat.forfeitTimer) {
      // If it's the disconnected player's turn, auto-pass so the game
      // doesn't stall waiting for them.
      if (
        room.gameState.currentSeat === seat.seat &&
        room.gameState.phase !== 'gameover'
      ) {
        room.gameState = passTurn(room.gameState)
        emitGameState(room)
        emitRoomState(room)
        scheduleBotTurn(room)
      }
      seat.forfeitTimer = setTimeout(() => {
        const r = rooms.get(room.id)
        if (!r) return
        const s = r.seats.find((x) => x.seat === seat.seat)
        if (!s) return
        if (s.socketId === null) {
          // Still disconnected after grace — forfeit for real.
          s.forfeitTimer = null
          console.log(`[room ${r.code}] user ${s.name} forfeited (disconnected too long)`)
          forfeitSeat(r, s.seat)
        } else {
          s.forfeitTimer = null
        }
      }, PLAYER_DISCONNECT_FORFEIT_MS)
    }
  } else {
    // Lobby disconnect: just remove the seat.
    removeSeat(room, seat.seat)
    emitRoomState(room)
  }

  // If all humans have left and only bots remain (mid-game), end the game
  // after a grace period. The grace period absorbs React StrictMode's dev
  // double-mount (which disconnects then reconnects within milliseconds).
  const humans = room.seats.filter((s) => !s.isBot)
  const humansConnected = humans.filter((s) => s.socketId !== null)
  if (humans.length > 0 && humansConnected.length === 0) {
    if (room.gameState && room.gameState.phase !== 'gameover' && !room.endGameTimer) {
      console.log(
        `[room ${room.code}] all humans disconnected — starting ${ALL_HUMANS_DISCONNECT_DESTROY_MS}ms end-game timer`,
      )
      room.endGameTimer = setTimeout(() => {
        const r = rooms.get(room.id)
        if (!r) return
        const stillNoHumans = r.seats
          .filter((s) => !s.isBot)
          .every((s) => s.socketId === null)
        if (stillNoHumans && r.gameState && r.gameState.phase !== 'gameover') {
          console.log(`[room ${r.code}] all humans still disconnected — ending game`)
          endGame(r)
        }
        r.endGameTimer = null
      }, ALL_HUMANS_DISCONNECT_DESTROY_MS)
    }
    // Schedule room destruction after 60s.
    if (!room.destroyTimer) {
      room.destroyTimer = setTimeout(() => {
        const stillDead = rooms.get(room.id)
        if (!stillDead) return
        const stillNoHumans = stillDead.seats
          .filter((s) => !s.isBot)
          .every((s) => s.socketId === null)
        if (stillNoHumans) {
          destroyRoom(stillDead)
        }
      }, ALL_HUMANS_DISCONNECT_DESTROY_MS)
    }
  }

  // If room is now empty (no seats at all), destroy it after a short grace
  // period. The grace period absorbs React StrictMode's dev-only double-mount
  // (which disconnects then immediately reconnects) and brief network blips
  // without nuking a room a user is actively trying to join.
  if (room.seats.length === 0 && !room.destroyTimer) {
    room.destroyTimer = setTimeout(() => {
      const stillDead = rooms.get(room.id)
      if (!stillDead) return
      if (stillDead.seats.length === 0) {
        destroyRoom(stillDead)
      } else {
        stillDead.destroyTimer = null
      }
    }, EMPTY_ROOM_DESTROY_GRACE_MS)
  }
}

// ----------------------------------------------------------------------------
// Socket.io server
// ----------------------------------------------------------------------------
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

io.on('connection', (socket: Socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  // ── room:create ─────────────────────────────────────────────────────────
  socket.on(
    'room:create',
    (payload: {
      userId: string
      username: string
      mode?: GameMode
      maxPlayers?: number
    }) => {
      if (!payload?.userId || !payload?.username) {
        return emitRoomError(socket, 'Missing userId/username')
      }
      // If user is already in another room, leave it first.
      const prev = sockets.get(socket.id)
      if (prev && rooms.has(prev.roomId)) {
        const prevRoom = rooms.get(prev.roomId)!
        const prevSeat = prevRoom.seats.find((s) => s.socketId === socket.id)
        if (prevSeat) {
          prevSeat.socketId = null
          if (!prevRoom.gameState) removeSeat(prevRoom, prevSeat.seat)
          emitRoomState(prevRoom)
        }
      }

      const mode = payload.mode === 'classic' ? 'classic' : 'twist'
      const maxPlayers = clampMaxPlayers(payload.maxPlayers)
      const room = createRoom({ userId: payload.userId, mode, maxPlayers })
      sockets.set(socket.id, { userId: payload.userId, roomId: room.id })
      const seat = addPlayerToRoom(room, payload.userId, payload.username, socket.id)

      socket.emit('room:joined', {
        roomId: room.id,
        code: room.code,
        seat: seat.seat,
        mode: room.mode,
        maxPlayers: room.maxPlayers,
      })
      emitRoomState(room)
      console.log(
        `[room ${room.code}] ${payload.username} created & joined (seat ${seat.seat})`,
      )
    },
  )

  // ── room:join ───────────────────────────────────────────────────────────
  socket.on(
    'room:join',
    (payload: {
      code: string
      userId: string
      username: string
      mode?: GameMode
      maxPlayers?: number
    }) => {
      if (!payload?.code || !payload?.userId || !payload?.username) {
        return emitRoomError(socket, 'Missing code/userId/username')
      }
      const code = payload.code.toUpperCase()

      // Leave any previous room.
      const prev = sockets.get(socket.id)
      if (prev) {
        if (prev.roomId === code) {
          // Already in this room — just refresh socket binding (reconnect case).
          const r = rooms.get(code)
          if (r) {
            const existing = r.seats.find((s) => s.userId === payload.userId && !s.isBot)
            if (existing) {
              existing.socketId = socket.id
              existing.disconnected = false
              sockets.set(socket.id, { userId: payload.userId, roomId: r.id })
              socket.emit('room:joined', {
                roomId: r.id,
                code: r.code,
                seat: existing.seat,
                mode: r.mode,
                maxPlayers: r.maxPlayers,
              })
              emitRoomState(r)
              if (r.gameState) {
                socket.emit('game:started', { gameState: r.gameState })
                socket.emit('game:state', r.gameState)
              }
              return
            }
          }
        } else if (rooms.has(prev.roomId)) {
          const prevRoom = rooms.get(prev.roomId)!
          const prevSeat = prevRoom.seats.find((s) => s.socketId === socket.id)
          if (prevSeat) {
            prevSeat.socketId = null
            if (!prevRoom.gameState) removeSeat(prevRoom, prevSeat.seat)
            emitRoomState(prevRoom)
          }
        }
      }

      let room = rooms.get(code)
      if (!room) {
        // Create a new room with this code (host = joining user).
        const mode = payload.mode === 'classic' ? 'classic' : 'twist'
        const maxPlayers = clampMaxPlayers(payload.maxPlayers)
        room = createRoom({ code, userId: payload.userId, mode, maxPlayers })
      } else if (room.gameState) {
        // Game is in progress — only allow reconnection if this user already
        // has a seat (e.g., recovering from a disconnect / StrictMode remount).
        const existingSeat = room.seats.find(
          (s) => s.userId === payload.userId && !s.isBot,
        )
        if (!existingSeat) {
          return emitRoomError(socket, 'Game already in progress')
        }
        // Reconnect path: bind the new socket to the existing seat.
        existingSeat.socketId = socket.id
        existingSeat.disconnected = false
        if (existingSeat.forfeitTimer) {
          clearTimeout(existingSeat.forfeitTimer)
          existingSeat.forfeitTimer = null
          console.log(
            `[room ${room.code}] ${payload.username} reconnected mid-game — forfeit cancelled`,
          )
        }
        // Cancel any pending end-game timer (all-humans-disconnected).
        if (room.endGameTimer) {
          clearTimeout(room.endGameTimer)
          room.endGameTimer = null
          console.log(
            `[room ${room.code}] ${payload.username} reconnected — end-game timer cancelled`,
          )
        }
        sockets.set(socket.id, { userId: payload.userId, roomId: room.id })
        socket.emit('room:joined', {
          roomId: room.id,
          code: room.code,
          seat: existingSeat.seat,
          mode: room.mode,
          maxPlayers: room.maxPlayers,
        })
        emitRoomState(room)
        socket.emit('game:started', { gameState: room.gameState })
        socket.emit('game:state', room.gameState)
        return
      }

      // Check for full room.
      if (nextFreeSeat(room) === -1) {
        const existing = room.seats.find((s) => s.userId === payload.userId && !s.isBot)
        if (!existing) return emitRoomError(socket, 'Room is full')
      }

      sockets.set(socket.id, { userId: payload.userId, roomId: room.id })
      let seat: SeatState
      try {
        seat = addPlayerToRoom(room, payload.userId, payload.username, socket.id)
      } catch (e: any) {
        return emitRoomError(socket, e?.message ?? 'Failed to join room')
      }

      socket.emit('room:joined', {
        roomId: room.id,
        code: room.code,
        seat: seat.seat,
        mode: room.mode,
        maxPlayers: room.maxPlayers,
      })
      emitRoomState(room)
      console.log(`[room ${room.code}] ${payload.username} joined (seat ${seat.seat})`)
    },
  )

  // ── room:leave ──────────────────────────────────────────────────────────
  socket.on('room:leave', () => {
    const binding = sockets.get(socket.id)
    sockets.delete(socket.id)
    if (!binding) return
    const room = rooms.get(binding.roomId)
    if (!room) return
    const seat = room.seats.find((s) => s.socketId === socket.id)
    if (!seat) return

    seat.socketId = null
    if (room.gameState) {
      // Mid-game leave = forfeit.
      forfeitSeat(room, seat.seat)
    } else {
      removeSeat(room, seat.seat)
      emitRoomState(room)
    }
    console.log(`[room ${room.code}] ${seat.name} left`)
  })

  // ── room:ready ──────────────────────────────────────────────────────────
  socket.on('room:ready', () => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room) return
    if (room.gameState) return emitRoomError(socket, 'Game already started')
    const seat = room.seats.find((s) => s.socketId === socket.id)
    if (!seat || seat.isBot) return
    seat.ready = !seat.ready
    emitRoomState(room)
  })

  // ── room:add-bot ────────────────────────────────────────────────────────
  socket.on('room:add-bot', () => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room) return
    if (room.hostUserId !== binding.userId)
      return emitRoomError(socket, 'Only host can add bots')
    if (room.gameState) return emitRoomError(socket, 'Game already started')
    if (nextFreeSeat(room) === -1) return emitRoomError(socket, 'Room is full')
    const bot = addBotToRoom(room)
    if (!bot) return emitRoomError(socket, 'Failed to add bot')
    emitRoomState(room)
    console.log(`[room ${room.code}] bot ${bot.name} added (seat ${bot.seat})`)
  })

  // ── room:remove-bot ─────────────────────────────────────────────────────
  socket.on('room:remove-bot', () => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room) return
    if (room.hostUserId !== binding.userId)
      return emitRoomError(socket, 'Only host can remove bots')
    if (room.gameState) return emitRoomError(socket, 'Game already started')
    const removed = removeLastBot(room)
    if (!removed) return emitRoomError(socket, 'No bots to remove')
    emitRoomState(room)
    console.log(`[room ${room.code}] bot removed`)
  })

  // ── room:start ──────────────────────────────────────────────────────────
  socket.on('room:start', () => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room) return
    if (room.hostUserId !== binding.userId)
      return emitRoomError(socket, 'Only host can start')
    const result = startGame(room)
    if (!result.ok) return emitRoomError(socket, result.error ?? 'Cannot start game')
  })

  // ── game:roll ───────────────────────────────────────────────────────────
  socket.on('game:roll', () => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room || !room.gameState) return emitRoomError(socket, 'No active game')
    const seat = room.seats.find((s) => s.socketId === socket.id)
    if (!seat || seat.isBot) return emitRoomError(socket, 'Bots cannot be controlled')

    if (room.gameState.phase !== 'roll') return emitRoomError(socket, 'Cannot roll now')
    if (room.gameState.currentSeat !== seat.seat) {
      return emitRoomError(socket, 'Not your turn')
    }

    room.gameState = applyRoll(room.gameState)
    emitGameState(room)
    emitRoomState(room)

    if (room.gameState.phase === 'gameover') {
      endGame(room)
      return
    }
    scheduleBotTurn(room)
  })

  // ── game:move ───────────────────────────────────────────────────────────
  socket.on(
    'game:move',
    (payload: { tokenId: number; direction: 'forward' | 'backward' }) => {
      const binding = sockets.get(socket.id)
      if (!binding) return emitRoomError(socket, 'Not in a room')
      const room = rooms.get(binding.roomId)
      if (!room || !room.gameState) return emitRoomError(socket, 'No active game')
      const seat = room.seats.find((s) => s.socketId === socket.id)
      if (!seat || seat.isBot) return emitRoomError(socket, 'Bots cannot be controlled')

      if (!payload || typeof payload.tokenId !== 'number' || !payload.direction) {
        return emitRoomError(socket, 'Invalid move payload')
      }
      if (room.gameState.phase !== 'move') return emitRoomError(socket, 'Cannot move now')
      if (room.gameState.currentSeat !== seat.seat) {
        return emitRoomError(socket, 'Not your turn')
      }
      // Validate the move is legal.
      const legal = room.gameState.legalMoves.find(
        (m) => m.tokenId === payload.tokenId && m.direction === payload.direction,
      )
      if (!legal) return emitRoomError(socket, 'Illegal move')

      room.gameState = applyMove(room.gameState, payload.tokenId, payload.direction)
      emitGameState(room)
      emitRoomState(room)

      if (room.gameState.phase === 'gameover') {
        endGame(room)
        return
      }
      scheduleBotTurn(room)
    },
  )

  // ── game:forfeit ───────────────────────────────────────────────────────
  socket.on('game:forfeit', () => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room || !room.gameState) return emitRoomError(socket, 'No active game')
    const seat = room.seats.find((s) => s.socketId === socket.id)
    if (!seat || seat.isBot) return emitRoomError(socket, 'Bots cannot forfeit')
    if (seat.forfeited) return emitRoomError(socket, 'Already forfeited')
    forfeitSeat(room, seat.seat)
    sockets.delete(socket.id)
    console.log(`[room ${room.code}] ${seat.name} forfeited`)
  })

  // ── chat:message ────────────────────────────────────────────────────────
  socket.on('chat:message', (payload: { content: string }) => {
    const binding = sockets.get(socket.id)
    if (!binding) return emitRoomError(socket, 'Not in a room')
    const room = rooms.get(binding.roomId)
    if (!room) return
    const seat = room.seats.find((s) => s.socketId === socket.id)
    if (!seat) return
    const content = (payload?.content ?? '').toString().slice(0, 500).trim()
    if (!content) return
    const msg = {
      userId: binding.userId,
      username: seat.name,
      content,
      timestamp: Date.now(),
    }
    for (const s of room.seats) {
      if (s.socketId) io.to(s.socketId).emit('chat:message', msg)
    }
  })

  // ── disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`)
    handleDisconnect(socket)
  })

  socket.on('error', (err) => {
    console.error(`[socket] error (${socket.id}):`, err)
  })
})

function clampMaxPlayers(n?: number): number {
  if (!n || Number.isNaN(n)) return 4
  if (n < 2) return 2
  if (n > 6) return 6 // support 5 & 6 player games
  return Math.floor(n)
}

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log(`🎲 Ludo game-service (socket.io) running on port ${PORT}`)
  console.log(`   path: /   (client connects with io('/?XTransformPort=${PORT}', ...))`)
})

// Graceful shutdown
function shutdown() {
  console.log('\n[shutdown] closing game-service...')
  for (const room of rooms.values()) {
    clearBotTimer(room)
    clearDestroyTimer(room)
  }
  rooms.clear()
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
