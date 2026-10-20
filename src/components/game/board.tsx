'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  TRACK_CELLS,
  HOME_COLUMN_CELLS,
  type Cell,
} from '@/lib/ludo/board'
import {
  COLORS,
  isFinished,
  type Color,
  type GameState,
  type LegalMove,
} from '@/lib/ludo/engine'
import { makeHexBoard, hexTokenPos } from '@/lib/ludo/hex-board'

interface BoardProps {
  state: GameState
  mySeat: number | null
  onTokenClick: (tokenId: number, direction: 'forward' | 'backward') => void
  highlightLegal: boolean
}

// Ludo Royale color palette (exact hex values from the reference)
const C: Record<Color, { n: string; c: string; l: string; d: string }> = {
  red: { n: 'Red', c: '#e5383b', l: '#ff8d8f', d: '#9b1c20' },
  green: { n: 'Green', c: '#2eab4f', l: '#7be08f', d: '#17702f' },
  yellow: { n: 'Yellow', c: '#f5b700', l: '#ffe27a', d: '#b78400' },
  blue: { n: 'Blue', c: '#1f7ae0', l: '#7fbcff', d: '#0e4a94' },
  purple: { n: 'Purple', c: '#8e44ad', l: '#d7a6ee', d: '#55257a' },
  orange: { n: 'Orange', c: '#f07f1a', l: '#ffc27d', d: '#a4520a' },
}

const ORDER: Color[] = ['red', 'green', 'yellow', 'blue']
const STARTS_4: Record<number, Color> = {
  0: 'red',
  13: 'green',
  26: 'yellow',
  39: 'blue',
}
const SAFE_4 = new Set([0, 13, 26, 39, 8, 21, 34, 47])
const BASE_POS_4: Record<Color, [number, number]> = {
  red: [9, 0],
  green: [9, 9],
  yellow: [0, 9],
  blue: [0, 0],
}
const SLOT_4 = [
  [1.5, 1.5],
  [3.5, 1.5],
  [1.5, 3.5],
  [3.5, 3.5],
]
const U4 = 100 / 15

const rad = (a: number) => (a * Math.PI) / 180
const r0 = (n: number) => (n === 6 ? 2.7 : 2.2)
function loc(k: number, n: number, lx: number, ly: number): [number, number] {
  const t = (k * 360 * Math.PI) / (n * 180)
  return [lx * Math.cos(t) + ly * Math.sin(t), lx * Math.sin(t) - ly * Math.cos(t)]
}

function pos4(
  color: Color,
  idx: number,
  enginePos: number,
): { x: number; y: number; s: number; k?: string } {
  const baseCoord = BASE_POS_4[color]
  if (enginePos < 0) {
    const slot = SLOT_4[idx]!
    return { x: baseCoord![0] + slot[0] - 7, y: baseCoord![1] + slot[1] - 7, s: 1 }
  }
  if (enginePos <= 51) {
    const cell = TRACK_CELLS[enginePos]!
    return { x: cell.col - 7, y: cell.row - 7, s: 1, k: 'r' + enginePos }
  }
  if (enginePos >= 100 && enginePos <= 105) {
    const homeList = HOME_COLUMN_CELLS[color]
    if (homeList) {
      const cell = homeList[enginePos - 100]!
      return { x: cell.col - 7, y: cell.row - 7, s: 1, k: 'h' + color + enginePos }
    }
  }
  const ang = { red: 270, green: 0, yellow: 90, blue: 180 }[color]!
  return {
    x: Math.sin(rad(ang)) * 0.8 + (idx % 2 ? 0.12 : -0.12),
    y: -Math.cos(rad(ang)) * 0.8 + (idx > 1 ? 0.12 : -0.12),
    s: 0.5,
  }
}

