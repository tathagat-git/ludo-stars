// Lobby API: finish a game (persist final results).
//
// POST /api/lobby/[code]/finish
//   Body: { winners: number[] } — list of seats in finish order
//   (index 0 = first place, index 1 = second place, ...).
//   Seats not present in the array are considered unfinished (no rank).
//
//   Updates the Game row: status = `finished`, finishedAt = now(),
//   winnerId = first winner's userId (or null if the first winner is a bot).
//   Sets each GamePlayer.finalRank based on position in the winners array.
//   Increments User.wins for the 1st-place user, User.losses for the
//   other human users, User.gamesPlayed for every human participant.
//
//   Idempotent — calling again on a finished game returns the persisted
//   state without re-applying stat increments.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { toLobbyGameDTO } from '@/lib/lobby'

export const dynamic = 'force-dynamic'

interface FinishBody {
  winners?: number[]
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { code } = await ctx.params

  let body: FinishBody = {}
  try {
    body = (await req.json()) as FinishBody
  } catch {
    body = {}
  }
  const winners = Array.isArray(body.winners)
    ? body.winners.filter((s) => Number.isInteger(s) && s >= 0 && s <= 3)
    : []
  if (winners.length === 0) {
    return NextResponse.json(
      { error: 'winners array must contain at least one seat' },
      { status: 400 },
    )
  }

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

  // Idempotent: already finished → just return the persisted state.
  if (game.status === 'finished') {
    return NextResponse.json({
      game: toLobbyGameDTO(
        game as unknown as Parameters<typeof toLobbyGameDTO>[0],
      ),
      alreadyFinished: true,
    })
  }

  // Build seat → rank (0-indexed) map.
  const seatToRank = new Map<number, number>()
  winners.forEach((seat, idx) => {
    if (!seatToRank.has(seat)) seatToRank.set(seat, idx + 1) // 1-indexed rank
  })

  // Determine winnerId = userId of first winner (null if bot or no user).
  const firstWinnerSeat = winners[0]!
  const firstWinnerPlayer = game.players.find((p) => p.seat === firstWinnerSeat)
  const winnerId =
    firstWinnerPlayer && !firstWinnerPlayer.isBot
      ? firstWinnerPlayer.userId
      : null

  await db.$transaction(async (tx) => {
    // 1. Update the Game row.
    await tx.game.update({
      where: { id: game.id },
      data: {
        status: 'finished',
        finishedAt: new Date(),
        winnerId,
      },
    })

    // 2. Update each GamePlayer.finalRank.
    for (const p of game.players) {
      const rank = seatToRank.has(p.seat) ? seatToRank.get(p.seat)! : null
      await tx.gamePlayer.update({
        where: { id: p.id },
        data: { finalRank: rank },
      })
    }

    // 3. Update User stats for human participants only.
    const humanPlayers = game.players.filter((p) => !p.isBot && p.userId)
    for (const p of humanPlayers) {
      if (!p.userId) continue
      const rank = seatToRank.get(p.seat) ?? null
      const isWinner = rank === 1
      await tx.user.update({
        where: { id: p.userId },
        data: {
          gamesPlayed: { increment: 1 },
          wins: isWinner ? { increment: 1 } : undefined,
          losses: !isWinner ? { increment: 1 } : undefined,
        },
      })
    }
  })

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
    game: toLobbyGameDTO(
      refreshed as unknown as Parameters<typeof toLobbyGameDTO>[0],
    ),
  })
}
