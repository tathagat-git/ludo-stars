// Ludo game engine - core rules, including the custom "twist" mode where
// tokens on the track can move BACKWARD by the dice value, bounded by
// their own start square.
//
// Shared between:
//   - the websocket game-service mini-service (server authority)
//   - the Next.js API routes (lobby / history persistence)
//   - the React board UI (read-only state + rendering helpers)
//
// Position encoding (single integer, easy to serialize):
//   -1            : in base (not yet released)
//   0..51         : on the main track (absolute track index)
//   100..105      : in this token's home column (100 = first cell, 105 = center)
//   200           : finished (reached center). POS_FINISHED.
// Special:
//   -999          : "invalid move" sentinel returned by moveForward when a
//                   forward move would overshoot the finish.

export type Color = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange'

// Seats 0..3 use the standard 4 colors (corner bases on the 15x15 board).
// Seats 4 & 5 (purple, orange) are the extra colors for 5-6 player games;
// their bases + home columns render as off-board strips beside the board
// (see board.ts + PlayerCard), but they share the same 52-cell track.
export const COLORS: Color[] = ['red', 'green', 'yellow', 'blue', 'purple', 'orange']

// Start positions on the 52-cell track (clockwise).
//   red=0, green=13, yellow=26, blue=39  → every 13 (standard 4-color Ludo).
//   purple=6   (between red and green)
//   orange=32  (between yellow and blue)
export const COLOR_START: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
  purple: 6,
  orange: 32,
}

// Home entry = the square just before the start square (going clockwise).
// Moving forward from homeEntry enters the home column.
export const HOME_ENTRY: Record<Color, number> = {
  red: 51,
  green: 12,
  yellow: 25,
  blue: 38,
  purple: 5,
  orange: 31,
}

// Safe squares: the 4 standard start squares + 4 star squares + the 2 extra
// color start squares (purple & orange) for 5-6 player games.
export const SAFE_SQUARES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47, 6, 32])

export const POS_BASE = -1
export const POS_FINISHED = 200
export const INVALID_MOVE = -999
// Home column: 5 approach cells (100..104) + 1 center cell (105 = finish).
export const HOME_COLUMN_LENGTH = 6

export interface Token {
  seat: number // 0..3, matches COLORS index
  index: number // 0..3, which of the 4 tokens for this seat
  pos: number // encoded position (see above)
}

export interface Player {
  seat: number
  userId: string | null // null for bots
  isBot: boolean
  botName?: string
  name: string // display name (username or bot name)
  color: Color
  finishedAt?: number // timestamp when this seat finished (used for ranking)
  rank?: number // 1-based finish rank
}

export type TurnPhase = 'roll' | 'move' | 'gameover'

export interface GameState {
  gameId: string
  mode: 'classic' | 'twist' // twist = backward moves allowed
  maxPlayers: number // 2 | 3 | 4 | 5 | 6
  players: Player[]
  tokens: Token[] // length = maxPlayers * 4
  currentSeat: number
  phase: TurnPhase
  dice: number | null // last rolled value
  consecutiveSixes: number
  legalMoves: LegalMove[] // pre-computed on roll for current seat
  winners: number[] // seats ordered by finish rank
  lastEvent?: GameEvent
  turnStartedAt: number
}

export interface LegalMove {
  tokenId: number // index into tokens array
  direction: 'forward' | 'backward'
  fromPos: number
  toPos: number
  captures: number[] // token indices captured by this move
  releases: boolean // true if this releases a token from base
  finishes: boolean // true if this move finishes the token
}

export type GameEvent =
  | { type: 'roll'; seat: number; dice: number }
  | {
      type: 'move'
      seat: number
      tokenId: number
      direction: 'forward' | 'backward'
      fromPos: number
      toPos: number
      captures: number[]
      finishes: boolean
    }
  | { type: 'pass'; seat: number; reason: 'no-moves' | 'three-sixes' }
  | { type: 'finish'; seat: number; rank: number }
  | { type: 'gameover'; winners: number[] }
  | { type: 'turn'; seat: number }
  | { type: 'capture'; bySeat: number; victimSeat: number; tokenId: number }