export function Board({ state, mySeat, onTokenClick, highlightLegal }: BoardProps) {
  const n = state.maxPlayers
  const isHex = n >= 5
  const hexConfig = useMemo(
    () => (isHex ? makeHexBoard(n) : null),
    [isHex, n],
  )
  const isMyTurn = mySeat !== null && state.currentSeat === mySeat
  const canMove = isMyTurn && state.phase === 'move'
  const showTurnGlow =
    isMyTurn && (state.phase === 'move' || state.phase === 'roll')
  const activeColors = useMemo(
    () => state.players.map((p) => COLORS[p.seat]!),
    [state.players],
  )
  const movesByToken = useMemo(() => {
    const map = new Map<number, LegalMove[]>()
    if (!highlightLegal) return map
    for (const m of state.legalMoves) {
      const arr = map.get(m.tokenId) ?? []
      arr.push(m)
      map.set(m.tokenId, arr)
    }
    return map
  }, [state.legalMoves, highlightLegal])
  const movableTokens = useMemo(() => {
    const set = new Set<number>()
    for (const m of state.legalMoves) set.add(m.tokenId)
    return set
  }, [state.legalMoves])
  const currentColor = COLORS[state.currentSeat]!

  // ── 4-PLAYER GRID BOARD ─────────────────────────────────────────────────
  if (!isHex) {
    const R4 = 7.5
    const cellPct = 100 / (2 * R4)
    const cells: React.ReactNode[] = []
    const addCell = (
      x: number,
      y: number,
      bg: string,
      content: React.ReactNode | null,
      key: string,
    ) => {
      cells.push(
        <div
          key={key}
          className="lr-cell"
          style={{
            background: bg,
            left: `${(x - 0.5 + R4) * cellPct}%`,
            top: `${(y - 0.5 + R4) * cellPct}%`,
            width: `${cellPct}%`,
            height: `${cellPct}%`,
          }}
        >
          {content}
        </div>,
      )
    }
    TRACK_CELLS.forEach((c, i) => {
      const sc = STARTS_4[i]
      const bg = sc ? C[sc].c : '#fff'
      const content = sc ? (
        <span style={{ color: '#fff' }}>➜</span>
      ) : SAFE_4.has(i) ? (
        <span style={{ color: 'rgba(46,171,79,0.7)' }} className="anim-shimmer">
          ★
        </span>
      ) : null
      addCell(c.col - 7, c.row - 7, bg, content, 'r' + i)
    })
    ORDER.forEach((c) => {
      const homeList = HOME_COLUMN_CELLS[c]
      if (!homeList) return
      homeList.forEach((cell, j) =>
        addCell(
          cell.col - 7,
          cell.row - 7,
          `linear-gradient(${C[c].l},${C[c].c})`,
          null,
          'h' + c + j,
        ),
      )
    })

    // Group tokens by cell for stacking
    const groups: Record<string, string[]> = {}
    state.tokens.forEach((t, i) => {
      const col = COLORS[t.seat]!
      if (!activeColors.includes(col)) return
      const q = pos4(col, t.index, t.pos)
      if (q.k) (groups[q.k] = groups[q.k] || []).push(col + i)
    })

    return (
      <div
        className={cn(
          'lr-frame mx-auto w-full max-w-[min(95vw,580px)]',
          showTurnGlow && 'lr-frame-glow',
        )}
      >
        <div
          className="lr-board"
          style={{ '--u': `${cellPct}%` } as React.CSSProperties}
        >
          {cells}
          {ORDER.map((c) => {
            const [bx, by] = BASE_POS_4[c]!
            const isActive =
              c === currentColor && state.phase !== 'gameover'
            return (
              <div
                key={c}
                className={cn(
                  'lr-base',
                  !activeColors.includes(c) && 'off',
                  isActive && 'act',
                )}
                style={
                  {
                    left: `${bx * U4}%`,
                    top: `${by * U4}%`,
                    '--c': C[c].c,
                    '--l': C[c].l,
                    '--d': C[c].d,
                  } as React.CSSProperties
                }
              >
                <div className="lr-base-in" />
                {SLOT_4.map((s, k) => (
                  <div
                    key={k}
                    className="lr-slot"
                    style={{
                      left: `${(s[0] / 6) * 100}%`,
                      top: `${(s[1] / 6) * 100}%`,
                    }}
                  />
                ))}
              </div>
            )
          })}
          <div className="lr-ctr">
            <i
              style={{ background: C.red.c, clipPath: 'polygon(0 0,50% 50%,0 100%)' }}
            />
            <i
              style={{
                background: C.green.c,
                clipPath: 'polygon(0 0,100% 0,50% 50%)',
              }}
            />
            <i
              style={{
                background: C.yellow.c,
                clipPath: 'polygon(100% 0,100% 100%,50% 50%)',
              }}
            />
            <i
              style={{
                background: C.blue.c,
                clipPath: 'polygon(0 100%,50% 50%,100% 100%)',
              }}
            />
            <div className="lr-ctr-crown anim-crown-glow">👑</div>
          </div>
          {state.tokens.map((token, tokenId) => {
            const color = COLORS[token.seat]!
            if (!activeColors.includes(color)) return null
            const p = pos4(color, token.index, token.pos)
            const grp = p.k ? groups[p.k] : null
            const nT = grp ? grp.length : 1
            const gi = grp ? grp.indexOf(color + tokenId) : 0
            const off: [number, number] =
              nT > 1
                ? [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]][gi % 4]!
                : [0, 0]
            const isMovable = canMove && movableTokens.has(tokenId)
            const hex = C[color]
            const moves = movesByToken.get(tokenId) ?? []
            return (
              <motion.button
                key={`t-${token.seat}-${token.index}`}
                layout
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className={cn('lr-tok', isMovable && 'can')}
                disabled={!isMovable}
                aria-label={`${hex.n} token ${token.index + 1}`}
                onClick={
                  isMovable && moves.length > 0
                    ? () => {
                        const fwd = moves.find(
                          (m) => m.direction === 'forward',
                        )
                        const pick = fwd ?? moves[0]!
                        onTokenClick(pick.tokenId, pick.direction)
                      }
                    : undefined
                }
                style={
                  {
                    left: `${(p.x + off[0] - 0.5 + R4) * cellPct}%`,
                    top: `${(p.y + off[1] - 0.5 + R4) * cellPct}%`,
                    '--c': hex.c,
                    '--l': hex.l,
                    '--d': hex.d,
                  } as React.CSSProperties
                }
              >
                <span
                  className={cn(
                    'lr-pawn',
                    isMovable && 'anim-hop',
                    color === currentColor && !isMovable && 'anim-token-bounce',
                  )}
                  style={{ transform: `scale(${nT > 1 ? 0.72 * p.s : p.s})` }}
                />
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── 5/6-PLAYER HEX BOARD ────────────────────────────────────────────────
  const cfg = hexConfig!
  const R = cfg.R
  const hexCellPct = 100 / (2 * R)
  const viewBox = `${-R} ${-R} ${2 * R} ${2 * R}`

  return (
    <div
      className={cn(
        'lr-frame mx-auto w-full max-w-[min(95vw,580px)]',
        showTurnGlow && 'lr-frame-glow',
      )}
    >
      <div
        className="lr-board"
        style={{ '--u': `${hexCellPct}%` } as React.CSSProperties}
      >
        <svg viewBox={viewBox} className="absolute inset-0 h-full w-full">
          {/* Center hub polygon */}
          <polygon
            points={cfg.ids
              .map((_, k) => {
                const p1 = loc(k, cfg.n, -1.5, r0(cfg.n) - 0.5)
                const p2 = loc(k, cfg.n, 1.5, r0(cfg.n) - 0.5)
                return `${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`
              })
              .join(' ')}
            fill="#fff"
            stroke="rgba(20,30,70,0.2)"
            strokeWidth={0.06}
          />
          {/* Center triangles */}
          {cfg.ids.map((c, k) => {
            const p1 = loc(k, cfg.n, -1.5, r0(cfg.n) - 0.5)
            const p2 = loc(k, cfg.n, 1.5, r0(cfg.n) - 0.5)
            return (
              <polygon
                key={'t' + c}
                points={`0,0 ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
                fill={C[c].c}
              />
            )
          })}
          {/* Ring cells */}
          {cfg.ring.map(([x, y], i) => {
            const sc = cfg.ids.find((c) => cfg.off[c] === i)
            const isSafe = cfg.safe.has(i)
            const segIdx = Math.floor(i / cfg.cellPerPlayer)
            const angle = cfg.ang[cfg.ids[segIdx]!] ?? 0
            return (
              <g key={'r' + i} transform={`rotate(${angle} ${x} ${y})`}>
                <rect
                  x={x - 0.43}
                  y={y - 0.43}
                  width={0.86}
                  height={0.86}
                  rx={0.15}
                  fill={sc ? C[sc].c : '#fff'}
                  stroke="rgba(20,30,70,0.14)"
                  strokeWidth={0.04}
                />
                {sc && (
                  <text
                    x={x}
                    y={y + 0.15}
                    textAnchor="middle"
                    fontSize={0.4}
                    fill="#fff"
                    fontWeight="bold"
                  >
                    ➜
                  </text>
                )}
                {isSafe && !sc && (
                  <text
                    x={x}
                    y={y + 0.15}
                    textAnchor="middle"
                    fontSize={0.38}
                    fill="rgba(46,171,79,0.7)"
                    className="anim-shimmer"
                  >
                    ★
                  </text>
                )}
              </g>
            )
          })}
          {/* Home cells */}
          {cfg.ids.map((c) =>
            cfg.home[c]!.map(([x, y], j) => (
              <rect
                key={'h' + c + j}
                x={x - 0.43}
                y={y - 0.43}
                width={0.86}
                height={0.86}
                rx={0.15}
                fill={
                  j === cfg.home[c]!.length - 1 ? C[c].c : C[c].l
                }
                stroke="rgba(20,30,70,0.14)"
                strokeWidth={0.04}
                opacity={0.85}
              />
            )),
          )}
          {/* Base circles */}
          {cfg.ids.map((c) => {
            const [bx, by] = cfg.bc[c]!
            const isActive =
              c === currentColor && state.phase !== 'gameover'
            return (
              <g key={'b' + c}>
                <circle
                  className={cn('lr-hb', isActive && 'act')}
                  cx={bx}
                  cy={by}
                  r={1.7}
                  fill={C[c].c}
                  stroke={C[c].d}
                  strokeWidth={0.15}
                />
                <circle cx={bx} cy={by} r={1.4} fill="#fff" />
                {[0, 1, 2, 3].map((i) => {
                  const [sx, sy] = cfg.slot(c, i)
                  return (
                    <circle
                      key={i}
                      cx={sx}
                      cy={sy}
                      r={0.5}
                      fill={C[c].l}
                      opacity={0.6}
                    />
                  )
                })}
              </g>
            )
          })}
          {/* Center crown */}
          <circle
            cx={0}
            cy={0}
            r={0.8}
            fill="#fff"
            stroke="rgba(20,30,70,0.2)"
            strokeWidth={0.06}
          />
          <text
            x={0}
            y={0.3}
            textAnchor="middle"
            fontSize={1}
            className="anim-crown-glow"
          >
            👑
          </text>
        </svg>
        {/* Tokens */}
        {state.tokens.map((token, tokenId) => {
          const color = COLORS[token.seat]!
          if (!activeColors.includes(color)) return null
          const p = hexTokenPos(token.pos, color, cfg, token.index)
          const isMovable = canMove && movableTokens.has(tokenId)
          const hex = C[color]
          const moves = movesByToken.get(tokenId) ?? []
          return (
            <motion.button
              key={`t-${token.seat}-${token.index}`}
              layout
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className={cn('lr-tok', isMovable && 'can')}
              disabled={!isMovable}
              aria-label={`${hex.n} token ${token.index + 1}`}
              onClick={
                isMovable && moves.length > 0
                  ? () => {
                      const fwd = moves.find(
                        (m) => m.direction === 'forward',
                      )
                      const pick = fwd ?? moves[0]!
                      onTokenClick(pick.tokenId, pick.direction)
                    }
                  : undefined
              }
              style={
                {
                  left: `${(p.x - 0.5 + R) * hexCellPct}%`,
                  top: `${(p.y - 0.5 + R) * hexCellPct}%`,
                  '--c': hex.c,
                  '--l': hex.l,
                  '--d': hex.d,
                } as React.CSSProperties
              }
            >
              <span
                className={cn(
                  'lr-pawn',
                  isMovable && 'anim-hop',
                  color === currentColor && !isMovable && 'anim-token-bounce',
                )}
                style={{ transform: `scale(${p.s})` }}
              />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export default Board