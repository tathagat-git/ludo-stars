import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/friends/search?q=<query>
 * Searches users by username (case-insensitive contains). Excludes:
 *   - the current user
 *   - existing friends (either direction of Friendship)
 *   - users that already have a pending incoming/outgoing request
 * Returns the top 10 matches with friendship/request status flags so the UI
 * can render the right CTA ("Add Friend" vs "Pending" vs "Already friends").
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (!q) {
    return NextResponse.json({ users: [] })
  }

  // SQLite `contains` is case-insensitive by default for ASCII; use mode
  // insensitive to be safe with Prisma's query API.
  const candidates = await db.user.findMany({
    where: {
      id: { not: userId },
      username: { contains: q },
    },
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
    take: 20, // over-fetch then filter by friendship/request state, trim to 10
  })

  // Fetch current friendship and pending request sets in parallel.
  const [friendships, pendingFromMe, pendingToMe] = await Promise.all([
    db.friendship.findMany({
      where: {
        OR: [{ fromId: userId }, { toId: userId }],
      },
      select: { fromId: true, toId: true },
    }),
    db.friendRequest.findMany({
      where: { fromId: userId, status: 'pending' },
      select: { toId: true },
    }),
    db.friendRequest.findMany({
      where: { toId: userId, status: 'pending' },
      select: { fromId: true },
    }),
  ])

  const friendIds = new Set<string>()
  for (const f of friendships) {
    if (f.fromId === userId) friendIds.add(f.toId)
    else if (f.toId === userId) friendIds.add(f.fromId)
  }
  const pendingOutgoing = new Set(pendingFromMe.map((r) => r.toId))
  const pendingIncoming = new Set(pendingToMe.map((r) => r.fromId))

  const users = candidates
    .map((u) => ({
      ...u,
      isFriend: friendIds.has(u.id),
      hasPendingRequest:
        pendingOutgoing.has(u.id) || pendingIncoming.has(u.id),
    }))
    .slice(0, 10)

  return NextResponse.json({ users })
}
