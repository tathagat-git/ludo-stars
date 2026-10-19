'use client'

import * as React from 'react'

import { TopNav } from '@/components/dashboard/top-nav'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Footer } from '@/components/ui/footer'
import { CreateGameDialog } from '@/components/lobby/create-game-dialog'
import { JoinGameDialog } from '@/components/lobby/join-game-dialog'
import { GameHistory } from '@/components/lobby/game-history'
import { QuickPlay } from '@/components/lobby/quick-play'
import { FriendsPanel } from '@/components/friends/friends-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DoorOpen, LogIn } from 'lucide-react'

/**
 * Dashboard user prop. The server page passes session.user augmented with
 * the Ludo-specific fields (Task 4-a is responsible for surfacing these
 * through next-auth's session callback).
 */
export interface DashboardUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  username?: string | null
  wins?: number
  losses?: number
  gamesPlayed?: number
}

export interface DashboardProps {
  user: DashboardUser
}

/**
 * The main post-login dashboard. Owns layout only — content widgets come
 * from peer tasks:
 *   - Task 4-b: FriendsPanel
 *   - Task 6:  QuickPlay, GameHistory, CreateGameDialog, JoinGameDialog
 *   - Task 4-a: UserMenu (rendered inside TopNav)
 *
 * Layout:
 *   ┌────────────────────────────── TopNav ──────────────────────────────┐
 *   │ Hero  →  "Welcome back, {username}!" + StatsCards                   │
 *   │ ┌─────────────── Main (2/3) ─────────┐ ┌─── Sidebar (1/3) ───────┐  │
 *   │ │ QuickPlay                            │ │ FriendsPanel             │ │
 *   │ │ GameHistory                          │ │ Create / Join triggers   │ │
 *   │ └─────────────────────────────────────┘ └──────────────────────────┘ │
 *   └─────────────────────────────── Footer ──────────────────────────────┘
 */
export function Dashboard({ user }: DashboardProps) {
  const username = user.username || user.name || 'Player'
  const wins = user.wins ?? 0
  const losses = user.losses ?? 0
  const gamesPlayed = user.gamesPlayed ?? 0

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <TopNav />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* ---------------- Hero ---------------- */}
        <section
          aria-labelledby="welcome-heading"
          className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1
              id="welcome-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Welcome back, <span className="text-primary">{username}</span>!
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick up where you left off, or start a new Ludo match.
            </p>
          </div>
        </section>

        <StatsCards wins={wins} losses={losses} gamesPlayed={gamesPlayed} />

        {/* ---------------- Main grid ---------------- */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 lg:grid-cols-3">
          {/* Main column */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <section aria-label="Quick play">
              <QuickPlay />
            </section>
            <section aria-label="Game history">
              <GameHistory />
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="flex flex-col gap-6">
            <section aria-label="Friends">
              <FriendsPanel />
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                  Multiplayer
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <CreateGameDialog />
                <JoinGameDialog />

                <div className="border-border bg-muted/30 text-muted-foreground mt-1 flex items-center gap-2 rounded-md border border-dashed p-3 text-xs">
                  <DoorOpen className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Share your room code with friends, or paste one here to join.
                  </span>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    // Soft-refresh — useful after friend/room changes.
                  }}
                >
                  <LogIn className="mr-2 h-4 w-4" aria-hidden />
                  Refresh lobby
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default Dashboard
