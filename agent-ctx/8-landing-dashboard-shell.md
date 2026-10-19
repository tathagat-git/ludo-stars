# Task 8 — Landing Page, Dashboard Shell, Theme & Providers

**Agent**: shell-agent
**Task ID**: 8
**Scope**: Top-level routing (`src/app/page.tsx`, `src/app/layout.tsx`), theme
provider, dashboard shell, landing page, and shared providers.
**Status**: ✅ Complete (all owned files written, lint clean on owned files)

---

## Files I Created / Updated

| Path | Type | Notes |
| --- | --- | --- |
| `src/components/theme-provider.tsx` | new | `'use client'` next-themes wrapper (attribute="class", defaultTheme="light", enableSystem, disableTransitionOnChange). |
| `src/components/app-providers.tsx` | new | `'use client'`. Composes `<SessionProvider><ThemeProvider>{children}</ThemeProvider></SessionProvider>`. Used by `layout.tsx`. |
| `src/app/layout.tsx` | updated | Geist fonts kept. Wrapped `{children}` in `<AppProviders>`. Added `<Toaster2 />` from `@/components/ui/sonner`. Kept existing `<Toaster />`. Body now `min-h-screen flex flex-col` for sticky footer. Metadata updated to "Ludo Stars — Play Ludo with Friends & Bots". `suppressHydrationWarning` kept on `<html>`. |
| `src/app/page.tsx` | rewritten | Server component. `await searchParams`, `getServerSession(authOptions)`. Routes to `<Landing />`, `<Dashboard user={...} />`, or `<GameHost code={...} userId={...} username={...} />`. |
| `src/components/dashboard/game-host.tsx` | new | `'use client'`. Small wrapper around Task 7's `<GameRoom />` that owns the next/navigation router and forwards an `onExit` callback (`router.push('/')`). Needed because server components can't pass function callbacks to client components. |
| `src/components/landing/landing.tsx` | new | `'use client'`. Two-column hero + auth form. Warm Ludo gradient (red / yellow / green, NO indigo/blue). Mini CSS-art Ludo board preview. Sticky footer. |
| `src/components/dashboard/dashboard.tsx` | new | `'use client'`. TopNav + hero + StatsCards + main grid (QuickPlay, GameHistory on 2/3; FriendsPanel + CreateGameDialog/JoinGameDialog on 1/3). Sticky footer. |
| `src/components/dashboard/top-nav.tsx` | new | `'use client'`. Sticky top nav: logo "Ludo Stars", ThemeToggle, UserMenu. |
| `src/components/dashboard/theme-toggle.tsx` | new | `'use client'`. Sun/Moon button using `next-themes` `useTheme`. Mounted-deferred to avoid hydration mismatch. |
| `src/components/dashboard/stats-cards.tsx` | new | 4-card grid: Games / Wins / Losses / Win-Rate. Props `{ wins, losses, gamesPlayed }`. |
| `src/components/ui/footer.tsx` | new | Sticky `<footer className="mt-auto ...">` with credits + social links. |
| `src/app/globals.css` | updated | Added Tailwind v4 `@utility grid-cols-15` and `grid-rows-15` (Ludo board is 15×15). Added `.scrollbar-thin` custom scrollbar styles. Added `.bg-ludo-hero` warm radial-wash helper. Tweaked `--primary` to a warm red (`oklch(0.55 0.215 25)` light / `oklch(0.65 0.20 25)` dark) — NO indigo/blue. |

---

## Critical Decision: `app-providers.tsx` vs `providers.tsx`

Task 4-a already created `src/components/providers.tsx` as a thin
`SessionProvider` wrapper (named export `Providers`, default export, accepts
optional `session` prop). To avoid editing a file owned by another agent, I
created `src/components/app-providers.tsx` instead — it composes
`SessionProvider` (from `next-auth/react`) + my `ThemeProvider`.

`layout.tsx` imports `AppProviders` from `app-providers.tsx`. This keeps
Task 4-a's `providers.tsx` free to evolve and lets client components import
their own `Providers` (with optional session) for use under client-side
re-mounts if needed.

---

## Routing Logic for `?room=<code>` Query

`src/app/page.tsx` is an `async` server component (Next.js 16 — `searchParams`
is a `Promise`).

