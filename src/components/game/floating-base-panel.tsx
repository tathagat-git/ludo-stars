'use client'

import { cn } from '@/lib/utils'
import { COLOR_BG, COLOR_BG_SOFT } from '@/lib/ludo/board'
import {
  type Color,
  type Token,
  isInBase,
  isFinished,
  POS_FINISHED,
} from '@/lib/ludo/engine'
import { Token as TokenComponent } from './token'

interface FloatingBasePanelProps {
  color: Color
  seat: number
  tokens: Token[] // the 4 tokens for this seat
  side: 'left' | 'right'
  onTokenClick?: (tokenId: number, direction: 'forward' | 'backward') => void
  movableTokenIds?: Set<number>
}

/**
 * FloatingBasePanel — renders the base + home column for purple/orange players
 * (seats 4 & 5) as a compact vertical strip that sits beside the 15x15 board.
 *
 * The 15x15 Ludo board only has room for 4 corner bases + 4 center-approach
 * home columns. For 5-6 player games we add purple & orange as "floating"
 * players: they share the 52-cell track but their base + home column render
 * as this panel instead of on the grid.
 */
export function FloatingBasePanel({
  color,
  seat,
  tokens,
  side,
}: FloatingBasePanelProps) {
  const seatTokens = tokens.filter((t) => t.seat === seat)

  const docks = (
    <div className="grid grid-cols-2 gap-1.5">
      {Array.from({ length: 4 }, (_, i) => {
        const token = seatTokens[i]
        const inBase = token && isInBase(token.pos)
        return (
          <div
            key={i}
            className={cn(
              'relative aspect-square rounded-full border-2 border-white/70',
              COLOR_BG[color],
            )}
          >
            {inBase && (
              <div className="absolute inset-0 p-0.5">
                <TokenComponent
                  color={color}
                  tokenId={token!.index}
                  isLegal={false}
                  isCurrent={false}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const homeCells = Array.from({ length: 6 }, (_, i) => {
    const pos = 100 + i
    const isFinish = i === 5
    const tokenHere = seatTokens.find((t) => t.pos === pos)
    const finishedHere = seatTokens.filter((t) => t.pos === POS_FINISHED)
    const showOnFinish = isFinish && finishedHere.length > 0
    return (
      <div
        key={i}
        className={cn(
          'relative flex h-7 w-7 items-center justify-center rounded border border-white/60',
          isFinish ? COLOR_BG[color] : COLOR_BG_SOFT[color],
        )}
      >
        {tokenHere && (
          <div className="absolute inset-0 p-0.5">
            <TokenComponent
              color={color}
              tokenId={tokenHere.index}
              isLegal={false}
              isCurrent={false}
            />
          </div>
        )}
        {showOnFinish &&
          finishedHere.map((t, idx) => (
            <div
              key={idx}
              className="absolute"
              style={{
                top: `${20 + idx * 5}%`,
                left: `${20 + idx * 5}%`,
                width: '50%',
                height: '50%',
              }}
            >
              <TokenComponent
                color={color}
                tokenId={t.index}
                isLegal={false}
                isCurrent={false}
              />
            </div>
          ))}
      </div>
    )
  })

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border-2 border-slate-700/40 bg-white/90 p-2 shadow-md dark:bg-slate-800/90',
        side === 'left' ? 'order-first' : 'order-last',
      )}
      aria-label={`${color} player base`}
    >
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'text-center text-[10px] font-bold uppercase tracking-wide',
            `text-${color}-600`,
          )}
        >
          {color}
        </span>
        {docks}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          Home
        </span>
        <div className="flex flex-col items-center gap-1">{homeCells}</div>
      </div>
    </div>
  )
}

export default FloatingBasePanel