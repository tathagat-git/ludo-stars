// Lobby API: create + list games.
//
// POST /api/lobby
//   Body: { mode: 'classic'|'twist', maxPlayers: 2|3|4, botCount: 0..maxPlayers-1 }
//   Creates a Game row with a unique 6-char code, status `waiting`, host as
//   player1 (seat 0), plus GamePlayer rows for the host and any requested bots.
//   Returns { game: LobbyGameDTO, code: string }.
//
// GET /api/lobby
//   Returns the current user's 20 most recent games (across all statuses),
//   with player info, for the dashboard history list.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { randomBotName } from '@/lib/ludo/bot'
import {
  generateUniqueRoomCode,
  toLobbyGameDTO,
  type GameMode,
} from '@/lib/lobby'

export const dynamic = 'force-dynamic'

interface CreateBody {
  mode?: string
  maxPlayers?: number
  botCount?: number
}

/// Validate and normalise the POST body. Returns null if invalid.
function validateCreate(body: CreateBody): {
  mode: GameMode
  maxPlayers: number
  botCount: number
} | null {
  const mode = body.mode === 'twist' ? 'twist' : 'classic'
  const maxPlayers = [2, 3, 4].includes(body.maxPlayers as number)
    ? (body.maxPlayers as number)
    : 4
  const rawBot = Number(body.botCount ?? 0)
  const botCount = Number.isInteger(rawBot)
    ? Math.max(0, Math.min(rawBot, maxPlayers - 1))
    : 0
  return { mode, maxPlayers, botCount }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let body: CreateBody = {}
  try {
    body = (await req.json()) as CreateBody
  } catch {
    body = {}
  }
  const parsed = validateCreate(body)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { mode, maxPlayers, botCount } = parsed

  // Generate a unique 6-char room code.
  const code = await generateUniqueRoomCode(async (c) => {
    const found = await db.game.findUnique({
      where: { code: c },
      select: { id: true },
    })
    return !!found
  })

  // Create the Game row + GamePlayer rows in a single transaction.
  const game = await db.$transaction(async (tx) => {
    // Build GamePlayer rows: seat 0 = host (human), seats 1..botCount = bots.
    const playerRows = [
      {
        seat: 0,
        isBot: false,
        userId,
        botName: null as string | null,
      },
    ]
    for (let i = 1; i <= botCount; i++) {
      playerRows.push({
        seat: i,
        isBot: true,
        userId: null,
        botName: randomBotName(),
      })
    }

    const g = await tx.game.create({
      data: {
        code,
        mode,
        maxPlayers,
        botCount,
        status: 'waiting',
        player1Id: userId,
        players: {
          create: playerRows,
        },
      },
      include: {
        players: {
          include: { user: { select: { id: true, username: true } } },
        },
      },
    })
    return g
  })

  return NextResponse.json(
    {
      game: toLobbyGameDTO(
        game as unknown as Parameters<typeof toLobbyGameDTO>[0],
      ),
      code: game.code,
    },
    { status: 201 },
  )
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // Find games where the current user is any of the 4 player slots, OR
  // appears as a GamePlayer row with userId = current.
  const games = await db.game.findMany({
    where: {
      OR: [
        { player1Id: userId },
        { player2Id: userId },
        { player3Id: userId },
        { player4Id: userId },
        { players: { some: { userId } } },
      ],
    },
    include: {
      players: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { seat: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({
    games: games.map((g) =>
      toLobbyGameDTO(g as unknown as Parameters<typeof toLobbyGameDTO>[0]),
    ),
  })
}
