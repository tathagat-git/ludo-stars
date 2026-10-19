'use client'

import * as React from 'react'
import { Gamepad2, TrendingUp, TrendingDown, Percent } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface StatsCardsProps {
  wins: number
  losses: number
  gamesPlayed: number
}

/**
 * Compact three-card row showing the user's win / loss / win-rate stats.
 * Used on the dashboard hero.
 */
export function StatsCards({ wins, losses, gamesPlayed }: StatsCardsProps) {
  const safeGames = Math.max(0, gamesPlayed | 0)
  const safeWins = Math.max(0, wins | 0)
  const safeLosses = Math.max(0, losses | 0)
  const winRate = safeGames > 0 ? Math.round((safeWins / safeGames) * 1000) / 10 : 0

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Games Played
          </CardTitle>
          <Gamepad2 className="text-primary h-4 w-4" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">{safeGames}</div>
          <p className="text-muted-foreground text-xs">total matches</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Wins
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600 tabular-nums dark:text-green-400">
            {safeWins}
          </div>
          <p className="text-muted-foreground text-xs">victories</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Losses
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600 tabular-nums dark:text-red-400">
            {safeLosses}
          </div>
          <p className="text-muted-foreground text-xs">defeats</p>
        </CardContent>
      </Card>

      <Card className="sm:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Win Rate
          </CardTitle>
          <Percent className="text-primary h-4 w-4" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold tabular-nums">{winRate}</span>
            <span className="text-muted-foreground text-lg">%</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {safeGames > 0
              ? `${safeWins}W / ${safeLosses}L over ${safeGames} games`
              : 'Play your first game to see this'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default StatsCards
