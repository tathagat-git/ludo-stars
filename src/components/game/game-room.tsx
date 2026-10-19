'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Copy,
  Check,
  Users,
  LogOut,
  Bot,
  UserPlus,
  UserMinus,
  Play,
  CheckCircle2,
  Circle,
  WifiOff,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGameRoom, type SeatInfo } from '@/lib/ludo/client'
import { COLORS } from '@/lib/ludo/engine'
import { COLOR_BG, COLOR_DOT } from '@/lib/ludo/board'
import { cn } from '@/lib/utils'
import { LudoBoard } from './ludo-board'
import { Dice } from './dice'
import { PlayerCard } from './player-card'
import { ChatPanel } from './chat-panel'
import { GameOverModal } from './game-over-modal'

interface GameRoomProps {
  code: string
  userId: string
  username: string
  mode: 'classic' | 'twist'
  maxPlayers: number
  onExit: () => void
}

export function GameRoom({
  code,
  userId,
  username,
  mode,
  maxPlayers,
  onExit,
}: GameRoomProps) {
  const {
    connected,
    room,
    gameState,
    lastEvent,
    chat,
    error,
    mySeat,
    isMyTurn,
    legalMoves,
    roll,
    move,
    sendMessage,
    setReady,
    startGame,
    addBot,
    removeBot,
    leaveRoom,
  } = useGameRoom(code, userId, username, { mode, maxPlayers })

  const [copied, setCopied] = useState(false)
  const isHost = room?.hostUserId === userId
  // Server uses `started` (boolean) and `phase` to track lifecycle.
  const started = !!room?.started || !!gameState
  const status: 'waiting' | 'playing' | 'finished' = !started
    ? 'waiting'
    : gameState?.phase === 'gameover'
      ? 'finished'
      : 'playing'

  // ── Surface websocket / room errors via toast (visible in BOTH lobby and
  // in-game views). The lobby view also shows a banner; in-game we rely on
  // the toast so we don't obscure the board.
  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const handleLeave = () => {
    leaveRoom()
    onExit()
  }

  // ── Auto-bot-fill + auto-start (for "Play vs Bots" & pre-configured rooms) ──
  // Reads `bots` and `autostart` from the URL query. When the host joins a
  // fresh room, pre-fills the requested bot seats; if `autostart=1`, starts
  // the game once the room is full.
  const autoFillDone = useRef(false)
  useEffect(() => {
    if (autoFillDone.current) return
    if (!room || !isHost || started) return
    if (room.seats.length === 0) return // not joined yet

    const params = new URLSearchParams(window.location.search)
    const wantBots = Number(params.get('bots') ?? '0')
    const autostart = params.get('autostart') === '1'
    if (!wantBots && !autostart) {
      autoFillDone.current = true
      return
    }

    const currentBots = room.seats.filter((s) => s.isBot).length
    const humans = room.seats.filter((s) => !s.isBot).length
    const targetBots = Math.min(wantBots, room.maxPlayers - humans)
    const botsToAdd = targetBots - currentBots

    if (botsToAdd > 0) {
      // Add bots one at a time; the effect re-runs as room updates (room is a
      // dep). Each run adds one bot until we reach the target.
      addBot()
      return
    }

    // All bots added. Auto-start if requested and room is full enough.
    if (autostart && room.seats.length >= 2) {
      autoFillDone.current = true
      startGame()
    } else {
      autoFillDone.current = true
    }
  }, [room, isHost, started, addBot, startGame])

  // ── LOBBY (waiting) ────────────────────────────────────────────────────────
  if (status === 'waiting' || !gameState) {
    return (
      <LobbyView
        code={code}
        connected={connected}
        seats={room?.seats ?? []}
        maxPlayers={room?.maxPlayers ?? 4}
        isHost={isHost}
        myUserId={userId}
        error={error}
        chat={chat}
        onSend={sendMessage}
        onCopy={handleCopyCode}
        copied={copied}
        onReady={setReady}
        onStart={startGame}
        onAddBot={addBot}
        onRemoveBot={removeBot}
        onLeave={handleLeave}
      />
    )
  }

  // ── IN-GAME ────────────────────────────────────────────────────────────────
  const players = gameState.players
  const currentPlayer = players[gameState.currentSeat]
  const sortedWinners = gameState.winners
  const isGameOver = gameState.phase === 'gameover'

  return (
    <main className="from-background via-background to-muted/30 flex min-h-screen flex-col bg-gradient-to-br">
      {/* Header */}
      <header className="bg-card/80 flex items-center justify-between gap-2 border-b px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            ROOM {code}
          </Badge>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              connected ? 'text-emerald-600' : 'text-amber-600 dark:text-amber-400',
            )}
            aria-live="polite"
          >
            {connected ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5 animate-pulse" aria-hidden />
                <span>Reconnecting…</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[40px]"
            onClick={handleCopyCode}
            aria-label={copied ? 'Room code copied' : 'Copy room code'}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy code'}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="min-h-[40px]"
            onClick={handleLeave}
            aria-label="Leave room"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>

      {/* Reconnecting banner — visible only when the socket drops mid-game */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center gap-2 overflow-hidden border-b bg-amber-500/10 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-300"
            role="status"
          >
            <WifiOff className="size-3.5 animate-pulse" aria-hidden />
            Connection lost — trying to reconnect…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-3 lg:flex-row lg:p-4">
        {/* Board + players */}
        <section className="flex flex-1 flex-col items-center gap-3">
          {/* Player cards — auto-fit grid scales cleanly from 2 to 6 players.
              Each card has a min-width so they wrap nicely on mobile. */}
          <div
            className="grid w-full max-w-3xl gap-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
            }}
          >
            {players.map((p) => (
              <PlayerCard
                key={p.seat}
                player={p}
                tokens={gameState.tokens.filter((t) => t.seat === p.seat)}
                isCurrent={gameState.currentSeat === p.seat}
                isYou={mySeat === p.seat}
                compact
              />
            ))}
          </div>

          {/* Board */}
          <LudoBoard
            state={gameState}
            mySeat={mySeat}
            onTokenClick={(tokenId, dir) => move(tokenId, dir)}
            highlightLegal={isMyTurn && gameState.phase === 'move'}
          />

          {/* Dice */}
          <div className="w-full max-w-xs">
            <Dice
              value={gameState.dice}
              rolling={lastEvent?.type === 'roll'}
              onRoll={roll}
              canRoll={isMyTurn && gameState.phase === 'roll'}
              currentSeat={gameState.currentSeat}
              isMyTurn={isMyTurn}
              phase={gameState.phase}
              playerName={currentPlayer?.name}
            />
          </div>

          {/* Last event ticker */}
          <EventTicker event={lastEvent} players={players} />
        </section>

        {/* Chat panel (desktop right side, mobile below) */}
        <aside className="flex h-64 w-full flex-col lg:h-auto lg:w-80">
          <ChatPanel messages={chat} onSend={sendMessage} className="h-full" />
        </aside>
      </div>

      {/* Game over modal */}
      <GameOverModal
        open={isGameOver}
        players={players}
        winners={sortedWinners}
        onExit={handleLeave}
      />
    </main>
  )
}

