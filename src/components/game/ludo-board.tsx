'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Crown, Star } from 'lucide-react'
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
import { DirectionPicker } from './direction-picker'

interface LudoBoardProps {
  state: GameState
  mySeat: number | null
  onTokenClick: (tokenId: number, direction: 'forward' | 'backward') => void
  highlightLegal: boolean
}

// Arrow rotation (degrees) for the direction-of-travel chevron shown on each
// colored start square. Lucide's ArrowRight points right (0°) by default; we
// rotate it to match the track's clockwise flow at that start cell.
const START_ARROW_ROTATION: Record<Color, number> = {
  red: 270, // up (north) — track goes UP from (13,6)
  green: 0, // right (east) — track goes RIGHT from (6,0)
  yellow: 90, // down (south) — track goes DOWN from (0,8)
  blue: 180, // left (west) — track goes LEFT from (7,14)
  purple: 180, // left (west) — track goes LEFT from (8,5)
  orange: 0, // right (east) — track goes RIGHT from (6,9)
}

// ─── Cell-type lookup ────────────────────────────────────────────────────────

type CellInfo =
  | { kind: 'empty' }
  | { kind: 'track'; idx: number; isStart: boolean; color: Color | null; isStar: boolean }
  | { kind: 'home'; color: Color; pos: number }
  | { kind: 'center' }
  | { kind: 'base'; color: Color; dockIndex: number | null }

/// Look up what kind of cell a (row, col) is. Used to colour the cell.
/// NOTE: only the 4 standard on-board colors have home-column / base regions.
/// Purple & orange are rendered off-board (inside the PlayerCard).
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
  // Home columns — only the 4 on-board colors have them on the grid.
  for (const c of COLORS) {
    if (!isOnBoardColor(c)) continue
    const list = HOME_COLUMN_CELLS[c]
    if (!list) continue
    const idx = list.findIndex((cell) => cell.row === row && cell.col === col)
    if (idx >= 0) return { kind: 'home', color: c, pos: 100 + idx }
  }
  // Base regions — only the 4 on-board colors have them on the grid.
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
  dx: number // fractional cell offset (-1..1)
  dy: number
  scale: number
  z: number
  offBoard: boolean // true → skip grid render (purple/orange in base or home col)
}

/// Compute the cell + intra-cell offset for a token, given the whole token
/// array (so we can spread tokens that share a cell into a 2x2 grid, and
/// spread finished tokens into their colored triangle in the center).
function getTokenPlacement(token: Token, allTokens: Token[]): TokenPlacement {
  const rawCell: Cell | null = isInBase(token.pos)
    ? baseDockCell(token.seat, token.index)
    : posToCell(token.pos, token.seat)
  // Purple/orange token in base or home column → render off-board (PlayerCard
  // draws it). Track positions (0-51) and the center finish (pos=200) are
  // always on-grid for every color.
  if (!rawCell) {
    return { cell: { row: -1, col: -1 }, dx: 0, dy: 0, scale: 0, z: 0, offBoard: true }
  }
  const cell: Cell = rawCell

  // Finished tokens: cluster by color around their triangle of the center.
  if (isFinished(token.pos)) {
    const sameColorFinished = allTokens.filter(
      (t) => isFinished(t.pos) && t.seat === token.seat,
    )
    const idxInColor = sameColorFinished.findIndex((t) => t === token)
    const total = sameColorFinished.length
    const spread = (i: number) => (total <= 1 ? 0 : (i - (total - 1) / 2) * 0.18)
    const offsets: Record<Color, { dx: number; dy: number }> = {
      red: { dx: spread(idxInColor), dy: 0.24 }, // bottom triangle
      green: { dx: -0.24, dy: spread(idxInColor) }, // left triangle
      yellow: { dx: spread(idxInColor), dy: -0.24 }, // top triangle
      blue: { dx: 0.24, dy: spread(idxInColor) }, // right triangle
      purple: { dx: spread(idxInColor) - 0.18, dy: 0.18 }, // bottom-left-ish
      orange: { dx: spread(idxInColor) + 0.18, dy: -0.18 }, // top-right-ish
    }
    const o = offsets[COLORS[token.seat]!]
    return { cell, dx: o.dx, dy: o.dy, scale: 0.62, z: 20 + idxInColor, offBoard: false }
  }

  // Other tokens: if multiple share the same cell, arrange in a 2x2 grid.
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
          {/* 4 colored triangles meeting at the center */}
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 50% 50%)',
              background: 'var(--c-yellow)',
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(0 0, 0 100%, 50% 50%)',
              background: 'var(--c-green)',
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)',
              background: 'var(--c-red)',
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)',
              background: 'var(--c-blue)',
            }}
            aria-hidden
          />
          {/* Crown in the very center to signify the finish */}
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
            aria-label={`${info.color} start — safe square, direction of travel`}
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
      // Approach cells (pos 100..104) get a soft tint; the final home cell
      // (pos 105, adjacent to center) uses the full color for emphasis.
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

