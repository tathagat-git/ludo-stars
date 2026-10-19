// Lobby API: start a game (persist status).
//
// POST /api/lobby/[code]/start
//   Marks the Game row as `playing` with `startedAt = now()`. The actual
//   game-start handshake (initial dice roll, seat assignment, broadcast)
//   happens over socket.io in the game-service mini-service — this route
//   is purely the persistence layer.
//
// Only the host (player1Id = current user) may start the game. The game
// must currently be in `waiting` status.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { toLobbyGameDTO } from '@/lib/lobby'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
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

  if (game.player1Id !== userId) {
    return NextResponse.json(
      { error: 'Only the host can start the game' },
      { status: 403 },
    )
  }

  if (game.status === 'playing') {
    // Idempotent.
    return NextResponse.json({
      game: toLobbyGameDTO(
        game as unknown as Parameters<typeof toLobbyGameDTO>[0],
      ),
      alreadyStarted: true,
    })
  }

  if (game.status === 'finished') {
    return NextResponse.json(
      { error: 'Game has already finished' },
      { status: 400 },
    )
  }

  // Must have at least 2 seats filled (humans or bots).
  const filled = game.players.length
  if (filled < 2) {
    return NextResponse.json(
      { error: 'Need at least 2 players to start' },
      { status: 400 },
    )
  }

  const updated = await db.game.update({
    where: { id: game.id },
    data: {
      status: 'playing',
      startedAt: new Date(),
    },
    include: {
      players: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { seat: 'asc' },
      },
    },
  })

  return NextResponse.json({
    game: toLobbyGameDTO(
      updated as unknown as Parameters<typeof toLobbyGameDTO>[0],
    ),
  })
}
