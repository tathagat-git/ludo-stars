import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * POST /api/friends/requests/[id]/decline
 * Marks a pending friend request addressed to the current user as `declined`.
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
    select: { id: true, toId: true, status: true },
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

  const updated = await db.friendRequest.update({
    where: { id: requestId },
    data: { status: 'declined' },
  })

  return NextResponse.json({ ok: true, request: updated })
}
