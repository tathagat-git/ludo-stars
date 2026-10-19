import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * DELETE /api/friends/[id]/remove
 * Removes the friendship between the current user and the target user `[id]`.
 * Deletes BOTH directional Friendship rows and any FriendRequest rows that
 * ever linked the two users (pending/accepted/declined), so a future re-add
 * starts from a clean slate.
 *
 * `[id]` is the OTHER user's id (not a friendship row id) — the UI passes the
 * friend's user id directly.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id: otherUserId } = await params

  if (otherUserId === userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  await db.$transaction([
    db.friendship.deleteMany({
      where: {
        OR: [
          { fromId: userId, toId: otherUserId },
          { fromId: otherUserId, toId: userId },
        ],
      },
    }),
    db.friendRequest.deleteMany({
      where: {
        OR: [
          { fromId: userId, toId: otherUserId },
          { fromId: otherUserId, toId: userId },
        ],
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
