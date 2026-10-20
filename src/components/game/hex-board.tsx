'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { makeHexBoard, hexTokenPos } from '@/lib/ludo/hex-board'
import { COLORS, type Color, type GameState, type LegalMove } from '@/lib/ludo/engine'
import { Token as TokenComponent } from './token'
// Re-export the unified Board so any code still importing from hex-board.tsx
// gets the new unified component. The actual implementation lives in board.tsx.
export { Board as HexBoard, default } from './board'

interface HexBoardProps {
  state: GameState
  mySeat: number | null
  onTokenClick: (tokenId: number, direction: 'forward' | 'backward') => void
  highlightLegal: boolean
}

const COLOR_HEX: Record<Color, { c: string; l: string; d: string }> = {
  red: { c: '#e5383b', l: '#ff8d8f', d: '#9b1c20' },
  green: { c: '#2eab4f', l: '#7be08f', d: '#17702f' },
  yellow: { c: '#f5b700', l: '#ffe27a', d: '#b78400' },
  blue: { c: '#1f7ae0', l: '#7fbcff', d: '#0e4a94' },
  purple: { c: '#8e44ad', l: '#d7a6ee', d: '#55257a' },
  orange: { c: '#f07f1a', l: '#ffc27d', d: '#a4520a' },
}

function r0(n: number): number {
  return n === 6 ? 2.7 : 2.2
}

function loc(k: number, n: number, lx: number, ly: number): [number, number] {
  const t = (k * 360 * Math.PI) / (n * 180)
  return [lx * Math.cos(t) + ly * Math.sin(t), lx * Math.sin(t) - ly * Math.cos(t)]
}

