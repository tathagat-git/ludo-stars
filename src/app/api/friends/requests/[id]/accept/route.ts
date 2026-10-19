import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * POST /api/friends/requests/[id]/accept
 * Accepts a pending friend request addressed to the current user.
 * Transactionally:
 *   1. Creates both directional Friendship rows (from->to AND to->from),
 *      using upserts so a partial prior state is idempotent.
 *   2. Marks the FriendRequest as `accepted`.
 * The `[id]` is the FriendRequest.id.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id: requestId } = await params

  const request = await db.friendRequest.findUnique({
    where: { id: requestId },
    select: { id: true, fromId: true, toId: true, status: true },
  })

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (request.toId !== userId) {
    return NextResponse.json(
      { error: 'This request is not addressed to you' },
      { status: 403 }
    )
  }
  if (request.status !== 'pending') {
    return NextResponse.json(
      { error: `Request is already ${request.status}` },
      { status: 409 }
    )
  }

  await db.$transaction([
    // Create both friendship directions (idempotent via upsert — the unique
    // constraint is @@unique([fromId, toId])).
    db.friendship.upsert({
      where: { fromId_toId: { fromId: request.fromId, toId: request.toId } },
      update: {},
      create: { fromId: request.fromId, toId: request.toId },
    }),
    db.friendship.upsert({
      where: { fromId_toId: { fromId: request.toId, toId: request.fromId } },
      update: {},
      create: { fromId: request.toId, toId: request.fromId },
    }),
    db.friendRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' },
    }),
  ])

  return NextResponse.json({ ok: true })
}
