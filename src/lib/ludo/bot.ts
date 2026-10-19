// Bot AI for Ludo. Heuristic-based: prioritizes finishing, capturing,
// escaping danger, releasing tokens; falls back to advancing the most
// progressed token. Backward moves are used to escape capture or chase a
// capturable opponent that's behind us (twist mode only).

import {
  GameState,
  LegalMove,
  colorOf,
  COLOR_START,
  progress,
  SAFE_SQUARES,
  isOnTrack,
} from './engine'

const BOT_NAMES = [
  'Bot Alpha',
  'Bot Beta',
  'Bot Gamma',
  'Bot Delta',
  'Bot Zeta',
  'Bot Kappa',
  'Bot Omega',
  'Bot Sigma',
]

export function randomBotName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]!
}

/// Estimate how dangerous each of `seat`'s tokens is (would an opponent be
/// able to capture it next turn?). Returns a map tokenId → danger score.
function dangerMap(state: GameState, seat: number): Map<number, number> {
  const danger = new Map<number, number>()
  for (const token of state.tokens) {
    if (token.seat !== seat) continue
    if (!isOnTrack(token.pos)) continue
    if (SAFE_SQUARES.has(token.pos)) continue
    // For each opponent token, check if it can land on us within 1..6 forward.
    let score = 0
    for (const other of state.tokens) {
      if (other.seat === seat) continue
      if (!isOnTrack(other.pos)) continue
      // distance from `other` to `token` along the ring (forward)
      const dist = (token.pos - other.pos + 52) % 52
      if (dist >= 1 && dist <= 6) score += 1
    }
    danger.set(state.tokens.indexOf(token), score)
  }
  return danger
}

/// Choose a move for the current seat.
export function chooseBotMove(state: GameState): LegalMove | null {
  const legal = state.legalMoves
  if (legal.length === 0) return null
  if (legal.length === 1) return legal[0]!

  const seat = state.currentSeat
  const danger = dangerMap(state, seat)

  // Score every legal move; pick the highest.
  let best: LegalMove = legal[0]!
  let bestScore = -Infinity

  for (const move of legal) {
    let score = 0

    // Finishing a token is huge.
    if (move.finishes) score += 1000

    // Capturing opponents is great — more captures = better.
    score += move.captures.length * 200

    // Releasing from base on a 6 is valuable early-game.
    if (move.releases) score += 80

    // Forward advancement is generally good.
    const fromProg = progress(move.fromPos, seat)
    const toProg = progress(move.toPos, seat)
    if (move.direction === 'forward') {
      score += (toProg - fromProg) * 2
    } else {
      // Backward move — only worth it if it captures or escapes danger.
      // Base penalty.
      score -= 10
      // Escaping danger: if the token was in danger and the move reduces it.
      const tokenDanger = danger.get(move.tokenId) ?? 0
      if (tokenDanger > 0) {
        // estimate danger reduction (rough)
        score += tokenDanger * 30
      }
      // Capturing via backward move is doubly valuable (surprise).
      if (move.captures.length > 0) score += 100
      // Moving to a safe square via backward is okay.
      if (isOnTrack(move.toPos) && SAFE_SQUARES.has(move.toPos)) score += 40
    }

    // Landing on a safe square reduces future danger.
    if (isOnTrack(move.toPos) && SAFE_SQUARES.has(move.toPos)) score += 15

    // If after the move the token would be in danger, penalize.
    // (Cheap check: only count forward-distance threats from opponents.)
    if (isOnTrack(move.toPos) && !SAFE_SQUARES.has(move.toPos)) {
      let postDanger = 0
      for (const other of state.tokens) {
        if (other.seat === seat) continue
        if (!isOnTrack(other.pos)) continue
        const dist = (move.toPos - other.pos + 52) % 52
        if (dist >= 1 && dist <= 6) postDanger += 1
      }
      score -= postDanger * 25
    }

    // Tiny tiebreaker: prefer the most-advanced token to push it home.
    score += fromProg * 0.5

    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }

  return best
}

/// Compute the think delay (ms) for a bot turn. Makes the game feel human.
export function botThinkDelay(): number {
  return 700 + Math.floor(Math.random() * 800)
}
