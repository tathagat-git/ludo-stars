'use client'

import { Crown, Trophy, RotateCcw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Player } from '@/lib/ludo/engine'
import { COLOR_BG, COLOR_BG_SOFT, COLOR_BORDER, COLOR_TEXT } from '@/lib/ludo/board'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface GameOverModalProps {
  open: boolean
  players: Player[]
  winners: number[] // ordered seats by finish rank
  onPlayAgain?: () => void
  onExit: () => void
}

const RANK_LABELS = ['1st', '2nd', '3rd', '4th']

/// Modal shown when phase === 'gameover'. Displays final rankings ordered by
/// finish rank (finished players first, then unfinished). Includes a small
/// CSS-only confetti effect.
export function GameOverModal({
  open,
  players,
  winners,
  onPlayAgain,
  onExit,
}: GameOverModalProps) {
  // Sort: finished players by rank ascending; then unfinished by seat.
  const sorted = [...players].sort((a, b) => {
    const ar = a.rank ?? 99
    const br = b.rank ?? 99
    if (ar !== br) return ar - br
    return a.seat - b.seat
  })

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md overflow-hidden p-0"
        aria-label="Game over"
      >
        {/* Confetti layer (CSS-only) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="confetti-layer" />
        </div>

        <DialogHeader className="relative z-10 bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-emerald-500/10 p-6 pb-2 text-center">
          <div className="mx-auto mb-2 grid size-14 place-items-center rounded-full bg-amber-400 text-white shadow-lg">
            <Trophy className="size-7" />
          </div>
          <DialogTitle className="text-2xl font-bold">Game Over!</DialogTitle>
          <DialogDescription>
            Final standings
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 flex flex-col gap-2 p-4 pt-2">
          {sorted.map((p, i) => {
            const rank = p.rank ?? winners.length + 1 + (i - winners.length)
            const isWinner = rank === 1
            return (
              <div
                key={p.seat}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2',
                  isWinner
                    ? cn(COLOR_BORDER[p.color], 'bg-amber-50 dark:bg-amber-950/20')
                    : 'border-border bg-card/60',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                    isWinner ? 'bg-amber-400 text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {RANK_LABELS[rank - 1] ?? `${rank}`}
                </span>
                <Avatar className={cn('size-9 ring-2', COLOR_BORDER[p.color])}>
                  <AvatarFallback className={cn(COLOR_BG_SOFT[p.color], COLOR_TEXT[p.color], 'font-bold')}>
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.isBot ? 'Bot' : 'Player'} · Seat {p.seat + 1}
                  </p>
                </div>
                {isWinner && <Crown className="size-5 text-amber-500" />}
                <span className={cn('size-3 rounded-full', COLOR_BG[p.color])} aria-hidden />
              </div>
            )
          })}
        </div>

        <DialogFooter className="relative z-10 gap-2 border-t p-4 pt-3 sm:flex-row sm:justify-end">
          {onPlayAgain && (
            <Button onClick={onPlayAgain} className="min-h-[44px] flex-1 sm:flex-initial">
              <RotateCcw className="size-4" />
              Play Again
            </Button>
          )}
          <Button
            onClick={onExit}
            variant="outline"
            className="min-h-[44px] flex-1 sm:flex-initial"
          >
            <LogOut className="size-4" />
            Exit
          </Button>
        </DialogFooter>

        <style jsx>{`
          .confetti-layer {
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(circle at 10% 20%, #f87171 0 4px, transparent 5px),
              radial-gradient(circle at 80% 30%, #fbbf24 0 4px, transparent 5px),
              radial-gradient(circle at 30% 70%, #34d399 0 4px, transparent 5px),
              radial-gradient(circle at 70% 80%, #a78bfa 0 4px, transparent 5px),
              radial-gradient(circle at 50% 50%, #f472b6 0 4px, transparent 5px);
            background-size: 200% 200%;
            opacity: 0.5;
            animation: confetti-fall 2.4s ease-in-out infinite alternate;
          }
          @keyframes confetti-fall {
            0% { background-position: 0% 0%; transform: translateY(-4px); }
            100% { background-position: 100% 100%; transform: translateY(4px); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}

export default GameOverModal
