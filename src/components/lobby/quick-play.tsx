'use client'

// QuickPlay
// ---------
// A prominent dashboard card with two big buttons:
//   - "Play vs Bots" — immediately creates a 4-player game with 3 bots in
//     twist mode, then navigates to the room.
//   - "Create Private Room" — opens the CreateGameDialog (custom trigger).
//
// Self-hosts a QueryClient + Sonner toaster (same pattern as the friends
// panel) so it works regardless of the app-level provider setup.

import * as React from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { Bot, Dice5, Loader2, Plus, Zap } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateGameDialog } from '@/components/lobby/create-game-dialog'

interface QuickPlayResponse {
  game: { code: string; mode: string }
  code: string
}

function gotoRoom(code: string) {
  if (typeof window !== 'undefined') {
    // `bots=3&autostart=1` tells the GameRoom to auto-fill 3 bot seats and
    // start the game immediately (the "Play vs Bots" one-click flow).
    window.location.search = `?room=${encodeURIComponent(code)}&bots=3&autostart=1`
  }
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

function QuickPlayImpl() {
  const quickMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'twist',
          maxPlayers: 4,
          botCount: 3,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `Failed (${res.status})`)
      }
      return (await res.json()) as QuickPlayResponse
    },
    onSuccess: (data) => {
      toast.success(`Match starting in room ${data.code}`)
      setTimeout(() => gotoRoom(data.code), 80)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to start match'
      toast.error(msg)
    },
  })

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="text-primary size-4" />
          Quick play
        </CardTitle>
        <CardDescription className="text-xs">
          Jump into a game in one click.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-auto flex-col gap-1 py-5"
          onClick={() => quickMutation.mutate()}
          disabled={quickMutation.isPending}
        >
          {quickMutation.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Bot className="size-5" />
          )}
          <span className="text-sm font-semibold">Play vs Bots</span>
          <span className="text-[11px] font-normal opacity-80">
            4-player twist · 3 bots
          </span>
        </Button>

        <CreateGameDialog
          trigger={
            <Button
              size="lg"
              variant="outline"
              className="h-auto flex-col gap-1 py-5"
              disabled={quickMutation.isPending}
            >
              <Plus className="size-5" />
              <span className="text-sm font-semibold">Create Private Room</span>
              <span className="text-[11px] font-normal opacity-80">
                Invite friends with a code
              </span>
            </Button>
          }
        />
      </CardContent>

      <SonnerToaster richColors position="top-right" closeButton />
    </Card>
  )
}

export function QuickPlay() {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <QuickPlayImpl />
    </QueryClientProvider>
  )
}