// ─── Position helpers ───────────────────────────────────────────────────────

export function colorOf(seat: number): Color {
  return COLORS[seat]!
}

export function isOnTrack(pos: number): boolean {
  return pos >= 0 && pos <= 51
}

export function isInBase(pos: number): boolean {
  return pos === POS_BASE
}

export function isInHomeColumn(pos: number): boolean {
  return pos >= 100 && pos <= 105
}

export function isFinished(pos: number): boolean {
  return pos === POS_FINISHED
}

export function isOnBoard(pos: number): boolean {
  return isOnTrack(pos) || isInHomeColumn(pos)
}

/// Normalized progress: 0 at start square, 51 at home-entry, 52..57 inside
/// home column, 57 = finished. Used for ranking advancement and bot heuristics.
export function progress(pos: number, seat: number): number {
  if (isInBase(pos)) return -1
  if (isFinished(pos)) return 57
  const color = colorOf(seat)
  const start = COLOR_START[color]
  if (isOnTrack(pos)) {
    return (pos - start + 52) % 52
  }
  // home column
  return 52 + (pos - 100)
}

// ─── Movement math ──────────────────────────────────────────────────────────

function nextCellForward(pos: number, seat: number): number {
  const color = colorOf(seat)
  const homeEntry = HOME_ENTRY[color]
  if (isOnTrack(pos)) {
    if (pos === homeEntry) return 100 // enter home column
    return (pos + 1) % 52
  }
  if (isInHomeColumn(pos)) {
    if (pos === 105) return POS_FINISHED // center cell → finish
    return pos + 1
  }
  return pos
}

function nextCellBackward(pos: number, seat: number): number {
  if (isInHomeColumn(pos)) {
    // backward inside home column allowed back to the track homeEntry
    if (pos === 100) return HOME_ENTRY[colorOf(seat)]
    return pos - 1
  }
  if (isOnTrack(pos)) {
    const start = COLOR_START[colorOf(seat)]
    if (pos === start) return start // cannot go below own start square
    const candidate = (pos - 1 + 52) % 52
    // detect wrap-around past the start square via progress monotonicity
    const beforeProgress = progress(pos, seat)
    const afterProgress = progress(candidate, seat)
    if (afterProgress > beforeProgress) {
      return start // wrapped around the ring → clamp at start square
    }
    return candidate
  }
  return pos
}

export function moveForward(pos: number, steps: number, seat: number): number {
  let p = pos
  for (let i = 0; i < steps; i++) {
    if (p === POS_FINISHED) return INVALID_MOVE // already finished, can't move
    p = nextCellForward(p, seat)
    if (p === POS_FINISHED) {
      // reached finish; valid only if this is the last step (exact landing)
      if (i < steps - 1) return INVALID_MOVE // overshoot
      return POS_FINISHED
    }
  }
  return p
}

