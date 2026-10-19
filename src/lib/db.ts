import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Only log queries in development; keep production output clean.
const isProd = process.env.NODE_ENV === 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
