'use client'

import * as React from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * AppProviders — the top-level client providers used by `src/app/layout.tsx`.
 *
 * Composition order (outer → inner):
 *   <SessionProvider>   — next-auth client session context (useSession)
 *   <ThemeProvider>     — next-themes (class attribute, light/dark/system)
 *
 * NOTE on Task 4-a ownership:
 *   Task 4-a owns `src/components/providers.tsx` (which it may build as a
 *   thin re-export of `next-auth/react`'s SessionProvider for client
 *   components).  To avoid editing a file that another agent owns, this file
 *   (`app-providers.tsx`) is the single composition point used by the layout
 *   and pulls SessionProvider directly from `next-auth/react` plus our local
 *   ThemeProvider.  This keeps Task 4-a's providers.tsx free to evolve.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Stable QueryClient for the whole app session.
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