export function LudoBoard({
  state,
  mySeat,
  onTokenClick,
  highlightLegal,
}: LudoBoardProps) {
  const [pickerTokenId, setPickerTokenId] = useState<number | null>(null)

  // Cells
  const cells = useMemo(() => {
    const out: { row: number; col: number }[] = []
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        out.push({ row: r, col: c })
      }
    }
    return out
  }, [])

  // Map tokenId → legal moves (forward, backward, or both).
  const legalByToken = useMemo(() => {
    const map = new Map<number, { forward?: LegalMove; backward?: LegalMove }>()
    for (const m of state.legalMoves) {
      const entry = map.get(m.tokenId) ?? {}
      entry[m.direction] = m
      map.set(m.tokenId, entry)
    }
    return map
  }, [state.legalMoves])

  // Set of destination cells that should pulse-highlight. Off-board
  // destinations (purple/orange moving into home column) are skipped.
  const highlightCells = useMemo(() => {
    if (!highlightLegal) return new Set<string>()
    const set = new Set<string>()
    for (const m of state.legalMoves) {
      const cell = posToCell(m.toPos, state.currentSeat)
      if (cell) set.add(`${cell.row},${cell.col}`)
    }
    return set
  }, [state.legalMoves, state.currentSeat, highlightLegal])

  // Token placements. Index in `placements` == index in `state.tokens`.
  const placements = useMemo(
    () => state.tokens.map((t) => ({ token: t, p: getTokenPlacement(t, state.tokens) })),
    [state.tokens],
  )

  // Whether it's our turn (for token clickability + board glow).
  const isMyTurn = mySeat !== null && state.currentSeat === mySeat
  const canMove = isMyTurn && state.phase === 'move'
  const showTurnGlow = isMyTurn && (state.phase === 'move' || state.phase === 'roll')

  const handleTokenClick = (tokenId: number) => {
    if (!canMove) return
    const entry = legalByToken.get(tokenId)
    if (!entry) return
    if (entry.forward && entry.backward) {
      setPickerTokenId(tokenId)
      return
    }
    if (entry.forward) {
      onTokenClick(tokenId, 'forward')
      return
    }
    if (entry.backward) {
      onTokenClick(tokenId, 'backward')
      return
    }
  }

  return (
    <div
      className={cn(
        'relative mx-auto aspect-square w-full max-w-[min(95vw,600px)] rounded-xl border-2 border-slate-800 bg-white p-1 shadow-2xl select-none dark:border-slate-200/30 dark:bg-slate-900',
        showTurnGlow && 'animate-pulse ring-4 ring-emerald-400/40',
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
          const isHighlight = highlightCells.has(key)
          return (
            <div key={key} className="relative">
              <CellView row={row} col={col} />
              {isHighlight && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 animate-pulse rounded-sm ring-2 ring-emerald-400 ring-offset-1"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Tokens overlaid absolutely — skip off-board tokens */}
      {placements.map(({ token, p }, tokenId) => {
        if (p.offBoard) return null
        const top = ((p.cell.row + 0.5 + p.dy) / GRID) * 100
        const left = ((p.cell.col + 0.5 + p.dx) / GRID) * 100
        const isLegalToken = canMove && legalByToken.has(tokenId)
        const isCurrentSeatToken = token.seat === state.currentSeat
        const entry = legalByToken.get(tokenId)
        const showPicker = pickerTokenId === tokenId

        // Token size: ~70% of one cell, scaled by per-token scale (for sharing).
        const sizePct = (1 / GRID) * 70 * p.scale

        return (
          <motion.div
            key={`token-${token.seat}-${token.index}`}
            layout
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="absolute"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${sizePct}%`,
              height: `${sizePct}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: p.z,
            }}
          >
            {showPicker && entry?.forward && entry?.backward ? (
              <DirectionPicker
                open
                onOpenChange={(o) => !o && setPickerTokenId(null)}
                dice={state.dice ?? 0}
                forwardCaptures={entry.forward.captures.length}
                backwardCaptures={entry.backward.captures.length}
                onPick={(dir) => {
                  setPickerTokenId(null)
                  onTokenClick(tokenId, dir)
                }}
              >
                <span className="block size-full">
                  <TokenComponent
                    color={COLORS[token.seat]!}
                    tokenId={token.index}
                    isLegal={!!isLegalToken}
                    isCurrent={isCurrentSeatToken}
                  />
                </span>
              </DirectionPicker>
            ) : (
              <div className="size-full">
                <TokenComponent
                  color={COLORS[token.seat]!}
                  tokenId={token.index}
                  isLegal={!!isLegalToken}
                  isCurrent={isCurrentSeatToken}
                  onClick={isLegalToken ? () => handleTokenClick(tokenId) : undefined}
                />
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

export default LudoBoard
