'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUp, Crown, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HOME_COLUMN_CELLS,
  BASE_DOCKS,
  BASE_REGIONS,
  CENTER_CELL,
  STAR_CELLS,
  COLOR_BG,
  COLOR_BG_SOFT,
  isOnBoardColor,
  posToCell,
  baseDockCell,
  cellToTrackIndex,
  type Cell,
} from '@/lib/ludo/board'
import {
  COLORS,
  COLOR_START,
  isInBase,
  isFinished,
  type Color,
  type GameState,
  type Token,
  type LegalMove,
} from '@/lib/ludo/engine'
import { Token as TokenComponent } from './token'

interface LudoBoardProps {
  state: GameState
  mySeat: number | null
  onTokenClick: (tokenId: number, direction: 'forward' | 'backward') => void
  highlightLegal: boolean
}

// Arrow rotation (degrees) for the direction-of-travel chevron on each colored
// start square. Points along the track's clockwise flow.
const START_ARROW_ROTATION: Record<Color, number> = {
  red: 270, // up
  green: 0, // right
  yellow: 90, // down
  blue: 180, // left
  purple: 180,
  orange: 0,
}

// ─── Cell-type lookup ────────────────────────────────────────────────────────

type CellInfo =
  | { kind: 'empty' }
  | { kind: 'track'; idx: number; isStart: boolean; color: Color | null; isStar: boolean }
  | { kind: 'home'; color: Color; pos: number }
  | { kind: 'center' }
  | { kind: 'base'; color: Color; dockIndex: number | null }

function getCellInfo(row: number, col: number): CellInfo {
  if (row === CENTER_CELL.row && col === CENTER_CELL.col) {
    return { kind: 'center' }
  }
  const trackIdx = cellToTrackIndex(row, col)
  if (trackIdx !== null) {
    const isStart = COLORS.some((c) => COLOR_START[c] === trackIdx)
    const color = isStart ? COLORS.find((c) => COLOR_START[c] === trackIdx)! : null
    const isStar = STAR_CELLS.some((c) => c.row === row && c.col === col)
    return { kind: 'track', idx: trackIdx, isStart, color, isStar }
  }
  for (const c of COLORS) {
    if (!isOnBoardColor(c)) continue
    const list = HOME_COLUMN_CELLS[c]
    if (!list) continue
    const idx = list.findIndex((cell) => cell.row === row && cell.col === col)
    if (idx >= 0) return { kind: 'home', color: c, pos: 100 + idx }
  }
  for (const c of COLORS) {
    if (!isOnBoardColor(c)) continue
    const region = BASE_REGIONS[c]
    if (!region) continue
    if (
      row >= region.row - 2 &&
      row <= region.row + 2 &&
      col >= region.col - 2 &&
      col <= region.col + 2
    ) {
      const docks = BASE_DOCKS[c]
      const dockIdx = docks.findIndex((d) => d.row === row && d.col === col)
      return { kind: 'base', color: c, dockIndex: dockIdx >= 0 ? dockIdx : null }
    }
  }
  return { kind: 'empty' }
}

// ─── Token placement ────────────────────────────────────────────────────────

interface TokenPlacement {
  cell: Cell
  dx: number
  dy: number
  scale: number
  z: number
  offBoard: boolean
}

function getTokenPlacement(token: Token, allTokens: Token[]): TokenPlacement {
  const rawCell: Cell | null = isInBase(token.pos)
    ? baseDockCell(token.seat, token.index)
    : posToCell(token.pos, token.seat)
  if (!rawCell) {
    return { cell: { row: -1, col: -1 }, dx: 0, dy: 0, scale: 0, z: 0, offBoard: true }
  }
  const cell: Cell = rawCell

  if (isFinished(token.pos)) {
    const sameColorFinished = allTokens.filter(
      (t) => isFinished(t.pos) && t.seat === token.seat,
    )
    const idxInColor = sameColorFinished.findIndex((t) => t === token)
    const total = sameColorFinished.length
    const spread = (i: number) => (total <= 1 ? 0 : (i - (total - 1) / 2) * 0.18)
    const offsets: Record<Color, { dx: number; dy: number }> = {
      red: { dx: spread(idxInColor), dy: 0.24 },
      green: { dx: -0.24, dy: spread(idxInColor) },
      yellow: { dx: spread(idxInColor), dy: -0.24 },
      blue: { dx: 0.24, dy: spread(idxInColor) },
      purple: { dx: spread(idxInColor) - 0.18, dy: 0.18 },
      orange: { dx: spread(idxInColor) + 0.18, dy: -0.18 },
    }
    const o = offsets[COLORS[token.seat]!]
    return { cell, dx: o.dx, dy: o.dy, scale: 0.62, z: 20 + idxInColor, offBoard: false }
  }

  const sameCell = allTokens.filter((t) => {
    const tCell = isInBase(t.pos)
      ? baseDockCell(t.seat, t.index)
      : posToCell(t.pos, t.seat)
    return !!tCell && tCell.row === cell.row && tCell.col === cell.col
  })
  const idxInCell = sameCell.findIndex((t) => t === token)
  if (sameCell.length <= 1) {
    return { cell, dx: 0, dy: 0, scale: 1, z: 10, offBoard: false }
  }
  const positions = [
    { dx: -0.22, dy: -0.22 },
    { dx: 0.22, dy: -0.22 },
    { dx: -0.22, dy: 0.22 },
    { dx: 0.22, dy: 0.22 },
  ]
  const p = positions[idxInCell % 4]!
  const scale = sameCell.length === 2 ? 0.78 : 0.62
  return { cell, dx: p.dx, dy: p.dy, scale, z: 10 + idxInCell, offBoard: false }
}

