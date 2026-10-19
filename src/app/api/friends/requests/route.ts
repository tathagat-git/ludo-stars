import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/friends/requests
 * Returns pending incoming friend requests for the current user, with sender
 * profile info. Used to render the "Requests" tab in the FriendsPanel.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const requests = await db.friendRequest.findMany({
    where: { toId: userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      from: {
        select: { id: true, username: true, name: true, avatar: true },
      },
    },
  })

  const data = requests.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    from: r.from,
  }))

  return NextResponse.json({ requests: data })
}

/**
 * POST /api/friends/requests
 * Body: { toUserId: string }
 * Creates a pending FriendRequest from the current user to toUserId.
 * Guard rails:
 *   - rejects self-requests
 *   - rejects if already friends (either direction)
 *   - rejects if a (pending OR accepted OR declined) request already exists
 *     in either direction — we reuse the existing row instead of erroring,
 *     returning 200 with a "request exists" hint, EXCEPT when the existing
 *     request was declined, in which case we flip it back to pending so the
 *     sender can retry (this matches typical social UX).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const fromId = session.user.id

  let body: { toUserId?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const toUserId =
    typeof body.toUserId === 'string' ? body.toUserId.trim() : ''
  if (!toUserId) {
    return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
  }
  if (toUserId === fromId) {
    return NextResponse.json(
      { error: 'Cannot send a friend request to yourself' },
      { status: 400 }
    )
  }

  // Target user must exist.
  const target = await db.user.findUnique({
    where: { id: toUserId },
    select: { id: true },
  })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Already friends?
  const existingFriendship = await db.friendship.findFirst({
    where: {
      OR: [
        { fromId, toId: toUserId },
        { fromId: toUserId, toId: fromId },
      ],
    },
    select: { id: true },
  })
  if (existingFriendship) {
    return NextResponse.json(
      { error: 'You are already friends with this user' },
      { status: 409 }
    )
  }

  // Existing request in either direction?
  const existingRequest = await db.friendRequest.findFirst({
    where: {
      OR: [
        { fromId, toId: toUserId },
        { fromId: toUserId, toId: fromId },
      ],
    },
  })

  if (existingRequest) {
    // If there's a pending incoming request FROM them to me, auto-accept it
    // instead of creating a duplicate — this is the "Add Friend" button on a
    // user who already sent me a request: respond by accepting.
    if (
      existingRequest.fromId === toUserId &&
      existingRequest.toId === fromId &&
      existingRequest.status === 'pending'
    ) {
      // Accept on their behalf — creates friendship both ways.
      await db.$transaction([
        db.friendship.create({ data: { fromId, toId: toUserId } }),
        db.friendship.create({ data: { fromId: toUserId, toId: fromId } }),
        db.friendRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'accepted' },
        }),
      ])
      return NextResponse.json({
        message: 'You are now friends',
        autoAccepted: true,
      })
    }

    // Existing request in some other state — update if declined, else no-op.
    if (existingRequest.status === 'declined' && existingRequest.fromId === fromId) {
      const updated = await db.friendRequest.update({
        where: { id: existingRequest.id },
        data: { status: 'pending' },
      })
      return NextResponse.json({ request: updated, reactivated: true })
    }

    return NextResponse.json(
      { error: 'A friend request already exists between you and this user' },
      { status: 409 }
    )
  }

  const request = await db.friendRequest.create({
    data: { fromId, toId: toUserId, status: 'pending' },
  })
  return NextResponse.json({ request }, { status: 201 })
}
