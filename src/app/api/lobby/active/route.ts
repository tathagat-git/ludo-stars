// Lobby API: list active (joinable) games.
//
// GET /api/lobby/active
//   Returns up to 20 games with status `waiting` that have at least one
//   human player and are not yet full. Used by the "Browse open rooms"
//   panel in the join-game dialog. Ordered by most-recently-created first.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { toLobbyGameDTO } from '@/lib/lobby'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pull all waiting games with players; filter "joinable" in JS since the
  // "not full + has human" condition is easier to express via playerCount.
  const games = await db.game.findMany({
    where: { status: 'waiting' },
    include: {
      players: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { seat: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 60, // over-fetch, filter in JS, trim to 20
  })

  const joinable = games
    .map((g) =>
      toLobbyGameDTO(g as unknown as Parameters<typeof toLobbyGameDTO>[0]),
    )
    .filter((dto) => {
      const isFull = dto.playerCount >= dto.maxPlayers
      const hasHuman = dto.humanCount > 0
      return !isFull && hasHuman
    })
    .slice(0, 20)

  return NextResponse.json({ games: joinable })
}