// ─── Cell render ────────────────────────────────────────────────────────────

function CellView({ row, col }: { row: number; col: number }) {
  const info = getCellInfo(row, col)

  switch (info.kind) {
    case 'center':
      return (
        <div className="relative aspect-square overflow-hidden border border-slate-800 bg-white dark:border-slate-200/40 dark:bg-slate-900">
          <div
            className="absolute inset-0"
            style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)', background: 'var(--c-yellow)' }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{ clipPath: 'polygon(0 0, 0 100%, 50% 50%)', background: 'var(--c-green)' }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)', background: 'var(--c-red)' }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)', background: 'var(--c-blue)' }}
            aria-hidden
          />
          <div className="absolute inset-0 grid place-items-center" aria-hidden>
            <Crown className="size-3/5 text-amber-500 drop-shadow" strokeWidth={2.5} />
          </div>
        </div>
      )

    case 'track':
      if (info.isStart && info.color) {
        const rotation = START_ARROW_ROTATION[info.color]
        return (
          <div
            className={cn(
              'relative aspect-square border border-slate-200 dark:border-slate-700',
              COLOR_BG[info.color],
            )}
            aria-label={`${info.color} start — safe square`}
          >
            <ArrowRight
              className="absolute inset-0 m-auto size-3/5 text-white drop-shadow"
              style={{ transform: `rotate(${rotation}deg)` }}
              strokeWidth={3.5}
              aria-hidden
            />
          </div>
        )
      }
      if (info.isStar) {
        return (
          <div className="relative aspect-square border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <Star
              className="absolute inset-0 m-auto size-3/5 text-emerald-500/70"
              strokeWidth={2}
              aria-label="safe square"
            />
          </div>
        )
      }
      return (
        <div className="aspect-square border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
      )

    case 'home': {
      const isLastCell = info.pos === 105
      return (
        <div
          className={cn(
            'aspect-square border border-slate-200 dark:border-slate-700',
            isLastCell ? COLOR_BG[info.color] : COLOR_BG_SOFT[info.color],
          )}
        />
      )
    }

    case 'base':
      return (
        <div
          className={cn(
            'relative aspect-square border border-white/60',
            COLOR_BG[info.color],
          )}
        >
          {info.dockIndex !== null && (
            <div
              className="absolute inset-[18%] rounded-full border-2 border-white/80 bg-white/40"
              aria-hidden
            />
          )}
        </div>
      )

    case 'empty':
    default:
      return <div className="bg-muted/30 aspect-square" />
  }
}

// ─── Board ──────────────────────────────────────────────────────────────────

const GRID = 15

