import { Loader2 } from 'lucide-react'

/**
 * Route-level loading fallback shown while the `/` server component is
 * resolving (e.g., fetching the session + game config). Keeps the sticky
 * footer layout intact.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="text-primary size-8 animate-spin" aria-label="Loading" />
        <p className="text-muted-foreground text-sm">Loading Ludo Stars…</p>
      </main>
    </div>
  )
}
