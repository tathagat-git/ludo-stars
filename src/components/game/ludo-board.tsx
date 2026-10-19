'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HOME_COLUMN_CELLS,
  BASE_DOCKS,
  BASE_REGIONS,
  CENTER_CELL,
  STAR_CELLS,
  COLOR_BG,
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

// ─── Cell-type lookup ────────────────────────────────────────────────────────

type CellInfo =
  | { kind: 'empty' }
  | { kind: 'track'; idx: number; isStart: boolean; color: Color | null; isStar: boolean }
  | { kind: 'home'; color: Color; pos: number }
  | { kind: 'center' }
  | { kind: 'base'; color: Color; dockIndex: number | null }

/// Look up what kind of cell a (row, col) is. Used to colour the cell.
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
    const idx = HOME_COLUMN_CELLS[c].findIndex((cell) => cell.row === row && cell.col === col)
    if (idx >= 0) return { kind: 'home', color: c, pos: 100 + idx }
  }
  for (const c of COLORS) {
    const region = BASE_REGIONS[c]
    // 5x5 base region around the center.
    if (
      row >= region.row - 2 && row <= region.row + 2 &&
      col >= region.col - 2 && col <= region.col + 2
    ) {
      const dockIdx = BASE_DOCKS[c].findIndex((d) => d.row === row && d.col === col)
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
}

/// Compute the cell + intra-cell offset for a token, given the whole token
/// array (so we can spread tokens that share a cell into a 2x2 grid, and
/// spread finished tokens into their colored triangle in the center).
function getTokenPlacement(token: Token, allTokens: Token[]): TokenPlacement {
  let cell: Cell
  if (isInBase(token.pos)) {
    cell = baseDockCell(token.seat, token.index)
  } else {
    cell = posToCell(token.pos, token.seat)
  }

  // Finished tokens: cluster by color around their triangle of the center.
  if (isFinished(token.pos)) {
    const sameColorFinished = allTokens.filter(
      (t) => isFinished(t.pos) && t.seat === token.seat,
    )
    const idxInColor = sameColorFinished.findIndex((t) => t === token)
    const total = sameColorFinished.length
    const spread = (i: number) => (total <= 1 ? 0 : (i - (total - 1) / 2) * 0.22)
    const offsets: Record<Color, { dx: number; dy: number }> = {
      red: { dx: spread(idxInColor), dy: 0.22 }, // bottom triangle
      green: { dx: -0.22, dy: spread(idxInColor) }, // left triangle
      yellow: { dx: spread(idxInColor), dy: -0.22 }, // top triangle
      blue: { dx: 0.22, dy: spread(idxInColor) }, // right triangle
    }
    const o = offsets[COLORS[token.seat]!]
    return { cell, dx: o.dx, dy: o.dy, scale: 0.62, z: 20 + idxInColor }
  }

  // Other tokens: if multiple share the same cell, arrange in a 2x2 grid.
  const sameCell = allTokens.filter((t) => {
    const tCell = isInBase(t.pos)
      ? baseDockCell(t.seat, t.index)
      : posToCell(t.pos, t.seat)
    return tCell.row === cell.row && tCell.col === cell.col
  })
  const idxInCell = sameCell.findIndex((t) => t === token)
  if (sameCell.length <= 1) {
    return { cell, dx: 0, dy: 0, scale: 1, z: 10 }
  }
  const positions = [
    { dx: -0.22, dy: -0.22 },
    { dx: 0.22, dy: -0.22 },
    { dx: -0.22, dy: 0.22 },
    { dx: 0.22, dy: 0.22 },
  ]
  const p = positions[idxInCell % 4]!
  const scale = sameCell.length === 2 ? 0.78 : 0.62
  return { cell, dx: p.dx, dy: p.dy, scale, z: 10 + idxInCell }
}

// ─── Cell render ────────────────────────────────────────────────────────────

function CellView({ row, col }: { row: number; col: number }) {
  const info = getCellInfo(row, col)

  switch (info.kind) {
    case 'center':
      return (
        <div className="relative aspect-square overflow-hidden border border-border bg-white">
          {/* 4 colored triangles meeting at the center */}
          <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)', background: 'var(--c-yellow)' }} aria-hidden />
          <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 0 100%, 50% 50%)', background: 'var(--c-green)' }} aria-hidden />
          <div className="absolute inset-0" style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)', background: 'var(--c-red)' }} aria-hidden />
          <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)', background: 'var(--c-blue)' }} aria-hidden />
        </div>
      )

    case 'track':
      if (info.isStart && info.color) {
        return (
          <div className={cn('aspect-square border border-border', COLOR_BG[info.color])} />
        )
      }
      if (info.isStar) {
        return (
          <div className="relative aspect-square border border-border bg-white">
            <Star className="absolute inset-0 m-auto size-3/5 text-emerald-500/70" strokeWidth={2} aria-label="safe square" />
          </div>
        )
      }
      return <div className="aspect-square border border-border bg-white" />

    case 'home':
      return <div className={cn('aspect-square border border-border', COLOR_BG[info.color])} />

    case 'base':
      return (
        <div className={cn('relative aspect-square border border-border/50', COLOR_BG[info.color])}>
          {info.dockIndex !== null && (
            <div className="absolute inset-[18%] rounded-full border-2 border-white/70 bg-white/30" aria-hidden />
          )}
        </div>
      )

    case 'empty':
    default:
      return <div className="aspect-square bg-muted/30" />
  }
}