export function moveBackward(pos: number, steps: number, seat: number): number {
  let p = pos
  for (let i = 0; i < steps; i++) {
    const next = nextCellBackward(p, seat)
    if (next === p) break // hit the floor (own start square)
    p = next
  }
  return p
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export function createInitialState(
  gameId: string,
  mode: 'classic' | 'twist',
  maxPlayers: number,
  players: Player[],
): GameState {
  const tokens: Token[] = []
  for (let s = 0; s < maxPlayers; s++) {
    for (let i = 0; i < 4; i++) {
      tokens.push({ seat: s, index: i, pos: POS_BASE })
    }
  }
  return {
    gameId,
    mode,
    maxPlayers,
    players,
    tokens,
    currentSeat: 0,
    phase: 'roll',
    dice: null,
    consecutiveSixes: 0,
    legalMoves: [],
    winners: [],
    turnStartedAt: Date.now(),
  }
}

export function tokensForSeat(state: GameState, seat: number): Token[] {
  return state.tokens.filter((t) => t.seat === seat)
}

export function tokenById(state: GameState, tokenId: number): Token {
  return state.tokens[tokenId]!
}

/// Compute the set of legal moves for `seat` given `dice`.
/// In 'twist' mode, tokens on the track may also move BACKWARD by `dice`,
/// bounded by their own start square.
export function computeLegalMoves(
  state: GameState,
  seat: number,
  dice: number,
): LegalMove[] {
  const moves: LegalMove[] = []
  const tokens = tokensForSeat(state, seat)
  const isTwist = state.mode === 'twist'

  for (const token of tokens) {
    const tokenId = state.tokens.indexOf(token)

    // ── Release from base (only on a 6) ──
    if (isInBase(token.pos)) {
      if (dice === 6) {
        const startCell = COLOR_START[colorOf(seat)]
        const captures = capturedByLandingOn(state, seat, startCell)
        moves.push({
          tokenId,
          direction: 'forward',
          fromPos: token.pos,
          toPos: startCell,
          captures,
          releases: true,
          finishes: false,
        })
      }
      continue
    }

    if (isFinished(token.pos)) continue

    // ── Forward move ──
    {
      const to = moveForward(token.pos, dice, seat)
      if (to !== INVALID_MOVE && to !== token.pos) {
        let captures: number[] = []
        let finishes = false
        if (isFinished(to)) {
          finishes = true
        } else if (isOnTrack(to)) {
          captures = capturedByLandingOn(state, seat, to)
        }
        moves.push({
          tokenId,
          direction: 'forward',
          fromPos: token.pos,
          toPos: to,
          captures,
          releases: false,
          finishes,
        })
      }
    }

    // ── Backward move (twist mode only) ──
    // Allowed only when the token is on the main track or in the home column
    // (so you can retreat from the home column back to the track).
    // The token cannot go below its own start square.
    if (isTwist && (isOnTrack(token.pos) || isInHomeColumn(token.pos))) {
      const to = moveBackward(token.pos, dice, seat)
      if (to !== token.pos) {
        let captures: number[] = []
        if (isOnTrack(to)) {
          captures = capturedByLandingOn(state, seat, to)
        }
        moves.push({
          tokenId,
          direction: 'backward',
          fromPos: token.pos,
          toPos: to,
          captures,
          releases: false,
          finishes: false,
        })
      }
    }
  }

  return moves
}

/// Tokens of other seats that occupy `cell` on the main track and would be
/// captured by `seat` landing there. Returns token indices.
function capturedByLandingOn(state: GameState, seat: number, cell: number): number[] {
  if (!isOnTrack(cell)) return []
  if (SAFE_SQUARES.has(cell)) return [] // no captures on safe squares
  const captured: number[] = []
  state.tokens.forEach((t, idx) => {
    if (t.seat !== seat && t.pos === cell) {
      captured.push(idx)
    }
  })
  return captured
}

/// Cryptographically fair dice roll. Uses `crypto.getRandomValues` when
/// available (browser + Node 19+) with rejection sampling for a perfectly
/// uniform 1..6 distribution (no modulo bias). Falls back to `Math.random`
/// in environments without crypto. Neither path favors any player — both are
/// uniform random.
export function rollDice(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(1)
    // Rejection sampling: 256 % 6 != 0, so we reject values >= 252 to keep
    // a perfectly uniform distribution (252 = 42*6, so 0..251 maps evenly).
    let r: number
    do {
      crypto.getRandomValues(buf)
      r = buf[0]!
    } while (r >= 252)
    return 1 + (r % 6)
  }
  return 1 + Math.floor(Math.random() * 6)
}

