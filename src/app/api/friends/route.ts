import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/friends
 * Returns the current user's friends list. A friendship is stored as a
 * directional row (fromId -> toId) but conceptually undirected, so we look
 * at both sides. Each entry returns the OTHER user's public profile plus a
 * mock online flag (always false — real presence is owned by the
 * game-service websocket mini-service, see Task 5).
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // Fetch both directions in parallel.
  const [fromRows, toRows] = await Promise.all([
    db.friendship.findMany({
      where: { fromId: userId },
      select: {
        id: true,
        to: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    }),
    db.friendship.findMany({
      where: { toId: userId },
      select: {
        id: true,
        from: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    }),
  ])

  // Normalize both sides into a single friend list.
  const friends = [
    ...fromRows.map((r) => ({ friendshipId: r.id, ...r.to })),
    ...toRows.map((r) => ({ friendshipId: r.id, ...r.from })),
  ].map(({ friendshipId, ...user }) => ({
    ...user,
    friendshipId,
    online: false, // mock — see game-service (Task 5) for real presence
  }))

  return NextResponse.json({ friends })
}
