'use client'

import { Bot, Crown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Color, Player } from '@/lib/ludo/engine'
import { COLOR_BG, COLOR_BG_SOFT, COLOR_BORDER, COLOR_DOT, COLOR_TEXT } from '@/lib/ludo/board'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface PlayerCardProps {
  player: Player
  isCurrent: boolean
  isYou?: boolean
  compact?: boolean
}

/// Renders a single player's avatar + username + color dot + turn highlight +
/// finished rank. Mirrors the small player panels shown around the board in
/// Ludo King.
export function PlayerCard({
  player,
  isCurrent,
  isYou = false,
  compact = false,
}: PlayerCardProps) {
  const color = player.color as Color
  const initial = (player.name || '?').charAt(0).toUpperCase()

  return (
    <div
      aria-label={`Player ${player.name}`}
      className={cn(
        'relative flex items-center gap-2 rounded-lg border p-2 transition-all',
        isCurrent
          ? cn('border-2 bg-card shadow-md', COLOR_BORDER[color], 'shadow-[0_0_0_2px_rgba(245,158,11,0.35)]')
          : 'border-border bg-card/60',
        compact && 'p-1.5',
      )}
    >
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
  )
}

export default PlayerCard
