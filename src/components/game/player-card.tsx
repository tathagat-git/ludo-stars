'use client'

import { Bot, Crown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Color, Player, Token } from '@/lib/ludo/engine'
import {
  COLOR_BG,
  COLOR_BG_SOFT,
  COLOR_BORDER,
  COLOR_DOT,
  COLOR_TEXT,
  isOnBoardColor,
} from '@/lib/ludo/board'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { isInBase, isFinished } from '@/lib/ludo/engine'

interface PlayerCardProps {
  player: Player
  /** The 4 tokens for this seat — needed to render the off-board base + home
   * strip for purple/orange players. Optional; standard colors ignore it. */
  tokens?: Token[]
  isCurrent: boolean
  isYou?: boolean
  compact?: boolean
}

/// Renders a single player's avatar + username + color dot + turn highlight +
/// finished rank. Mirrors the small player panels shown around the board in
/// Ludo King.
///
/// For the extra colors (purple & orange) — whose bases/home columns don't fit
/// on the 15x15 grid — this card also renders a compact off-board "Base" + "Home"
/// strip showing their tokens' positions.
export function PlayerCard({
  player,
  tokens,
  isCurrent,
  isYou = false,
  compact = false,
}: PlayerCardProps) {
  const color = player.color as Color
  const initial = (player.name || '?').charAt(0).toUpperCase()
  const showOffBoardStrip = tokens && tokens.length > 0 && !isOnBoardColor(color)

  return (
    <div
      aria-label={`Player ${player.name}`}
      className={cn(
        'relative flex flex-col gap-1 rounded-lg border p-2 transition-all',
        isCurrent
          ? cn('border-2 bg-card shadow-md', COLOR_BORDER[color], 'shadow-[0_0_0_2px_rgba(245,158,11,0.35)]')
          : 'border-border bg-card/60',
        compact && 'p-1.5',
      )}
    >
      {/* Top row: avatar + name + badges */}
      <div className="flex items-center gap-2">
        {/* color strip */}
        <div className={cn('absolute inset-y-0 left-0 w-1 rounded-l-lg', COLOR_BG[color])} aria-hidden />

        <Avatar className={cn('size-9 shrink-0 ring-2', COLOR_BORDER[color])}>
          <AvatarFallback className={cn(COLOR_BG_SOFT[color], COLOR_TEXT[color], 'text-sm font-bold')}>
            {initial}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn('size-2 shrink-0 rounded-full', COLOR_DOT[color])}
              aria-hidden
            />
            <p className="truncate text-sm font-semibold leading-tight">
              {player.name}
            </p>
            {player.isBot && (
              <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                <Bot className="size-2.5" /> BOT
              </Badge>
            )}
            {isYou && (
              <Badge variant="outline" className="px-1 py-0 text-[10px]">
                YOU
              </Badge>
            )}
            {isCurrent && (
              <span
                className="ml-auto inline-flex size-4 animate-pulse items-center justify-center rounded-full bg-amber-400 text-white"
                aria-label="current turn"
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            {player.rank !== undefined ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-amber-600">
                <Crown className="size-3" /> Rank #{player.rank}
              </span>
            ) : (
              <span>Seat {player.seat + 1}</span>
            )}
          </div>
        </div>
      </div>

      {/* Off-board base + home-column strip for purple/orange players only */}
      {showOffBoardStrip && tokens && (
        <OffBoardStrip color={color} tokens={tokens} />
      )}
    </div>
  )
}

// ─── Off-board base + home-column strip ──────────────────────────────────────

function OffBoardStrip({ color, tokens }: { color: Color; tokens: Token[] }) {
  // 4 base docks (token.index 0..3 when pos === -1).
  // 6 home-column cells (pos 100..105); 105 = finish (crown).
  const baseToken = (i: number) =>
    tokens.find((t) => t.index === i && isInBase(t.pos))
  const homeToken = (pos: number) =>
    tokens.find((t) => t.pos === pos)
  // Finished tokens (pos 200) sit in the finish cell.
  const finishedCount = tokens.filter((t) => isFinished(t.pos)).length

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-md bg-muted/40 p-1.5">
      {/* Base row */}
      <div className="flex items-center gap-1">
        <span
          className="w-8 shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
          aria-hidden
        >
          Base
        </span>
        <div
          className="flex gap-0.5"
          role="group"
          aria-label={`${color} base docks`}
        >
          {[0, 1, 2, 3].map((i) => {
            const t = baseToken(i)
            return (
              <div
                key={i}
                className={cn(
                  'grid size-5 place-items-center rounded-full border border-white shadow-sm',
                  COLOR_BG[color],
                )}
              >
                {t && (
                  <span
                    className="size-3 rounded-full border border-white bg-white/60"
                    aria-label={`token ${i + 1} in base`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Home row */}
      <div className="flex items-center gap-1">
        <span
          className="w-8 shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
          aria-hidden
        >
          Home
        </span>
        <div
          className="flex gap-0.5"
          role="group"
          aria-label={`${color} home column`}
        >
          {[100, 101, 102, 103, 104, 105].map((pos, i) => {
            const isFinish = pos === 105
            const t = homeToken(pos)
            const showFinished = isFinish && finishedCount > 0
            return (
              <div
                key={pos}
                className={cn(
                  'relative grid size-5 place-items-center rounded-sm border border-slate-300',
                  isFinish ? COLOR_BG[color] : COLOR_BG_SOFT[color],
                )}
              >
                {t && (
                  <span
                    className={cn(
                      'size-3 rounded-full border-2 border-white shadow-sm',
                      COLOR_BG[color],
                    )}
                    aria-label={`token at home position ${i + 1}`}
                  />
                )}
                {!t && showFinished && (
                  <Crown className="size-2.5 text-white/95" aria-hidden />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PlayerCard
