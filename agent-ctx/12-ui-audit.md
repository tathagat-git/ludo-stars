# Task 12-ui-audit — ui-audit-subagent

## Task
Production UI audit & polish pass (loading/empty/error states, responsive design, accessibility, dark-mode consistency) across the Ludo Stars Next.js 16 app. No game logic, engine, bot AI, websocket protocol, API routes, or new dependencies — polish only.

## Files Updated
- `src/components/game/ludo-board.tsx` — dark-mode-aware CellView for every cell type (center, track, start, star, home) + outer board frame + inner grid ring.
- `src/components/game/game-room.tsx` — toast effect for `useGameRoom.error`; prominent full-width animated "Connection lost — reconnecting…" banner with `WifiOff` icon; upgraded header connection indicator (emerald dot / pulsing WifiOff, `aria-live="polite"`); aria-labels on the icon-only-on-mobile Copy and Leave buttons.
- `src/components/lobby/game-history.tsx` — empty state with Trophy icon + headline + description + "Create a game" CTA button that opens `CreateGameDialog`.
- `src/components/lobby/join-game-dialog.tsx` — empty open-rooms state with Users icon + message + inline "Create room" quick-create button (POST /api/lobby + navigate). New `quickCreate` mutation with `isPending` spinner.

## Issues Found & Fixed

### Dark mode (ludo-board.tsx)
- Track cells, star cells, center cell, start cells, home cells, and the outer board frame used `bg-white` + light `border-slate-*` colors. In dark mode this rendered as a jarring pure-white slab — the board didn't adapt to the theme at all.
- Fix: added `dark:bg-slate-900` to every white-background cell, `dark:border-slate-700` to light-bordered cells, `dark:border-slate-200/40` to the center cell, `dark:border-slate-200/30` to the outer frame, and `dark:ring-slate-300/20` to the inner grid ring. The colored start cells, home columns, and base regions use the existing `COLOR_BG` / `COLOR_BG_SOFT` maps which already work in both themes.

### Error visibility (game-room.tsx)
- `useGameRoom` returns an `error: string | null` that was only surfaced as a small banner inside the LobbyView. In-game errors (socket errors, room errors emitted mid-game) were silently swallowed.
- Fix: added `useEffect(() => { if (error) toast.error(error) }, [error])` so any error now toasts in BOTH the lobby and the in-game view. The lobby banner was kept (defense in depth).
- Sonner is already mounted globally via `layout.tsx`'s `<Toaster2 />`, so the toast works without any provider wiring.

### Reconnecting indicator (game-room.tsx)
- The previous indicator was a tiny "○ Reconnecting…" text label in the header — easy to miss, no icon, no animation.
- Fix:
  1. Upgraded the header status indicator: emerald dot (when connected) or a pulsing `WifiOff` icon (when reconnecting), with `aria-live="polite"` for screen readers. Text "Connected" is hidden on mobile (just the dot/icon shows).
  2. Added a separate full-width amber "Connection lost — trying to reconnect…" banner that slides in below the header when the socket drops. Uses `AnimatePresence` + `framer-motion` height animation, `role="status"`, pulsing `WifiOff` icon. Banner auto-hides when connection restores.

### Empty state — game-history.tsx
- Was plain text: "No games yet. Create or join a game to get started!" — no CTA.
- Fix: Trophy icon + headline "No games yet — start playing!" + helpful description ("Create a private room to invite friends, or jump into a quick match against bots.") + "Create a game" button that opens the existing `CreateGameDialog`. New imports: `CreateGameDialog`, `Dices`.

### Empty state — join-game-dialog.tsx (open rooms list)
- Was plain text: "No open rooms right now. Create one and invite a friend!" — no CTA.
- Fix: Users icon + message "No open rooms right now — create one!" + inline "Create room" button that does a quick POST `/api/lobby` (4-player classic, 0 bots) + navigates to the new room via `gotoRoom`. New `quickCreate` mutation with `isPending`-driven Loader2 spinner. New imports: `Dices`.

### A11y — icon-only mobile buttons (game-room.tsx)
- The header Copy and Leave buttons hide their text labels on mobile (`hidden sm:inline`), making them icon-only at <640px width. They had no `aria-label`.
- Fix: added `aria-label="Copy room code"` (dynamic: "Room code copied" after click) and `aria-label="Leave room"`.

## Verified (already compliant — no changes needed)

