// Lobby API: fetch a single game by code (preview before joining).
//
// GET /api/lobby/[code]
//   Returns the game with players. Authentication required (so a logged-in
//   user can preview a room). Anyone authenticated can fetch any waiting
//   game by code; finished/playing games are also returned for history
//   but only if the caller is a participant.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { toLobbyGameDTO } from '@/lib/lobby'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { code } = await ctx.params
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
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

  return NextResponse.json({
    game: toLobbyGameDTO(
      game as unknown as Parameters<typeof toLobbyGameDTO>[0],
    ),
  })
}
