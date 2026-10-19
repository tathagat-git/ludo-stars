// Lobby API: leave a waiting game.
//
// POST /api/lobby/[code]/leave
//   Removes the current user's GamePlayer row + clears the matching
//   playerNId on the Game. If the user was the host (seat 0) and other
//   humans remain, the host seat is reassigned to the next human (so the
//   room doesn't lose its host). If no humans remain AND the game is still
//   waiting, the game row is deleted entirely (it was never started).
//
// Idempotent — leaving a game you're not in returns 200 with `{ left: false }`.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { SEAT_TO_PLAYER_FIELD, toLobbyGameDTO } from '@/lib/lobby'

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

  if (game.status !== 'waiting') {
    return NextResponse.json(
      { error: 'Cannot leave a game that has already started' },
      { status: 400 },
    )
  }

  const myPlayer = game.players.find(
    (p) => !p.isBot && p.userId === userId,
  )

  if (!myPlayer) {
    return NextResponse.json({ left: false })
  }

  const mySeat = myPlayer.seat
  const myField = SEAT_TO_PLAYER_FIELD[mySeat] as
    | 'player1Id'
    | 'player2Id'
    | 'player3Id'
    | 'player4Id'

  const remainingHumans = game.players.filter(
    (p) => !p.isBot && p.userId !== userId,
  )

  await db.$transaction(async (tx) => {
    // Remove the player row.
    await tx.gamePlayer.delete({ where: { id: myPlayer.id } })

    if (mySeat === 0 && remainingHumans.length > 0) {
      // Promote the next human (lowest seat) to be the new host (seat 0):
      // swap playerNId fields so seat 0 holds the new host.
      const promoted = remainingHumans.slice().sort((a, b) => a.seat - b.seat)[0]!
      const promotedField = SEAT_TO_PLAYER_FIELD[promoted.seat] as
        | 'player1Id'
        | 'player2Id'
        | 'player3Id'
        | 'player4Id'

      // Reassign seat numbers in GamePlayer rows.
      if (promoted.seat !== 0) {
        await tx.gamePlayer.update({
          where: { id: promoted.id },
          data: { seat: 0 },
        })
      }

      // Set player1Id = promoted user, clear promoted's old slot.
      await tx.game.update({
        where: { id: game.id },
        data: {
          [myField]: promoted.userId,
          [promotedField]: null,
        },
      })
    } else {
      // Just clear the slot on the Game row.
      await tx.game.update({
        where: { id: game.id },
        data: { [myField]: null },
      })

      // If no humans remain, delete the waiting room entirely.
      if (remainingHumans.length === 0) {
        await tx.game.delete({ where: { id: game.id } })
      }
    }
  })

  // Refetch (may be deleted).
  const refreshed = await db.game.findUnique({
    where: { id: game.id },
    include: {
      players: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { seat: 'asc' },
      },
    },
  })

  return NextResponse.json({
    left: true,
    game: refreshed
      ? toLobbyGameDTO(
          refreshed as unknown as Parameters<typeof toLobbyGameDTO>[0],
        )
      : null,
  })
}