- **Loading states**: every async action shows a spinner + disabled state — auth-form (`submitting`), create-game-dialog (`mutation.isPending`), join-game-dialog (`joinByCode.isPending` / `joinActive.isPending`), quick-play (`quickMutation.isPending`), friends-panel (skeleton loaders + per-mutation `isPending`), game-history (`query.isLoading` spinner + Retry button on `isError`). The game-room roll/move/start/add-bot actions go through the websocket (no await), and the resulting game-state updates arrive via socket events that drive UI re-renders (dice spinning animation, turn glow, etc.).
- **Empty states**: friends-panel Friends/Find/Requests tabs each have a dedicated `EmptyState` (icon + title + description). chat-panel has "No messages yet. Say hi 👋" (existing emoji — left intact per the "don't add emojis" rule).
- **Error states**: auth-form, create-game-dialog, join-game-dialog, quick-play, friends-panel all use `toast.error` for failed mutations. game-history shows an error state with a Retry button. friends-panel shows a contextual `EmptyState` for query errors. game-room now toasts on `useGameRoom.error` (this audit).
- **Footer**: rendered on landing (line 117 of `landing.tsx`) + dashboard (line 135 of `dashboard.tsx`). Footer component uses `mt-auto`; layout.tsx body has `flex min-h-screen flex-col`; landing main wrapper has `flex-1 flex-col`; dashboard wrapper has `flex-1 flex-col`. Footer is omitted from the game-room view (acceptable per task spec — immersive game UI).
- **Responsive**: dashboard `lg:grid-cols-3`; game-room `lg:flex-row` for board+chat layout (mobile: column, desktop: row); player-card grid `repeat(auto-fit, minmax(min(100%, 160px), 1fr))` scales 2-6 players; board `max-w-[min(95vw,600px)]` (fits mobile 375px); chat panel `h-64 w-full lg:h-auto lg:w-80` (mobile: fixed 256px height below board, desktop: side panel).
- **A11y**: TopNav logo link has `aria-label="Ludo Stars home"`; ThemeToggle has dynamic aria-label; UserMenu has `aria-label="Open user menu"`; Dice has `aria-label="Roll the dice"` + `min-h-[44px]` touch target; Token has per-token aria-label with color + legal-move hint; CellView start/star cells have aria-labels; DirectionPicker has `aria-label="Choose move direction"`; ChatPanel has `aria-label="Room chat"` + `aria-label="Chat message"` on input + `aria-label="Send message"` on button + 44px touch targets; Footer nav has `aria-label="Footer"`; LudoBoard wrapper has `role="grid"` + `aria-label="Ludo board"`. Color dots are `aria-hidden`.
- **Dark mode (other components)**: token.tsx glossy highlights use white-translucent overlays that work in both themes. player-card.tsx uses semantic colors (`bg-card`, `border-border`, `text-muted-foreground`) + `COLOR_BG`/`COLOR_BG_SOFT` (color-500 / color-100) which render well in both themes. dice.tsx uses `bg-card` for the panel + `bg-white` for the die face (the die face needs to stay white for the colored pips to be visible — this is intentional and fine in both themes). game-over-modal uses semantic colors + `bg-amber-50 dark:bg-amber-950/20` for the winner row. friends-panel + game-history + join-game-dialog all use semantic colors throughout.

## Lint & Prettier Status
- `bun run lint` — 0 errors, 0 warnings for all in-scope files. (One pre-existing warning remains in `src/app/global-error.tsx`, outside my scope.)
- `bunx prettier --check` on the 4 modified files — all pass. (4 other project files outside my scope still have prettier issues; not touched.)
- Dev server (`bun run dev`) re-compiles cleanly after each edit; no runtime errors in `dev.log`.

## Notes for Downstream Agents
- The `useEffect` toast in `game-room.tsx` fires whenever `error` changes (and only when non-null). It does NOT clear `error` after toasting — the source `useGameRoom` hook owns that state. If a new identical error string arrives later, it WILL re-toast (React compares the dep by reference; the hook does `setError(msg)` which sets a new string each time). This is the desired behavior — repeated errors should re-surface.
- The new `quickCreate` mutation in `join-game-dialog.tsx` is self-contained — it doesn't need any callback props from the parent dashboard. It mirrors the QuickPlay "Create Private Room" flow but inline. If a future task adds the ability to choose mode/players from this CTA, it can be extended.
- The dark-mode color choices for the board cells use Tailwind's standard `slate-900` / `slate-700` palette (not the shadcn semantic tokens) intentionally — the Ludo board has a physical-board aesthetic with explicit cell borders, and using semantic tokens would have made the cells blend with the page background (muted/card).
EOF