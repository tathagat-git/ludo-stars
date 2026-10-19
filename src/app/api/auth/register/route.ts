import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(
      /^[A-Za-z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores',
    ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return NextResponse.json(
      { error: firstError?.message ?? 'Validation failed' },
      { status: 400 },
    )
  }

  const { email, username, password } = parsed.data
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim()

  // Check email uniqueness
  const existingEmail = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existingEmail) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 },
    )
  }

  // Check username uniqueness (case-insensitive not necessary — schema is exact)
  const existingUsername = await db.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  })
  if (existingUsername) {
    return NextResponse.json({ error: 'This username is already taken' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      name: normalizedUsername,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
    },
  })

  return NextResponse.json({ ok: true, user }, { status: 201 })
}
