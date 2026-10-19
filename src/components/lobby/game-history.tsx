'use client'

// GameHistory
// -----------
// Lists the current user's 20 most recent games. Fetches GET /api/lobby.
// Shows date, mode, result (win/loss/unfinished), and players. Includes
// an empty state for new users.

import * as React from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
  Trophy,
  Skull,
  Clock,
  Bot,
  Users,
  History,
  Loader2,
  AlertCircle,
  Dices,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateGameDialog } from '@/components/lobby/create-game-dialog'
import { cn } from '@/lib/utils'

interface LobbyPlayerDTO {
  id: string
  seat: number
  isBot: boolean
  botName: string | null
  userId: string | null
  username: string | null
  finalRank: number | null
}

interface LobbyGameDTO {
  id: string
  code: string
  mode: string
  maxPlayers: number
  botCount: number
  status: string
  winnerId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  playerCount: number
  humanCount: number
  players: LobbyPlayerDTO[]
}

// Module-level QueryClient.
let browserQueryClient: QueryClient | null = null
function getQueryClient() {
  if (typeof window === 'undefined') {
    return new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    })
  }
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    })
  }
  return browserQueryClient
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface GameRowProps {
  game: LobbyGameDTO
  currentUserId?: string
}

function GameRow({ game, currentUserId }: GameRowProps) {
  const me = game.players.find((p) => !p.isBot && p.userId && p.userId === currentUserId)
  const isFinished = game.status === 'finished'
  const isPlaying = game.status === 'playing'

  let result: 'win' | 'loss' | 'unfinished'
  if (!isFinished) {
    result = 'unfinished'
  } else if (me?.finalRank === 1) {
    result = 'win'
  } else if (me?.finalRank && me.finalRank > 1) {
    result = 'loss'
  } else {
    // Finished but my seat had no rank (e.g., I left) — treat as loss.
    result = 'loss'
  }

  const winner = game.players.find((p) => p.finalRank === 1)

  return (
    <li className="border-border flex flex-col gap-2 border-b px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs font-medium tracking-wider">
            {game.code}
          </span>
          <Badge variant="secondary" className="capitalize">
            {game.mode}
          </Badge>
          <Badge
            variant="outline"
            className={cn('capitalize', isPlaying && 'border-primary/40 text-primary')}
          >
            {game.status}
          </Badge>
          {result === 'win' && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              <Trophy className="size-3" /> Win
            </Badge>
          )}
          {result === 'loss' && (
            <Badge variant="destructive">
              <Skull className="size-3" /> Loss
            </Badge>
          )}
          {result === 'unfinished' && (
            <Badge variant="outline">
              <Clock className="size-3" /> Unfinished
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          {formatDate(game.createdAt)}
          {winner ? (
            <span className="ml-2">
              · Winner:{' '}
              <span className="text-foreground">
                {winner.isBot ? winner.botName : winner.username}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1" title="Players">
          <Users className="size-3.5" />
          {game.playerCount}/{game.maxPlayers}
        </span>
        {game.botCount > 0 && (
          <span className="inline-flex items-center gap-1" title="Bots">
            <Bot className="size-3.5" />
            {game.botCount}
          </span>
        )}
      </div>
    </li>
  )
}

function GameHistoryImpl() {
  const query = useQuery<LobbyGameDTO[]>({
    queryKey: ['lobby', 'history'],
    queryFn: async () => {
      const res = await fetch('/api/lobby')
      if (!res.ok) throw new Error('Failed to load history')
      const data = (await res.json()) as { games: LobbyGameDTO[] }
      return data.games
    },
  })

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" />
          Recent games
        </CardTitle>
        <CardDescription className="text-xs">Your last 20 Ludo games.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {query.isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : query.isError ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-12 text-center text-sm">
            <AlertCircle className="text-destructive size-6" />
            <span>Failed to load game history.</span>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        ) : query.data && query.data.length > 0 ? (
          <ul className="lobby-scroll max-h-96 overflow-y-auto">
            {query.data.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm">
            <Trophy className="text-muted-foreground/50 size-8" />
            <p className="font-medium">No games yet — start playing!</p>
            <p className="text-muted-foreground max-w-[20rem] text-xs">
              Create a private room to invite friends, or jump into a quick match against
              bots.
            </p>
            <CreateGameDialog
              trigger={
                <Button size="sm" className="mt-1">
                  <Dices className="size-4" />
                  Create a game
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
      <style>{`
        .lobby-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .lobby-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .lobby-scroll::-webkit-scrollbar-track { background: transparent; }
        .lobby-scroll::-webkit-scrollbar-thumb {
          background-color: var(--border);
          border-radius: 9999px;
        }
        .lobby-scroll::-webkit-scrollbar-thumb:hover {
          background-color: var(--muted-foreground);
        }
      `}</style>
    </Card>
  )
}

export function GameHistory() {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <GameHistoryImpl />
    </QueryClientProvider>
  )
}
