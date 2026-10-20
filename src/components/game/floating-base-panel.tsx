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
  tokens: Token[]
  side: 'left' | 'right'
  movableTokenIds?: Set<number>
}

/**
 * FloatingBasePanel — renders the base + home column for purple/orange players
 * (seats 4 & 5) as a compact vertical strip that sits flush beside the 15x15
 * board, styled to look like a board extension (same cell sizing, colored
 * border, matching aspect).
 */
export function FloatingBasePanel({
  color,
  seat,
  tokens,
  side,
}: FloatingBasePanelProps) {
  const seatTokens = tokens.filter((t) => t.seat === seat)

  const docks = (
    <div className="grid grid-cols-2 gap-1">
      {Array.from({ length: 4 }, (_, i) => {
        const token = seatTokens[i]
        const inBase = token && isInBase(token.pos)
        return (
          <div
            key={i}
            className={cn(
              'relative aspect-square rounded-md border-2 border-white/70',
              COLOR_BG[color],
            )}
          >
            {inBase && (
              <div className="absolute inset-0.5">
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
          'relative flex aspect-square items-center justify-center rounded-sm border border-white/50',
          isFinish ? COLOR_BG[color] : COLOR_BG_SOFT[color],
        )}
      >
        {tokenHere && (
          <div className="absolute inset-0.5">
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
                top: `${15 + idx * 8}%`,
                left: `${15 + idx * 8}%`,
                width: '60%',
                height: '60%',
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
        'flex aspect-square flex-col gap-1 rounded-lg border-2 p-1 shadow-md',
        'border-slate-800 bg-white dark:border-slate-200/30 dark:bg-slate-900',
      )}
      aria-label={`${color} player base`}
      style={{ ['--c' as string]: `var(--c-${color})` }}
    >
      <div className={cn('rounded px-1 py-0.5 text-center', COLOR_BG[color])}>
        <span className="text-[9px] font-bold uppercase tracking-wide text-white">
          {color}
        </span>
      </div>
      <div className="flex-1">{docks}</div>
      <div className="flex flex-col gap-0.5">
        <span className="text-center text-[8px] font-medium text-muted-foreground">
          Home
        </span>
        <div className="flex flex-col gap-0.5">{homeCells}</div>
      </div>
    </div>
  )
}

export default FloatingBasePanel