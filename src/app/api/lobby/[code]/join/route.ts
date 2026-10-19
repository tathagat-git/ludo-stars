// Lobby API: join a waiting game by code.
//
// POST /api/lobby/[code]/join
//   Assigns the next free seat (1..3) to the current user. Creates a
//   GamePlayer row + sets the matching playerNId on the Game. Returns the
//   updated game.
//
// Errors:
//   404 - game not found
//   400 - game not joinable (status != waiting, or full, or already joined)
//   409 - user already in this game as a human seat

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { SEAT_TO_PLAYER_FIELD, toLobbyGameDTO } from '@/lib/lobby'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { code } = await ctx.params

  const game = await db.game.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      players: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { seat: 'asc' },
      },
    },
  })

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  if (game.status !== 'waiting') {
    return NextResponse.json({ error: 'Game is no longer joinable' }, { status: 400 })
  }

  // Already joined?
  const existing = game.players.find((p) => !p.isBot && p.userId === userId)
  if (existing) {
    // Idempotent: just return the current state.
    return NextResponse.json({
      game: toLobbyGameDTO(game as unknown as Parameters<typeof toLobbyGameDTO>[0]),
      alreadyJoined: true,
    })
  }

  // Count humans currently in the game.
  const humans = game.players.filter((p) => !p.isBot)
  const totalSeats = game.maxPlayers
  if (humans.length >= totalSeats) {
    return NextResponse.json({ error: 'Game is full' }, { status: 400 })
  }

  // Determine next free seat (0..3) not occupied by any existing GamePlayer.
  const takenSeats = new Set(game.players.map((p) => p.seat))
  let nextSeat = -1
  for (let s = 0; s < totalSeats; s++) {
    if (!takenSeats.has(s)) {
      nextSeat = s
      break
    }
  }
  if (nextSeat === -1) {
    return NextResponse.json({ error: 'No free seats' }, { status: 400 })
  }

  const playerField = SEAT_TO_PLAYER_FIELD[nextSeat] as
    'player1Id' | 'player2Id' | 'player3Id' | 'player4Id'

  // Transaction: create GamePlayer + set playerNId on Game.
  const updated = await db.$transaction(async (tx) => {
    await tx.gamePlayer.create({
      data: {
        gameId: game.id,
        userId,
        seat: nextSeat,
        isBot: false,
        botName: null,
      },
    })
    return tx.game.update({
      where: { id: game.id },
      data: { [playerField]: userId },
      include: {
        players: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { seat: 'asc' },
        },
      },
    })
  })

  return NextResponse.json({
    game: toLobbyGameDTO(updated as unknown as Parameters<typeof toLobbyGameDTO>[0]),
  })
}
