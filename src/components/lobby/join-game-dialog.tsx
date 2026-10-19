'use client'

// JoinGameDialog
// --------------
// A shadcn `Dialog` with two ways to join a game:
//   1. Enter a 6-char room code → POST /api/lobby/[code]/join → goto room
//   2. Browse open rooms (GET /api/lobby/active) → click Join → join → goto
//
// Usage:
//   <JoinGameDialog />                              // default trigger
//   <JoinGameDialog trigger={<MyButton />} />      // custom trigger

import * as React from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DoorOpen,
  Loader2,
  LogIn,
  Search,
  Users,
  Bot,
  RefreshCw,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

interface JoinGameDialogProps {
  trigger?: React.ReactNode
}

function gotoRoom(code: string) {
  if (typeof window !== 'undefined') {
    window.location.search = `?room=${encodeURIComponent(code)}`
  }
}

// Module-level singleton QueryClient (matches the friends-panel pattern).
let browserQueryClient: QueryClient | null = null
function getQueryClient() {
  if (typeof window === 'undefined') {
    return new QueryClient({
      defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
    })
  }
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
    })
  }
  return browserQueryClient
}

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 6)
}

function JoinGameDialogImpl({ trigger }: JoinGameDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [code, setCode] = React.useState('')
  const queryClient = useQueryClient()

  const activeQuery = useQuery< LobbyGameDTO[]>({
    queryKey: ['lobby', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/lobby/active')
      if (!res.ok) throw new Error('Failed to load open rooms')
      const data = (await res.json()) as { games: LobbyGameDTO[] }
      return data.games
    },
    enabled: open,
  })

  const joinByCode = useMutation({
    mutationFn: async (roomCode: string) => {
      const res = await fetch(
        `/api/lobby/${encodeURIComponent(roomCode)}/join`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `Failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (_data, roomCode) => {
      toast.success(`Joined room ${roomCode}`)
      setOpen(false)
      setTimeout(() => gotoRoom(roomCode), 80)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to join'
      toast.error(msg)
    },
  })

  const joinActive = useMutation({
    mutationFn: async (roomCode: string) => {
      const res = await fetch(
        `/api/lobby/${encodeURIComponent(roomCode)}/join`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `Failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (_data, roomCode) => {
      toast.success(`Joined room ${roomCode}`)
      setOpen(false)
      setTimeout(() => gotoRoom(roomCode), 80)
      // Bust the active list cache so other UI updates.
      void queryClient.invalidateQueries({ queryKey: ['lobby', 'active'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to join'
      toast.error(msg)
    },
  })

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const c = normalizeCode(code)
    if (c.length !== 6) {
      toast.error('Room code must be 6 characters')
      return
    }
    joinByCode.mutate(c)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <DoorOpen className="size-4" />
            Join a game
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="size-5" />
            Join a game
          </DialogTitle>
          <DialogDescription>
            Enter a room code shared by a friend, or pick an open room below.
          </DialogDescription>
        </DialogHeader>

        {/* Code entry */}
        <form onSubmit={handleCodeSubmit} className="grid gap-2">
          <Label htmlFor="room-code">Room code</Label>
          <div className="flex gap-2">
            <Input
              id="room-code"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC234"
              className="font-mono uppercase tracking-widest"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
            <Button
              type="submit"
              disabled={joinByCode.isPending || code.length !== 6}
            >
              {joinByCode.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              Join
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            6-character codes use A–Z and 2–9 (no 0/O/1/I).
          </p>
        </form>

        {/* Open rooms */}
        <div className="grid gap-2 pt-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Search className="size-3.5" />
              Open rooms
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => activeQuery.refetch()}
              disabled={activeQuery.isFetching}
            >
              <RefreshCw
                className={cn(
                  'size-3.5',
                  activeQuery.isFetching && 'animate-spin',
                )}
              />
              Refresh
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-muted/30 pr-1 lobby-scroll">
            {activeQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : activeQuery.isError ? (
              <div className="px-3 py-8 text-center text-sm text-destructive">
                Failed to load rooms.
              </div>
            ) : activeQuery.data && activeQuery.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {activeQuery.data.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium tracking-wider">
                          {g.code}
                        </span>
                        <Badge variant="secondary" className="capitalize">
                          {g.mode}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          {g.playerCount}/{g.maxPlayers}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bot className="size-3" />
                          {g.botCount}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => joinActive.mutate(g.code)}
                      disabled={
                        joinActive.isPending ||
                        joinActive.variables === g.code
                      }
                    >
                      {joinActive.isPending &&
                      joinActive.variables === g.code ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <LogIn className="size-3.5" />
                      )}
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No open rooms right now.
                <br />
                Create one and invite a friend!
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function JoinGameDialog({ trigger }: JoinGameDialogProps) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <JoinGameDialogImpl trigger={trigger} />
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
    </QueryClientProvider>
  )
}