export function LudoBoard({ state, mySeat, onTokenClick, highlightLegal }: LudoBoardProps) {
  // Map destination cell "row,col" → legal moves (one or two per cell).
  const movesByCell = useMemo(() => {
    const map = new Map<string, LegalMove[]>()
    if (!highlightLegal) return map
    for (const m of state.legalMoves) {
      const cell = posToCell(m.toPos, state.currentSeat)
      if (!cell) continue
      const key = `${cell.row},${cell.col}`
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return map
  }, [state.legalMoves, state.currentSeat, highlightLegal])

  // Set of token IDs that have a legal move (to highlight movable tokens).
  const movableTokens = useMemo(() => {
    const set = new Set<number>()
    for (const m of state.legalMoves) set.add(m.tokenId)
    return set
  }, [state.legalMoves])

  const cells = useMemo(() => {
    const out: { row: number; col: number }[] = []
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        out.push({ row: r, col: c })
      }
    }
    return out
  }, [])

  const placements = useMemo(
    () => state.tokens.map((t) => ({ token: t, p: getTokenPlacement(t, state.tokens) })),
    [state.tokens],
  )

  const isMyTurn = mySeat !== null && state.currentSeat === mySeat
  const canMove = isMyTurn && state.phase === 'move'
  const showTurnGlow = isMyTurn && (state.phase === 'move' || state.phase === 'roll')

  // Click handler for a destination cell. If only one move targets it,
  // execute it. If two (forward + backward to the same cell), prefer forward.
  const handleCellClick = (moves: LegalMove[]) => {
    if (!canMove || moves.length === 0) return
    const fwd = moves.find((m) => m.direction === 'forward')
    const pick = fwd ?? moves[0]!
    onTokenClick(pick.tokenId, pick.direction)
  }

  return (
    <div
      className={cn(
        'relative mx-auto aspect-square w-full max-w-[min(95vw,600px)] rounded-xl border-2 border-slate-800 bg-white p-1 shadow-2xl select-none transition-shadow dark:border-slate-200/30 dark:bg-slate-900',
        // Subtle steady glow on the player's turn — no aggressive pulsing.
        showTurnGlow && 'shadow-emerald-400/30 ring-2 ring-emerald-400/40',
      )}
      role="grid"
      aria-label="Ludo board"
      style={
        {
          '--c-red': '#ef4444',
          '--c-green': '#22c55e',
          '--c-yellow': '#facc15',
          '--c-blue': '#3b82f6',
        } as React.CSSProperties
      }
    >
      {/* 15x15 grid of cells */}
      <div
        className="grid h-full w-full overflow-hidden rounded-lg ring-1 ring-slate-700/40 dark:ring-slate-300/20"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID}, 1fr)`,
          gridTemplateRows: `repeat(${GRID}, 1fr)`,
        }}
      >
        {cells.map(({ row, col }) => {
          const key = `${row},${col}`
          const moves = movesByCell.get(key)
          const isClickable = canMove && !!moves && moves.length > 0
          return (
            <div key={key} className="relative">
              <CellView row={row} col={col} />
              {isClickable && moves && (
                <button
                  type="button"
                  onClick={() => handleCellClick(moves)}
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-sm border-2 border-emerald-400 bg-emerald-400/20 transition-colors hover:bg-emerald-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={`Move token ${moves[0]!.direction} here`}
                >
                  <DirectionArrow moves={moves} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Tokens overlaid absolutely — skip off-board tokens. Tokens are NOT
          clickable anymore; the player clicks destination cells instead. */}
      {placements.map(({ token, p }, tokenId) => {
        if (p.offBoard) return null
        const top = ((p.cell.row + 0.5 + p.dy) / GRID) * 100
        const left = ((p.cell.col + 0.5 + p.dx) / GRID) * 100
        const isMovable = canMove && movableTokens.has(tokenId)
        const isCurrentSeatToken = token.seat === state.currentSeat
        const sizePct = (1 / GRID) * 70 * p.scale

        return (
          <motion.div
            key={`token-${token.seat}-${token.index}`}
            layout
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className={cn(
              'absolute pointer-events-none',
              isMovable && 'pointer-events-auto',
            )}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${sizePct}%`,
              height: `${sizePct}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: p.z,
            }}
          >
            <div className="size-full">
              <TokenComponent
                color={COLORS[token.seat]!}
                tokenId={token.index}
                isLegal={isMovable}
                isCurrent={isCurrentSeatToken}
                // No onClick — tokens are not clickable. Destination cells are.
              />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Direction arrow overlay (shown inside clickable destination cells) ──────

function DirectionArrow({ moves }: { moves: LegalMove[] }) {
  const fwd = moves.find((m) => m.direction === 'forward')
  const bwd = moves.find((m) => m.direction === 'backward')
  if (fwd && bwd) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <ArrowUp className="size-3 text-emerald-700" strokeWidth={3} />
        <ArrowDown className="size-3 text-amber-700" strokeWidth={3} />
      </div>
    )
  }
  if (fwd) {
    return <ArrowUp className="size-1/2 text-emerald-700" strokeWidth={3} aria-hidden />
  }
  if (bwd) {
    return <ArrowDown className="size-1/2 text-amber-700" strokeWidth={3} aria-hidden />
  }
  return null
}

export default LudoBoard