// ─── Board ──────────────────────────────────────────────────────────────────

const GRID = 15

export function LudoBoard({ state, mySeat, onTokenClick, highlightLegal }: LudoBoardProps) {
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

  // Set of destination cells that should pulse-highlight.
  const highlightCells = useMemo(() => {
    if (!highlightLegal) return new Set<string>()
    const set = new Set<string>()
    for (const m of state.legalMoves) {
      const cell = posToCell(m.toPos, state.currentSeat)
      set.add(`${cell.row},${cell.col}`)
    }
    return set
  }, [state.legalMoves, state.currentSeat, highlightLegal])

  // Token placements.
  const placements = useMemo(() => {
    return state.tokens.map((t) => ({ token: t, p: getTokenPlacement(t, state.tokens) }))
  }, [state.tokens])

  // Whether it's our turn (for token clickability).
  const canMove = mySeat !== null && state.currentSeat === mySeat && state.phase === 'move'

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
      className="relative mx-auto aspect-square w-full max-w-[min(95vw,600px)] select-none"
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
        className="grid h-full w-full"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
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
                  className="pointer-events-none absolute inset-0 ring-2 ring-emerald-400 ring-offset-1 animate-pulse rounded-sm"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Tokens overlaid absolutely */}
      {placements.map(({ token, p }) => {
        const top = ((p.cell.row + 0.5 + p.dy) / GRID) * 100
        const left = ((p.cell.col + 0.5 + p.dx) / GRID) * 100
        const isLegalToken = canMove && legalByToken.has(token.seat * 4 + token.index)
        const tokenId = state.tokens.indexOf(token)
        const isCurrentSeatToken = token.seat === state.currentSeat
        const entry = legalByToken.get(state.tokens.indexOf(token))
        const showPicker = pickerTokenId === state.tokens.indexOf(token)

        // The token size scales with the board (cell ~ 1/15 of board). The
        // token is ~70% of a cell, multiplied by the per-token scale (used
        // to shrink tokens that share a cell). All sizes are percentages of
        // the board's width/height so they scale responsively.
        const sizePct = (1 / GRID) * 70 * p.scale // e.g. 4.67% for a full-size token

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
                  onTokenClick(state.tokens.indexOf(token), dir)
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
                  onClick={isLegalToken ? () => handleTokenClick(state.tokens.indexOf(token)) : undefined}
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
