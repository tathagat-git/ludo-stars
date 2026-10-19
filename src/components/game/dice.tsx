'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Dices } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { colorOf } from '@/lib/ludo/engine'
import { COLOR_TEXT } from '@/lib/ludo/board'

interface DiceProps {
  value: number | null
  rolling?: boolean
  onRoll?: () => void
  canRoll?: boolean
  currentSeat?: number
  isMyTurn?: boolean
  phase?: 'roll' | 'move' | 'gameover'
  playerName?: string
}

const DICE_ICONS = {
  1: Dice1,
  2: Dice2,
  3: Dice3,
  4: Dice4,
  5: Dice5,
  6: Dice6,
}

/// Renders a die + a "Roll Dice" button. The die animates (rotates quickly)
/// whenever `value` changes — we use a `key` change to remount the motion.div
/// so framer-motion replays the entrance animation. When it's the local
/// player's turn and phase is 'roll', the Roll button is enabled and the
/// die area glows.
export function Dice({
  value,
  rolling = false,
  onRoll,
  canRoll = false,
  currentSeat,
  isMyTurn = false,
  phase = 'roll',
  playerName,
}: DiceProps) {
  const DieIcon = value ? DICE_ICONS[value] : Dices
  const color = currentSeat !== undefined ? colorOf(currentSeat) : 'red'

  const turnLabel =
    phase === 'gameover'
      ? 'Game Over'
      : isMyTurn
        ? phase === 'roll'
          ? 'Your turn — roll the dice'
          : phase === 'move'
            ? 'Your turn — make a move'
            : 'Waiting…'
        : playerName
          ? `${playerName}'s turn`
          : 'Waiting…'

  // The `spin` flag is purely derived from props: spin while the parent says
  // we're rolling OR right after a new value arrives (detected via key).
  // We rely on the `key` change to remount the motion.div below so the
  // animation actually plays — no internal state needed.
  const spin = rolling

  return (
    <section
      aria-label="Dice"
      className={cn(
        'border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-4 shadow-sm transition-shadow',
        isMyTurn &&
          phase !== 'gameover' &&
          'shadow-[0_0_0_2px_rgba(16,185,129,0.45),0_8px_24px_-8px_rgba(16,185,129,0.45)]',
      )}
    >
      <div className="flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={spin ? 'spinning' : (value ?? 'idle')}
            initial={{ rotate: 0, scale: 0.85 }}
            animate={spin ? { rotate: 720, scale: 1 } : { rotate: 360, scale: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'grid size-16 place-items-center rounded-lg border-2 bg-white',
              COLOR_TEXT[color],
              spin && 'border-amber-400',
            )}
          >
            <DieIcon className="size-10" strokeWidth={2} aria-hidden />
          </motion.div>
        </AnimatePresence>
      </div>

      <p
        className={cn(
          'text-center text-sm font-medium',
          isMyTurn ? 'text-emerald-600' : 'text-muted-foreground',
        )}
      >
        {turnLabel}
      </p>

      <Button
        onClick={onRoll}
        disabled={!canRoll || !isMyTurn || phase !== 'roll'}
        aria-label="Roll the dice"
        className="min-h-[44px] w-full"
      >
        <Dices className="size-4" />
        Roll Dice
      </Button>
    </section>
  )
}

export default Dice