/// Apply a dice roll for the current seat. Sets `dice`, computes legal
/// moves. If no legal moves exist, automatically passes the turn.
export function applyRoll(state: GameState, dice?: number): GameState {
  if (state.phase !== 'roll') return state
  const value = dice ?? rollDice()
  const next: GameState = {
    ...state,
    dice: value,
    consecutiveSixes: value === 6 ? state.consecutiveSixes + 1 : 0,
    legalMoves: [],
    lastEvent: { type: 'roll', seat: state.currentSeat, dice: value },
  }

  // Three sixes in a row → pass turn (classic rule).
  if (next.consecutiveSixes >= 3) {
    return passTurn(next, 'three-sixes')
  }

  const legal = computeLegalMoves(next, next.currentSeat, value)
  next.legalMoves = legal

  if (legal.length === 0) {
    return passTurn(next, 'no-moves')
  }

  next.phase = 'move'
  return next
}

/// Apply a chosen legal move. Returns the new state with captures, finishes
/// and turn advancement handled. Auto-rolls again if dice was 6 (and not
/// a finish of all tokens).
export function applyMove(
  state: GameState,
  tokenId: number,
  direction: 'forward' | 'backward',
): GameState {
  if (state.phase !== 'move') return state
  const move = state.legalMoves.find(
    (m) => m.tokenId === tokenId && m.direction === direction,
  )
  if (!move) return state

  const tokens = state.tokens.slice()
  tokens[tokenId] = { ...tokens[tokenId]!, pos: move.toPos }

  // Send captured tokens back to base.
  for (const capIdx of move.captures) {
    tokens[capIdx] = { ...tokens[capIdx]!, pos: POS_BASE }
  }

  let next: GameState = {
    ...state,
    tokens,
    legalMoves: [],
    lastEvent: {
      type: 'move',
      seat: state.currentSeat,
      tokenId,
      direction,
      fromPos: move.fromPos,
      toPos: move.toPos,
      captures: move.captures,
      finishes: move.finishes,
    },
  }

  // ── Check seat finish ──
  const seatTokens = tokens.filter((t) => t.seat === state.currentSeat)
  if (seatTokens.every((t) => isFinished(t.pos))) {
    const rank = next.winners.length + 1
    next = {
      ...next,
      players: next.players.map((p) =>
        p.seat === state.currentSeat ? { ...p, finishedAt: Date.now(), rank } : p,
      ),
      winners: [...next.winners, state.currentSeat],
      lastEvent: { type: 'finish', seat: state.currentSeat, rank },
    }
  }

  // ── Game over? ──
  // Game ends when only one seat has not finished (the last player is the loser).
  const remainingSeats = state.players.filter((p) => !next.winners.includes(p.seat))
  if (remainingSeats.length <= 1 && next.winners.length >= state.maxPlayers - 1) {
    next = {
      ...next,
      phase: 'gameover',
      lastEvent: { type: 'gameover', winners: next.winners },
    }
    return next
  }

  // ── Another roll on a 6 (unless the seat just finished). ──
  const justFinishedSeat = next.winners.includes(state.currentSeat)
  if (state.dice === 6 && !justFinishedSeat) {
    next.phase = 'roll'
    next.dice = null
    return next
  }

  return passTurn(next)
}

/// Pass turn to the next non-finished seat (in seat order, wrapping).
export function passTurn(
  state: GameState,
  reason?: 'no-moves' | 'three-sixes',
): GameState {
  let nextSeat = state.currentSeat
  for (let i = 0; i < state.maxPlayers; i++) {
    nextSeat = (nextSeat + 1) % state.maxPlayers
    if (!state.winners.includes(nextSeat)) break
  }
  return {
    ...state,
    currentSeat: nextSeat,
    phase: 'roll',
    dice: null,
    legalMoves: [],
    consecutiveSixes: 0,
    turnStartedAt: Date.now(),
    lastEvent: reason
      ? { type: 'pass', seat: state.currentSeat, reason }
      : { type: 'turn', seat: nextSeat },
  }
}

/// Is it this seat's turn?
export function isTurn(state: GameState, seat: number): boolean {
  return state.currentSeat === seat && state.phase !== 'gameover'
}