```ts
export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams
  const room = normalize(params?.room)   // single string OR first of array
  const session = await getServerSession(authOptions)

  if (!session?.user)        return <Landing />
  if (room)                  return <GameHost code={room} userId={...} username={...} />
  return <Dashboard user={...} />
}
```

Navigation patterns (documented for downstream tasks):
- Enter a game room:
  - Soft nav: `router.push('/?room=CODE')` — re-runs the server component.
  - Hard reload: `window.location.search = '?room=CODE'` — useful when a
    fresh websocket connection is desired.
- Exit a game room:
  - Soft nav: `router.push('/')` (handled in `GameHost.onExit`).
  - Hard reload: `window.location.search = ''`.
- The single exposed route is `/`. No other routes exist.

`onExit` callback: server components cannot pass function callbacks to
client components (functions are non-serializable). The page renders
`<GameHost />` (a client wrapper) which owns the router and forwards
`onExit={() => router.push('/')}` to Task 7's `<GameRoom />`.

---

## Expected Peer-Task Interfaces

These are the imports my files use. They MUST be provided by the named tasks:

| Import path | Export | Provided by | Notes |
| --- | --- | --- | --- |
| `@/lib/auth` | `authOptions` | Task 4-a | NextAuth config object passed to `getServerSession(authOptions)`. |
| `@/components/auth/auth-form` | `AuthForm` (named) | Task 4-a | Props: `{ onAuthed?: () => void }`. Landing passes `() => router.refresh()`. |
| `@/components/auth/user-menu` | `UserMenu` (named) | Task 4-a | No props. Rendered inside TopNav. |
| `@/components/friends/friends-panel` | `FriendsPanel` (named) | Task 4-b | No props. |
| `@/components/lobby/quick-play` | `QuickPlay` (named) | Task 6 | No props. |
| `@/components/lobby/game-history` | `GameHistory` (named) | Task 6 | No props. |
| `@/components/lobby/create-game-dialog` | `CreateGameDialog` (named) | Task 6 | No props (renders its own trigger button + dialog). |
| `@/components/lobby/join-game-dialog` | `JoinGameDialog` (named) | Task 6 | No props (renders its own trigger + dialog). |
| `@/components/game/game-room` | `GameRoom` (named) | Task 7 | Props: `{ code: string; userId: string; username: string; onExit: () => void }`. |

If a peer task uses a **default export** instead of named, please adjust
their file to also add a named export (preferred) OR ask me to switch to a
default import.

### Session user shape

The page casts `session.user` to `DashboardUser`:

```ts
interface DashboardUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  username?: string | null
  wins?: number
  losses?: number
  gamesPlayed?: number
}
```

Task 4-a's NextAuth `session.callback` should populate `id`, `username`,
`wins`, `losses`, `gamesPlayed`. The Dashboard defensively defaults missing
fields to `0` / `"Player"`.

---

## Dev-Server Status (read at hand-off)

At the time of writing this record, the dev server is hot-reloading and
reports `Module not found: '@/components/game/game-room'` (and similar for
the other peer-task modules). This is expected — those modules don't exist
yet because Tasks 4-a, 4-b, 6, 7 are still in flight. Once they land their
files, the dev server will hot-reload and the page will render correctly.

`bun run lint` reports exactly 2 issues, both in peer-task files:
- `src/components/game/dice.tsx:49` (Task 7) — `react-hooks/set-state-in-effect`.
- `src/lib/ludo/client.ts:181` (Task 5/7) — unused eslint-disable directive.

Neither is in my owned files; per task instructions I leave them alone.

---

## Layout Compliance

- ✅ Root layout body is `min-h-screen flex flex-col`.
- ✅ Footer uses `mt-auto` and is rendered by both Landing and Dashboard.
- ✅ Mobile-first responsive (single column → 2/3-column on `lg:`).
- ✅ Semantic HTML (`main`, `header`, `nav`, `section`, `aside`, `footer`).
- ✅ ARIA labels on icon-only buttons and nav regions.
- ✅ Touch targets ≥ 36px (Button `size="icon"` is `h-9 w-9`).
- ✅ No indigo/blue in the primary palette — warm red Ludo theme.
