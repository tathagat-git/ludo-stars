'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Route-level error boundary (catches errors in the `/` route segment while
 * keeping the root layout shell intact). This is preferable to
 * `global-error.tsx` (which replaces the entire document) for recoverable
 * in-app errors.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="bg-destructive/10 text-destructive flex size-16 items-center justify-center rounded-full">
        <AlertTriangle className="size-8" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="size-4" aria-hidden />
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = '/'
          }}
        >
          Go home
        </Button>
      </div>
      {error.digest && (
        <p className="text-muted-foreground/70 font-mono text-xs">
          Error ID: {error.digest}
        </p>
      )}
    </main>
  )
}
