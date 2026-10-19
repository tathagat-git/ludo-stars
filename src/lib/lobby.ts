// Lobby helpers: room-code generation, shared types, serializers.

import { Game, GamePlayer, User } from '@prisma/client'

/// 6-char room code: uppercase A-Z and 2-9 (no zero/O ambiguity).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateRoomCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

/// Generates codes until `isUnique` returns true. Used to guarantee a
/// unique room code (extremely unlikely to collide for 6 chars but possible).
export async function generateUniqueRoomCode(
  exists: (code: string) => Promise<boolean>,
  maxAttempts = 12,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRoomCode()
    if (!(await exists(code))) return code
  }
  // Extremely unlikely fallback: append a digit.
  return generateRoomCode() + Math.floor(Math.random() * 10)
}

export type GameMode = 'classic' | 'twist'
export type GameStatus = 'waiting' | 'playing' | 'finished'

/// Lightweight DTO for the lobby list / preview UI. Avoids leaking User.email
/// and other private fields.
export interface LobbyGamePlayerDTO {
  id: string
  seat: number
  isBot: boolean
  botName: string | null
  userId: string | null
  username: string | null
  finalRank: number | null
}

export interface LobbyGameDTO {
  id: string
  code: string
  mode: string
  maxPlayers: number
  botCount: number
  status: string
  winnerId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  playerCount: number
  humanCount: number
  players: LobbyGamePlayerDTO[]
}

/// Serializes a full Game (with players + nested user) into a safe DTO.
export function toLobbyGameDTO(
  game: Game & {
    players: (GamePlayer & { user: User | null })[]
  },
): LobbyGameDTO {
  let humanCount = 0
  const players: LobbyGamePlayerDTO[] = game.players.map((p) => {
    if (!p.isBot && p.userId) humanCount += 1
    return {
      id: p.id,
      seat: p.seat,
      isBot: p.isBot,
      botName: p.botName,
      userId: p.userId,
      username: p.user?.username ?? null,
      finalRank: p.finalRank,
    }
  })
  return {
    id: game.id,
    code: game.code,
    mode: game.mode,
    maxPlayers: game.maxPlayers,
    botCount: game.botCount,
    status: game.status,
    winnerId: game.winnerId,
    startedAt: game.startedAt?.toISOString() ?? null,
    finishedAt: game.finishedAt?.toISOString() ?? null,
    createdAt: game.createdAt.toISOString(),
    playerCount: players.length,
    humanCount,
    players: players.sort((a, b) => a.seat - b.seat),
  }
}

/// Map seat index → playerNId field name on the Game model.
export const SEAT_TO_PLAYER_FIELD: Record<number, keyof Game> = {
  0: 'player1Id',
  1: 'player2Id',
  2: 'player3Id',
  3: 'player4Id',
} as const

/// Inverse map.
export const PLAYER_FIELD_TO_SEAT: Record<string, number> = {
  player1Id: 0,
  player2Id: 1,
  player3Id: 2,
  player4Id: 3,
}

/// Color per seat (matches engine COLORS ordering).
export const SEAT_COLORS = ['red', 'green', 'yellow', 'blue'] as const
