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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGameRoom, type SeatInfo } from '@/lib/ludo/client'
import { COLORS } from '@/lib/ludo/engine'
import { COLOR_BG, COLOR_DOT, COLOR_TEXT } from '@/lib/ludo/board'
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
  onExit: () => void
}

const SEAT_POSITION: Record<number, 'top' | 'bottom' | 'left' | 'right'> = {
  0: 'bottom', // red
  1: 'left', // green
  2: 'top', // yellow
  3: 'right', // blue
}

export function GameRoom({ code, userId, username, onExit }: GameRoomProps) {
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
  } = useGameRoom(code, userId, username)

  const [copied, setCopied] = useState(false)
  const isHost = room?.hostUserId === userId
  // Server uses `started` (boolean) and `phase` to track lifecycle.
  const started = !!room?.started || !!gameState
  const status: 'waiting' | 'playing' | 'finished' = !started
    ? 'waiting'
    : gameState?.phase === 'gameover'
      ? 'finished'
      : 'playing'

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

  // Seat → player map.
  const playerBySeat = (seat: number) => players[seat]

  const seatForPosition = (pos: 'top' | 'left' | 'right' | 'bottom') => {
    for (const s of Object.keys(SEAT_POSITION)) {
      if (SEAT_POSITION[+s] === pos) return +s
    }
    return 0
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b bg-card/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            ROOM {code}
          </Badge>
          <span className={cn('text-xs', connected ? 'text-emerald-600' : 'text-muted-foreground')}>
            {connected ? '● Connected' : '○ Reconnecting…'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="min-h-[40px]" onClick={handleCopyCode}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy code'}</span>
          </Button>
          <Button variant="destructive" size="sm" className="min-h-[40px]" onClick={handleLeave}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-3 lg:flex-row lg:p-4">
        {/* Board + side players */}
        <section className="flex flex-1 flex-col items-center gap-3">
          {/* Top player */}
          <div className="w-full max-w-md">
            {playerBySeat(seatForPosition('top')) ? (
              <PlayerCard
                player={playerBySeat(seatForPosition('top'))!}
                isCurrent={gameState.currentSeat === seatForPosition('top')}
                isYou={mySeat === seatForPosition('top')}
              />
            ) : (
              <EmptySeat seat={seatForPosition('top')} />
            )}
          </div>

          {/* Middle row: left player | board | right player */}
          <div className="flex w-full items-stretch justify-center gap-2 sm:gap-3">
            <div className="hidden w-32 shrink-0 sm:block">
              {playerBySeat(seatForPosition('left')) ? (
                <PlayerCard
                  player={playerBySeat(seatForPosition('left'))!}
                  isCurrent={gameState.currentSeat === seatForPosition('left')}
                  isYou={mySeat === seatForPosition('left')}
                />
              ) : (
                <EmptySeat seat={seatForPosition('left')} />
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <LudoBoard
                state={gameState}
                mySeat={mySeat}
                onTokenClick={(tokenId, dir) => move(tokenId, dir)}
                highlightLegal={isMyTurn && gameState.phase === 'move'}
              />
              {/* Mobile: inline left/right players below the board */}
              <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
                {(['left', 'right'] as const).map((pos) => {
                  const seat = seatForPosition(pos)
                  const p = playerBySeat(seat)
                  return p ? (
                    <PlayerCard
                      key={pos}
                      player={p}
                      isCurrent={gameState.currentSeat === seat}
                      isYou={mySeat === seat}
                      compact
                    />
                  ) : (
                    <EmptySeat key={pos} seat={seat} compact />
                  )
                })}
              </div>

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
            </div>

            <div className="hidden w-32 shrink-0 sm:block">
              {playerBySeat(seatForPosition('right')) ? (
                <PlayerCard
                  player={playerBySeat(seatForPosition('right'))!}
                  isCurrent={gameState.currentSeat === seatForPosition('right')}
                  isYou={mySeat === seatForPosition('right')}
                />
              ) : (
                <EmptySeat seat={seatForPosition('right')} />
              )}
            </div>
          </div>

          {/* Bottom player */}
          <div className="w-full max-w-md">
            {playerBySeat(seatForPosition('bottom')) ? (
              <PlayerCard
                player={playerBySeat(seatForPosition('bottom'))!}
                isCurrent={gameState.currentSeat === seatForPosition('bottom')}
                isYou={mySeat === seatForPosition('bottom')}
              />
            ) : (
              <EmptySeat seat={seatForPosition('bottom')} />
            )}
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
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <header className="flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">Ludo Stars — Lobby</h1>
          <p className="text-xs text-muted-foreground">Waiting for players…</p>
        </div>
        <Button variant="destructive" size="sm" className="min-h-[40px]" onClick={onLeave}>
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
              <Button variant="outline" size="sm" className="min-h-[40px]" onClick={onCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="font-mono text-3xl font-bold tracking-widest">{code}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {connected ? 'Connected' : 'Connecting…'} · {filledSeats}/{maxPlayers} players
              </p>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                      'flex items-center gap-3 rounded-lg border border-border bg-card p-2',
                      info && 'shadow-sm',
                    )}
                  >
                    <span className={cn('grid size-8 place-items-center rounded-full text-xs font-bold text-white', COLOR_BG[color])}>
                      {seatIdx + 1}
                    </span>
                    {info ? (
                      <>
                        <span
                          className={cn('size-3 rounded-full', COLOR_DOT[color])}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {info.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {info.isBot ? 'Bot' : info.isHost ? 'Host' : 'Player'}
                            {info.ready && !info.isBot && ' · Ready'}
                          </p>
                        </div>
                        {info.isBot && <Badge variant="secondary" className="text-[10px]"><Bot className="size-3" />BOT</Badge>}
                        {info.ready && !info.isBot && (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        )}
                        {!info.ready && !info.isBot && (
                          <Circle className="size-4 text-muted-foreground" />
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
                          className={cn('size-3 rounded-full border border-dashed', COLOR_DOT[color])}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Empty seat</p>
                          <p className="text-xs text-muted-foreground">Waiting for player…</p>
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
                <p className="text-center text-xs text-muted-foreground">
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

// ─── Empty seat placeholder ──────────────────────────────────────────────────

function EmptySeat({ seat, compact }: { seat: number; compact?: boolean }) {
  const color = COLORS[seat]!
  return (
    <div
      aria-label={`Empty seat ${seat + 1}`}
      className={cn(
        'flex items-center justify-center rounded-lg border border-dashed border-border bg-card/40',
        compact ? 'p-2' : 'p-3',
      )}
    >
      <span
        className={cn('rounded-full border border-dashed', COLOR_DOT[color], COLOR_TEXT[color])}
        style={{ width: 24, height: 24 }}
        aria-hidden
      />
      <span className="ml-2 text-xs text-muted-foreground">Empty</span>
    </div>
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
          className="text-center text-xs text-muted-foreground"
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

export default GameRoom