export function HexBoard({ state, mySeat, onTokenClick, highlightLegal }: HexBoardProps) {
  const config = useMemo(() => makeHexBoard(state.maxPlayers), [state.maxPlayers])

  const isMyTurn = mySeat !== null && state.currentSeat === mySeat
  const canMove = isMyTurn && state.phase === 'move'
  const showTurnGlow = isMyTurn && (state.phase === 'move' || state.phase === 'roll')

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
  const R = config.R
  const viewBox = `${-R} ${-R} ${2 * R} ${2 * R}`

  return (
    <div
      className={cn(
        'relative mx-auto aspect-square w-full max-w-[min(95vw,580px)] rounded-2xl p-2.5 select-none transition-shadow',
        'bg-gradient-to-br from-[#2b3566] to-[#161c3d]',
        'shadow-[0_18px_40px_rgba(5,10,40,0.45),inset_0_2px_0_rgba(255,255,255,0.18)]',
        showTurnGlow && 'ring-2 ring-emerald-400/50',
      )}
      role="grid"
      aria-label={`Ludo board (${state.maxPlayers} players)`}
    >
      <svg
        viewBox={viewBox}
        className="h-full w-full overflow-visible rounded-xl bg-white"
      >
        {/* Center hub polygon */}
        <polygon
          points={config.ids
            .map((_, k) => {
              const p1 = loc(k, config.n, -1.5, r0(config.n) - 0.5)
              const p2 = loc(k, config.n, 1.5, r0(config.n) - 0.5)
              return `${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`
            })
            .join(' ')}
          fill="#fff"
          stroke="rgba(20,30,70,0.2)"
          strokeWidth={0.06}
        />

        {/* Center triangles (one per color) */}
        {config.ids.map((c, k) => {
          const p1 = loc(k, config.n, -1.5, r0(config.n) - 0.5)
          const p2 = loc(k, config.n, 1.5, r0(config.n) - 0.5)
          return (
            <polygon
              key={`tri-${c}`}
              points={`0,0 ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
              fill={COLOR_HEX[c].c}
            />
          )
        })}

        {/* Ring track cells */}
        {config.ring.map(([x, y], i) => {
          const cellColor = config.ids.find((c) => config.off[c] === i)
          const isSafe = config.safe.has(i)
          const segIdx = Math.floor(i / config.cellPerPlayer)
          const angle = config.ang[config.ids[segIdx]!] ?? 0
          return (
            <g key={`ring-${i}`} transform={`rotate(${angle} ${x} ${y})`}>
              <rect
                x={x - 0.43}
                y={y - 0.43}
                width={0.86}
                height={0.86}
                rx={0.15}
                fill={cellColor ? COLOR_HEX[cellColor!].c : '#fff'}
                stroke="rgba(20,30,70,0.14)"
                strokeWidth={0.04}
              />
              {cellColor && (
                <text x={x} y={y + 0.15} textAnchor="middle" fontSize={0.5} fill="#fff" fontWeight="bold">
                  ➜
                </text>
              )}
              {isSafe && !cellColor && (
                <text x={x} y={y + 0.15} textAnchor="middle" fontSize={0.45} fill="rgba(46,171,79,0.7)" className="anim-shimmer">
                  ★
                </text>
              )}
            </g>
          )
        })}

        {/* Home column cells */}
        {config.ids.map((c) =>
          config.home[c]!.map(([x, y], j) => (
            <rect
              key={`home-${c}-${j}`}
              x={x - 0.43}
              y={y - 0.43}
              width={0.86}
              height={0.86}
              rx={0.15}
              fill={j === config.home[c]!.length - 1 ? COLOR_HEX[c].c : COLOR_HEX[c].l}
              stroke="rgba(20,30,70,0.14)"
              strokeWidth={0.04}
              opacity={0.85}
            />
          )),
        )}

        {/* Base circles (one per player) */}
        {config.ids.map((c) => {
          const [bx, by] = config.bc[c]!
          const isActive = c === currentColor && state.phase !== 'gameover'
          const hex = COLOR_HEX[c]
          return (
            <g key={`base-${c}`}>
              <circle
                cx={bx}
                cy={by}
                r={1.7}
                fill={hex.c}
                stroke={hex.d}
                strokeWidth={0.15}
                className={isActive ? 'anim-pulse-glow' : ''}
              />
              <circle cx={bx} cy={by} r={1.4} fill="#fff" />
              {[0, 1, 2, 3].map((i) => {
                const [sx, sy] = config.slot(c, i)
                return <circle key={i} cx={sx} cy={sy} r={0.5} fill={hex.l} opacity={0.6} />
              })}
            </g>
          )
        })}

        {/* Center hub */}
        <circle cx={0} cy={0} r={0.8} fill="#fff" stroke="rgba(20,30,70,0.2)" strokeWidth={0.06} />
        <text x={0} y={0.3} textAnchor="middle" fontSize={1} className="anim-crown-glow">
          👑
        </text>
      </svg>

      {/* Tokens overlaid */}
      <div className="pointer-events-none absolute inset-2.5">
        {state.tokens.map((token, tokenId) => {
          const color = COLORS[token.seat]!
          if (!activeColors.includes(color)) return null
          const pos = hexTokenPos(token.pos, color, config, token.index)
          const isMovable = canMove && movableTokens.has(tokenId)
          const isCurrentSeatToken = token.seat === state.currentSeat
          const leftPct = ((pos.x + R) / (2 * R)) * 100
          const topPct = ((pos.y + R) / (2 * R)) * 100
          const sizePct = (100 / (2 * R)) * 6.5 * pos.scale

          return (
            <motion.div
              key={`token-${token.seat}-${token.index}`}
              layout
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className={cn('absolute pointer-events-none', isMovable && 'pointer-events-auto')}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${sizePct}%`,
                height: `${sizePct}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isMovable ? 15 : 10,
              }}
            >
              <div
                className={cn('size-full', isMovable && 'cursor-pointer')}
                onClick={
                  isMovable
                    ? () => {
                        const moves = movesByToken.get(tokenId) ?? []
                        const fwd = moves.find((m) => m.direction === 'forward')
                        const pick = fwd ?? moves[0]
                        if (pick) onTokenClick(pick.tokenId, pick.direction)
                      }
                    : undefined
                }
              >
                <TokenComponent color={color} tokenId={token.index} isLegal={isMovable} isCurrent={isCurrentSeatToken} />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default HexBoard