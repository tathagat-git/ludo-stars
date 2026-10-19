'use client'

// CreateGameDialog
// -----------------
// A shadcn `Dialog` triggered by a "Create Game" button. Form collects:
//   - mode (Classic | Twist)
//   - maxPlayers (2 | 3 | 4)
//   - botCount    (0..maxPlayers-1)
// On submit, POSTs to `/api/lobby`, then navigates to `?room=<code>`.
//
// Usage:
//   <CreateGameDialog />                            // default trigger button
//   <CreateGameDialog trigger={<MyButton />} />     // custom trigger
//
// The dialog is self-contained (manages its own open state). The `trigger`
// prop lets parents plug in a custom trigger element (e.g., the "Create
// Private Room" button on the QuickPlay card).

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dices, Loader2, Sparkles, Info } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

type Mode = 'classic' | 'twist'

interface CreateGameDialogProps {
  trigger?: React.ReactNode
}

interface CreateResponse {
  game: {
    code: string
    mode: string
    maxPlayers: number
    botCount: number
  }
  code: string
}

function gotoRoom(code: string, bots = 0) {
  // Navigate to the game room. The single-route app reads `?room=<code>`.
  // `bots` pre-fills that many bot seats (host can still adjust in-lobby).
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams({ room: code })
    if (bots > 0) params.set('bots', String(bots))
    window.location.search = `?${params.toString()}`
  }
}

export function CreateGameDialog({ trigger }: CreateGameDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>('classic')
  const [maxPlayers, setMaxPlayers] = React.useState<number>(4)
  const [botCount, setBotCount] = React.useState<number>(1)

  // Clamp botCount whenever maxPlayers changes (so we never exceed max-1).
  React.useEffect(() => {
    if (botCount > maxPlayers - 1) setBotCount(maxPlayers - 1)
  }, [maxPlayers, botCount])

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, maxPlayers, botCount }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `Failed (${res.status})`)
      }
      return (await res.json()) as CreateResponse
    },
    onSuccess: (data) => {
      toast.success(`Room ${data.code} created`)
      setOpen(false)
      // Pass the chosen botCount so the GameRoom pre-fills that many bots.
      // No `autostart` — the host reviews the lobby then starts manually.
      setTimeout(() => gotoRoom(data.code, botCount), 80)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create room'
      toast.error(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Dices className="size-4" />
            Create Game
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="size-5" />
            Create a new room
          </DialogTitle>
          <DialogDescription>
            Pick a mode and seat configuration. Bots fill empty seats automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Mode */}
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label>Game mode</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Twist mode explanation"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs leading-relaxed">
                    <strong>Classic</strong>: tokens only move forward.
                    <br />
                    <strong>Twist</strong>: tokens on the track may also move backward by
                    the dice value (bounded by their own start square). Backward landings
                    can capture opponents on non-safe squares.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="grid grid-cols-2 gap-2"
          >
            <label
              htmlFor="mode-classic"
              className="border-input has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <RadioGroupItem value="classic" id="mode-classic" className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Classic</div>
                <div className="text-muted-foreground text-xs">Forward only</div>
              </div>
            </label>
            <label
              htmlFor="mode-twist"
              className="border-input has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <RadioGroupItem value="twist" id="mode-twist" className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Twist <Sparkles className="text-primary size-3" />
                </div>
                <div className="text-muted-foreground text-xs">
                  Backward moves allowed
                </div>
              </div>
            </label>
          </RadioGroup>
        </div>

        {/* Max players */}
        <div className="grid gap-2">
          <Label htmlFor="max-players">Max players</Label>
          <Select
            value={String(maxPlayers)}
            onValueChange={(v) => setMaxPlayers(Number(v))}
          >
            <SelectTrigger id="max-players" className="w-full">
              <SelectValue placeholder="Players" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 players</SelectItem>
              <SelectItem value="3">3 players</SelectItem>
              <SelectItem value="4">4 players</SelectItem>
              <SelectItem value="5">5 players</SelectItem>
              <SelectItem value="6">6 players</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bots */}
        <div className="grid gap-2">
          <Label htmlFor="bot-count">Bots</Label>
          <Select value={String(botCount)} onValueChange={(v) => setBotCount(Number(v))}>
            <SelectTrigger id="bot-count" className="w-full">
              <SelectValue placeholder="Bots" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxPlayers }, (_, i) => i).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? 'bot' : 'bots'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Fills empty seats with AI opponents.
          </p>
        </div>

        {/* Preview chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="capitalize">
            {mode}
          </Badge>
          <Badge variant="outline">
            {maxPlayers - botCount} human{maxPlayers - botCount === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline">
            {botCount} bot{botCount === 1 ? '' : 's'}
          </Badge>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Dices className="size-4" />
            )}
            Create room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Re-export for callers that just want the input (used by QuickPlay, etc.).
export { gotoRoom }
