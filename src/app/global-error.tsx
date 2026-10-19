'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Global error boundary for the App Router.
 *
 * Catches any unhandled runtime error thrown during render of the route
 * segment (and its children) and shows a friendly recovery UI instead of a
 * blank screen. The user can retry, which resets the error boundary.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="bg-destructive/10 text-destructive flex size-16 items-center justify-center rounded-full">
            <AlertTriangle className="size-8" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred while loading the page. You can try again —
              your game state is preserved.
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
      </body>
    </html>
  )
}
