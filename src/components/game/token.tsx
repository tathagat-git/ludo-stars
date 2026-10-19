'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import type { Color } from '@/lib/ludo/engine'
import { COLOR_BG } from '@/lib/ludo/board'
import { cn } from '@/lib/utils'

interface TokenProps {
  color: Color
  tokenId: number
  onClick?: () => void
  isLegal?: boolean
  isCurrent?: boolean
  size?: number | string // px (number) or any CSS length/% — default '100%'
  showStar?: boolean // show a tiny star inside (finished marker)
}

/// A single colored pawn/circle token. Uses framer-motion for entrance
/// animation. The parent is responsible for positioning this token on the
/// board (the token itself only renders its visual content).
///
/// Visual polish: a subtle top-down radial highlight gives the pawn a soft
/// 3D / glossy look (à la Ludo King's glossy marbles).
export function Token({
  color,
  tokenId,
  onClick,
  isLegal = false,
  isCurrent = false,
  size = '100%',
  showStar = false,
}: TokenProps) {
  const clickable = !!onClick
  // Compute inner-highlight size — works for both px (number) and % sizes.
  const dotSize = typeof size === 'number' ? size * 0.28 : '28%'
  const dotTop = typeof size === 'number' ? size * 0.16 : '16%'
  const dotLeft = typeof size === 'number' ? size * 0.18 : '18%'
  const starSize = typeof size === 'number' ? size * 0.5 : '50%'
  return (
    <motion.button
      type="button"
      layout
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      whileHover={clickable ? { scale: 1.18 } : undefined}
      whileTap={clickable ? { scale: 0.92 } : undefined}
      onClick={onClick}
      aria-label={`Token ${tokenId + 1} (${color})${isLegal ? ' — legal move available' : ''}`}
      disabled={!clickable}
      className={cn(
        'relative grid place-items-center overflow-hidden rounded-full border-2 shadow-md transition-shadow',
        'border-white',
        COLOR_BG[color],
        clickable &&
          'cursor-pointer ring-2 ring-emerald-400/70 ring-offset-1 hover:ring-emerald-400',
        isCurrent && !isLegal && 'ring-2 ring-amber-400 ring-offset-1',
        isLegal && 'ring-2 ring-emerald-400 ring-offset-1',
      )}
      style={{ width: size, height: size }}
    >
      {/* glossy top-left highlight (3D marble shine) */}
      <span
        className="pointer-events-none absolute rounded-full bg-gradient-to-br from-white/70 to-transparent"
        style={{ width: '50%', height: '50%', top: '8%', left: '10%' }}
        aria-hidden
      />
      {/* inner highlight dot (kept for the classic pawn look) */}
      <span
        className="absolute rounded-full bg-white/70"
        style={{ width: dotSize, height: dotSize, top: dotTop, left: dotLeft }}
        aria-hidden
      />
      {showStar && (
        <Star
          className="text-white drop-shadow"
          style={{ width: starSize, height: starSize }}
          strokeWidth={2.5}
          aria-hidden
        />
      )}
    </motion.button>
  )
}

export default Token