// ─── Lobby view ──────────────────────────────────────────────────────────────

interface LobbyViewProps {
  code: string
  connected: boolean
  seats: SeatInfo[]
  maxPlayers: number
  isHost: boolean
  myUserId: string
  error: string | null
  chat: ReturnType<typeof useGameRoom>['chat']
  onSend: (msg: string) => void
  onCopy: () => void
  copied: boolean
  onReady: () => void
  onStart: () => void
  onAddBot: () => void
  onRemoveBot: (seat: number) => void
  onLeave: () => void
}

function LobbyView(props: LobbyViewProps) {
  const {
    code,
    connected,
    seats,
    maxPlayers,
    isHost,
    myUserId,
    error,
    chat,
    onSend,
    onCopy,
    copied,
    onReady,
    onStart,
    onAddBot,
    onRemoveBot,
    onLeave,
  } = props

  const filledSeats = seats.length
  const humans = seats.filter((s) => !s.isBot)
  const humansReady = humans.length > 0 && humans.every((s) => s.ready)
  const allReady = filledSeats >= 2 && humansReady
  const mySeatInfo = seats.find((s) => s.userId === myUserId)

  return (
    <main className="from-background via-background to-muted/30 flex min-h-screen flex-col bg-gradient-to-br">
      <header className="bg-card/80 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">Ludo Stars — Lobby</h1>
          <p className="text-muted-foreground text-xs">Waiting for players…</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="min-h-[40px]"
          onClick={onLeave}
        >
          <LogOut className="size-4" /> Leave
        </Button>
      </header>

      <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
        {/* Room info + seat list */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="size-5" /> Room Code
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                onClick={onCopy}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="font-mono text-3xl font-bold tracking-widest">{code}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {connected ? 'Connected' : 'Connecting…'} · {filledSeats}/{maxPlayers}{' '}
                players
              </p>
            </div>

            {error && (
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                {error}
              </p>
            )}

            {/* Seat list */}
            <ul className="flex flex-col gap-2">
              {Array.from({ length: maxPlayers }).map((_, seatIdx) => {
                const info = seats.find((s) => s.seat === seatIdx)
                const color = COLORS[seatIdx]!
                const isMe = info?.userId === myUserId
                return (
                  <li
                    key={seatIdx}
                    className={cn(
                      'border-border bg-card flex items-center gap-3 rounded-lg border p-2',
                      info && 'shadow-sm',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-8 place-items-center rounded-full text-xs font-bold text-white',
                        COLOR_BG[color],
                      )}
                    >
                      {seatIdx + 1}
                    </span>
                    {info ? (
                      <>
                        <span
                          className={cn('size-3 rounded-full', COLOR_DOT[color])}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{info.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {info.isBot ? 'Bot' : info.isHost ? 'Host' : 'Player'}
                            {info.ready && !info.isBot && ' · Ready'}
                          </p>
                        </div>
                        {info.isBot && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Bot className="size-3" />
                            BOT
                          </Badge>
                        )}
                        {info.ready && !info.isBot && (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        )}
                        {!info.ready && !info.isBot && (
                          <Circle className="text-muted-foreground size-4" />
                        )}
                        {info.isBot && isHost && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Remove bot"
                            onClick={() => onRemoveBot(seatIdx)}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <span
                          className={cn(
                            'size-3 rounded-full border border-dashed',
                            COLOR_DOT[color],
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-muted-foreground text-sm">Empty seat</p>
                          <p className="text-muted-foreground text-xs">
                            Waiting for player…
                          </p>
                        </div>
                        {isHost && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[40px]"
                            onClick={onAddBot}
                          >
                            <UserPlus className="size-4" /> Add Bot
                          </Button>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            {/* Action buttons */}
            <div className="mt-auto flex flex-col gap-2">
              {mySeatInfo && !mySeatInfo.isBot && !mySeatInfo.ready && (
                <Button className="min-h-[44px]" onClick={onReady}>
                  <CheckCircle2 className="size-4" /> I'm Ready
                </Button>
              )}
              {isHost && (
                <Button
                  className="min-h-[44px]"
                  onClick={onStart}
                  disabled={!allReady}
                  title={!allReady ? 'Wait for all players to be ready' : undefined}
                >
                  <Play className="size-4" /> Start Game
                </Button>
              )}
              {!isHost && !allReady && (
                <p className="text-muted-foreground text-center text-xs">
                  Waiting for the host to start the game…
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <ChatPanel messages={chat} onSend={onSend} className="h-full min-h-[300px]" />
      </div>
    </main>
  )
}

// ─── Last event ticker ───────────────────────────────────────────────────────

function EventTicker({
  event,
  players,
}: {
  event: ReturnType<typeof useGameRoom>['lastEvent']
  players: { seat: number; name: string }[]
}) {
  const text = (() => {
    if (!event) return 'Waiting for the first move…'
    if (event.type === 'gameover') return 'Game over!'
    // All non-gameover variants have either `seat` or `bySeat`.
    const seat = 'seat' in event ? event.seat : 'bySeat' in event ? event.bySeat : 0
    const p = players[seat]
    const name = p?.name ?? 'Player'
    switch (event.type) {
      case 'roll':
        return `${name} rolled a ${event.dice}.`
      case 'move':
        return `${name} moved a token ${event.direction}.`
      case 'pass':
        return `${name} passed (${event.reason}).`
      case 'capture':
        return `${name} captured an opponent's token!`
      case 'finish':
        return `${name} finished (rank #${event.rank})!`
      case 'turn':
        return `${name}'s turn.`
      default:
        return ''
    }
  })()

  return (
    <div className="flex h-6 items-center justify-center" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.p
          key={text}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="text-muted-foreground text-center text-xs"
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

export default GameRoom
