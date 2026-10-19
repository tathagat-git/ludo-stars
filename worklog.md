# Ludo Stars - Work Log

This file is the shared work log for all agents working on the Ludo Stars
project. Each agent appends a new section after finishing its task.

---
Task ID: 1
Agent: main
Task: Design & implement database schema + core Ludo game engine + board geometry.

Work Log:
- Inspected project scaffold: Next.js 16 + Tailwind 4 + shadcn/ui + Prisma + next-auth + zustand + socket.io example.
- Designed Prisma schema with: User, Account, Session, VerificationToken, Friendship, FriendRequest, Game, GamePlayer, GameMove.
- `bun run db:push` applied the schema to SQLite.
- Built `src/lib/ludo/engine.ts` — full Ludo rules:
  - 52-cell main track, 6-cell home columns, 8 safe squares (4 starts + 4 stars).
  - Token position encoding: -1 = base, 0..51 = track, 100..105 = home column, 200 = finished, -999 = invalid (overshoot).
  - Classic rules: roll 6 to release, 3 sixes → pass turn, capture on non-safe squares, exact-roll-to-finish (no overshoot).
  - **TWIST MODE (user request)**: tokens on the main track OR home column can also move BACKWARD by the dice value, bounded by the player's own start square (cannot go below it). Backward moves can also capture opponents on non-safe squares.
  - Auto-pass when no legal moves; auto-reroll on 6 (unless seat just finished).
- Built `src/lib/ludo/bot.ts` — heuristic bot AI (finishing > capturing > escaping danger > releasing > advancing). Includes `randomBotName()` and `botThinkDelay()` (~700-1500ms).
- Built `src/lib/ludo/board.ts` — 15x15 board geometry: TRACK_CELLS[52], HOME_COLUMN_CELLS per color, BASE_DOCKS per color, BASE_REGIONS, STAR_CELLS, `posToCell()` converter, Tailwind color class maps.

Stage Summary:
- Schema is live in SQLite (custom.db).
- Game engine is the single source of truth for rules; the websocket mini-service will import it as the authority; the React UI will import the geometry + read-only state for rendering.
- **TWIST RULE (the user's custom rule)**: After rolling, the player whose turn it is may pick any of their on-board tokens AND a direction (forward OR backward). Backward moves are clamped at the token's own start square. Captures still apply on backward landings. This is the `mode: 'twist'` setting on the GameState.

Key conventions:
- All shared ludo code lives in `src/lib/ludo/` and is importable by both the Next.js app and the `mini-services/game-service/` (which will need to import from `../../src/lib/ludo/...` or be given a copy — see Task 5).
- Position encoding is documented at the top of `engine.ts`.
- Seat 0 = red (bottom-left), 1 = green (top-left), 2 = yellow (top-right), 3 = blue (bottom-right).

---
Task ID: 4-b
Agent: friends-subagent
Task: Friends system API + Friends panel UI

Work Log:
- Read worklog + Prisma schema (Task 1): User / Friendship (fromId, toId, @@unique pair) / FriendRequest (fromId, toId, status pending|accepted|declined). Prisma client via `import { db } from '@/lib/db'`.
- Verified `src/lib/auth.ts` (Task 4-a) exports `authOptions` and populates `session.user.id` + `session.user.username` via JWT/session callbacks.
- Built 6 API route handlers, all auth-guarded with `getServerSession(authOptions)`:
  - GET /api/friends — merges both directions of Friendship into a single list of `{ id, username, name, avatar, friendshipId, online:false }` (online flag is a mock; real presence will come from the game-service websocket mini-service in Task 5).
  - GET /api/friends/search?q= — Prisma `username contains` (case-insensitive), excludes self + existing friends, returns top 10 with `isFriend` and `hasPendingRequest` flags computed from a single batch of friendship/pending-request queries.
  - GET /api/friends/requests — pending incoming requests with sender profile, newest first.
  - POST /api/friends/requests `{ toUserId }` — guards self / not-found / already-friends. Smart merge: if the target already sent ME a pending request, auto-accept it (transactional: create both Friendship rows + mark request accepted). If a previously-declined outgoing request exists, reactivate to pending. Otherwise create new pending request (201).
  - POST /api/friends/requests/[id]/accept — transactional upsert of both Friendship rows (using the `fromId_toId` compound unique key from the schema) + update request to `accepted`. Guards: 404 / not-addressed-to-you (403) / not-pending (409).
  - POST /api/friends/requests/[id]/decline — marks request `declined`. Same guards.
  - DELETE /api/friends/[id]/remove — `[id]` is the OTHER user's id. Transactional `deleteMany` on both Friendship directions and any FriendRequest rows linking the two users (clean slate for re-add).
- Built `src/components/friends/friends-panel.tsx` — named export `FriendsPanel`, takes no props, fetches its own data:
  - Self-contained: creates its own module-level singleton `QueryClient` + mounts its own Sonner `<Toaster richColors />` so the panel works even if no top-level providers exist yet.
  - Three tabs (Friends / Find / Requests) using shadcn Tabs. shadcn Card, Button, Input, Avatar, Badge + lucide icons (Search, UserPlus, Check, X, Users, UserX, Inbox).
  - Find tab: debounced 300ms search input + Search button, skeleton loaders during fetch, empty + error states per tab.
  - Friends tab: list with mock online dot (all offline) + Remove button.
  - Requests tab: Accept / Decline buttons.
  - All mutations call `toast.success` / `toast.error` via sonner and invalidate the right query keys (`friends`, `friend-requests`, `friend-search`).
  - `max-h-96 overflow-y-auto` per tab with a custom scoped scrollbar via inline `<style>` block using `var(--border)` (intentionally NOT mutating the shared globals.css — out of my task scope).
  - Mobile-friendly: TabsList is a 3-col grid; row layout stacks gracefully; touch targets >= 28px on action buttons.
- Ran `bun run lint`: my 7 files pass cleanly (eslint exit 0, no warnings). The remaining 1 error + 1 warning in `src/components/game/dice.tsx` and `src/lib/ludo/client.ts` belong to other agents' task scopes (game UI / client) — untouched.

Stage Summary:
- Files produced:
  - `src/app/api/friends/route.ts`
  - `src/app/api/friends/search/route.ts`
  - `src/app/api/friends/requests/route.ts`
  - `src/app/api/friends/requests/[id]/accept/route.ts`
  - `src/app/api/friends/requests/[id]/decline/route.ts`
  - `src/app/api/friends/[id]/remove/route.ts`
  - `src/components/friends/friends-panel.tsx`
  - `/agent-ctx/4-b-friends-subagent.md` (work record)
- API endpoints:
  - GET  /api/friends                     — current user's friends list
  - GET  /api/friends/search?q=<q>        — top-10 user search w/ isFriend + hasPendingRequest
  - GET  /api/friends/requests            — pending incoming requests (with sender info)
  - POST /api/friends/requests            — body { toUserId } — create FriendRequest (auto-accepts if target already requested me)
  - POST /api/friends/requests/[id]/accept  — transactional accept (creates both Friendship rows)
  - POST /api/friends/requests/[id]/decline — marks request `declined`
  - DELETE /api/friends/[id]/remove        — removes both Friendship directions + all FriendRequest rows between the pair
- Component exports:
  - `FriendsPanel` (named export, no props) — self-contained, ready to drop into any page; renders Card with 3 tabs, manages its own TanStack Query cache and Sonner toaster.

---
Task ID: 4-a
Agent: auth-subagent
Task: NextAuth config + register/login API + auth UI

Work Log:
- Installed `bcryptjs@3.0.3` (+ `@types/bcryptjs`) for password hashing.
- Generated a 32-byte hex `NEXTAUTH_SECRET` via `crypto.randomBytes(32).toString('hex')` and wrote it to `.env.local` (alongside `NEXTAUTH_URL=http://localhost:3000` and the existing `DATABASE_URL`). Appended the same `NEXTAUTH_SECRET` to the existing `.env` (which previously only had `DATABASE_URL`). Dev server reloaded both env files automatically.
- Authored `src/types/next-auth.d.ts` — module augmentation that adds `id` and `username` to `Session.user`, `User`, and the JWT (`DefaultJWT`).
- Authored `src/lib/auth.ts` exporting `authOptions` (NextAuthOptions): JWT session strategy, `secret: process.env.NEXTAUTH_SECRET`, single `CredentialsProvider` that looks up the user by email via Prisma and verifies bcrypt hash; `jwt` callback stores `id`/`username` from the user object onto the token; `session` callback copies them onto `session.user`. Also set `pages.signIn: "/"` so the home page renders the inline form.
- Authored `src/lib/auth-options.ts` as a thin re-export wrapper (kept `auth.ts` as the canonical source).
- Authored `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler exposing `GET` and `POST` from `NextAuth(authOptions)`.
- Authored `src/app/api/auth/register/route.ts` — POST handler validating `{ email, username, password }` with a zod schema (email format; username 3–20 chars `[A-Za-z0-9_]`; password ≥ 6). Normalizes email to lowercase. Performs uniqueness checks for both email and username (returns 409 with a friendly message). Hashes password with bcrypt (cost 10), creates the User via Prisma, returns `{ ok, user }` with 201.
- Authored `src/app/api/auth/me/route.ts` — GET handler using `getServerSession(authOptions)`: returns 401 if no session, otherwise fetches the full public profile (`id, email, username, name, avatar, wins, losses, gamesPlayed`) and returns it as `{ user }`.
- Authored `src/components/providers.tsx` — `'use client'` wrapper around `SessionProvider` from `next-auth/react` (for Task 8 to mount in `layout.tsx`).
- Authored `src/components/auth/auth-form.tsx` — `'use client'` tabbed (Sign In / Create Account) form built on shadcn `Card`, `Tabs`, `Input`, `Label`, `Button`. Uses `react-hook-form` + `zodResolver(@hookform/resolvers/zod)` with two separate schemas (login: email+password; register: email+username+password). On login it calls `signIn('credentials', { redirect: false })`; on register it POSTs to `/api/auth/register` then auto-logs-in via `signIn`. On success: `toast.success('Welcome!')` (via `sonner`), `router.refresh()`, and calls the optional `onAuthed?.()` prop. On failure: `toast.error(message)`. Submit button shows a `Loader2` spinner while pending. Field-level error messages render under each input.
- Authored `src/components/auth/user-menu.tsx` — `'use client'` dropdown menu (shadcn `DropdownMenu` + `Avatar` + `Button`) shown only when `useSession()` returns a session. Trigger shows the user's avatar (or initials fallback) and a truncated username. Dropdown shows display name + email and a `Sign Out` item that calls `signOut({ callbackUrl: '/' })`. Renders `null` while session is loading (no auth flash).
- Verified end-to-end against the running dev server: registered a fresh user → confirmed 201 + user JSON; confirmed 409 on duplicate email and 400 on invalid schema; obtained a NextAuth CSRF token → posted credentials to `/api/auth/callback/credentials` (HTTP 200, session cookie set); `GET /api/auth/me` then returned the full profile; `GET /api/auth/session` returned the augmented session with `id` and `username`. Cleaned up the test user afterward.
- Ran `bun run lint` — all files in scope produce zero errors and zero warnings. (One pre-existing error in `src/components/game/dice.tsx` belongs to Task 3 and one warning in `src/lib/ludo/client.ts` belongs to Task 1; neither is in this task's scope.)
- Ran `bunx tsc --noEmit` filtered to this task's files — no type errors.

Stage Summary:
- Files produced (this task's scope only):
  - `src/lib/auth.ts` — NextAuth options (Credentials provider, JWT session, jwt/session callbacks).
  - `src/lib/auth-options.ts` — re-export of `authOptions`.
  - `src/app/api/auth/[...nextauth]/route.ts` — NextAuth GET/POST handler.
  - `src/app/api/auth/register/route.ts` — POST `{ email, username, password }` → creates user.
  - `src/app/api/auth/me/route.ts` — GET current user (401 if unauth).
  - `src/types/next-auth.d.ts` — `Session.user`/`User`/`JWT` augmentation with `id` + `username`.
  - `src/components/providers.tsx` — `'use client'` `SessionProvider` wrapper.
  - `src/components/auth/auth-form.tsx` — tabbed Login/Register form (RHF + zod + sonner).
  - `src/components/auth/user-menu.tsx` — avatar + Sign Out dropdown.
  - `.env.local` and `.env` — added `NEXTAUTH_SECRET` + `NEXTAUTH_URL`.
- API endpoints:
  - `POST /api/auth/register` — body `{ email, username, password }` → `201 { ok, user }` on success, `400` on validation error, `409` on duplicate email/username.
  - `GET /api/auth/me` — returns `{ user: { id, email, username, name, avatar, wins, losses, gamesPlayed } }` or `401`.
  - `GET /api/auth/session` (NextAuth built-in) — returns `{ user: { id, username, email, name }, expires }`.
  - `GET/POST /api/auth/*` (NextAuth built-ins: `signin`, `signout`, `csrf`, `session`, `callback/credentials`).
- How to use (for Task 8 / page owner):
  - Wrap the React tree once at the root: `import { Providers } from "@/components/providers"` and use it in `layout.tsx` (Task 8 owns layout — they will import this component).
  - Drop `<AuthForm onAuthed={() => router.refresh()} />` anywhere a logged-out user lands (e.g. the home page). After successful auth it calls `router.refresh()` automatically.
  - Drop `<UserMenu />` in the header/nav — it self-hides when unauthenticated.
  - Server components / route handlers read the session via `import { getServerSession } from "next-auth"; import { authOptions } from "@/lib/auth"` (see `/api/auth/me/route.ts` for the canonical pattern).
  - Client components read the session via `useSession()` from `next-auth/react` — the augmented `session.user.id` and `session.user.username` are typed.

---
Task ID: 8
Agent: shell-agent
Task: Landing page, dashboard shell, theme, and shared providers (top-level routing).

Work Log:
- Inspected worklog (Task 1 done; Tasks 4-a, 4-b, 6, 7 in flight). Confirmed
  engine + board + Prisma schema exist. Confirmed `src/components/providers.tsx`
  already created by Task 4-a (SessionProvider wrapper, named + default export).
- Created `src/components/theme-provider.tsx` — next-themes wrapper with
  `attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange`.
- Created `src/components/app-providers.tsx` — composes
  `<SessionProvider><ThemeProvider>{children}</ThemeProvider></SessionProvider>`.
  Used by `layout.tsx`. Does NOT touch Task 4-a's `providers.tsx`.
- Updated `src/app/layout.tsx`:
  - Kept Geist / Geist_Mono fonts.
  - Wrapped `{children}` in `<AppProviders>`.
  - Kept existing `<Toaster />` from `@/components/ui/toaster`.
  - Added `<Toaster2 />` (named `Toaster` from `@/components/ui/sonner`).
  - Body class now `min-h-screen flex flex-col` (for sticky footer).
  - Metadata → "Ludo Stars — Play Ludo with Friends & Bots".
  - `suppressHydrationWarning` kept on `<html>` (next-themes requirement).
- Rewrote `src/app/page.tsx` as a server component:
  - `async` (Next.js 16 — `searchParams` is a Promise, `await` it).
  - `getServerSession(authOptions)` from `@/lib/auth`.
  - Routing:
    - No session            → `<Landing />`
    - Session + `?room=`    → `<GameHost code={...} userId={...} username={...} />`
    - Session, no room      → `<Dashboard user={...} />`
  - Normalizes `room` (string | string[] → single string).
- Created `src/components/dashboard/game-host.tsx` — small `'use client'`
  wrapper around Task 7's `<GameRoom />` that owns `useRouter` and forwards
  `onExit={() => router.push('/')}`. Needed because server components can't
  pass function callbacks to client components.
- Created `src/components/landing/landing.tsx`:
  - `'use client'`, two-column hero + auth form on `lg:` (stacks on mobile).
  - Hero: "Ludo Stars" wordmark with red→amber→green gradient text, tagline
    "Classic Ludo with a twist — move forward AND backward!", 4 feature
    bullets, "Get Started" CTA scrolls to the auth form.
  - Right column: `<AuthForm onAuthed={() => router.refresh()} />` in a Card.
  - Mini CSS-art Ludo board preview (15×15 grid using `grid-cols-15`).
  - Warm gradient background using `.bg-ludo-hero` utility (red/yellow/green
    radial wash). NO indigo/blue.
  - Sticky footer included.
- Created `src/components/dashboard/dashboard.tsx`:
  - TopNav → hero ("Welcome back, {username}!") → StatsCards → main grid:
    - Left (lg:col-span-2): `<QuickPlay />`, `<GameHistory />`.
    - Right sidebar: `<FriendsPanel />`, Card with `<CreateGameDialog />` +
      `<JoinGameDialog />` triggers + a "Multiplayer" hint.
  - Sticky footer.
  - User prop: `{ id, name?, email?, image?, username?, wins?, losses?, gamesPlayed? }`.
- Created `src/components/dashboard/top-nav.tsx` — sticky header with logo,
  ThemeToggle, and `<UserMenu />` (Task 4-a, named import).
- Created `src/components/dashboard/theme-toggle.tsx` — Sun/Moon button
  using `next-themes` `useTheme`. Mounted-deferred to avoid hydration mismatch.
- Created `src/components/dashboard/stats-cards.tsx` — 4-card grid
  (Games / Wins / Losses / Win Rate). Props: `{ wins, losses, gamesPlayed }`.
- Created `src/components/ui/footer.tsx` — sticky `<footer className="mt-auto ...">`
  with credits + GitHub/Twitter links. Used by both Landing and Dashboard.
- Updated `src/app/globals.css`:
  - Tailwind v4 `@utility grid-cols-15` and `@utility grid-rows-15` (board is 15×15).
  - `.scrollbar-thin` custom scrollbar styles (6px thumb, hover intensifies).
  - `.bg-ludo-hero` warm radial-wash helper for hero backgrounds.
  - Tweaked `--primary` to a warm Ludo red: `oklch(0.55 0.215 25)` light /
    `oklch(0.65 0.20 25)` dark. Also `--ring`, `--sidebar-primary`,
    `--sidebar-ring`, `--chart-1` updated to match. NO indigo/blue.

Stage Summary:
- The full top-level routing pipeline is in place. The `/` route conditionally
  renders Landing / Dashboard / GameRoom based on session + `?room=` query.
- All theme + provider scaffolding is wired (next-themes class strategy,
  next-auth SessionProvider, sonner + shadcn toast).
- All shared layout pieces (TopNav, Footer, StatsCards, ThemeToggle) are
  reusable client components.
- Peer-task dependencies (auth form, user menu, friends panel, lobby widgets,
  game room) are imported as **named exports** with the interfaces documented
  below; the dev server will hot-reload successfully once Tasks 4-a, 4-b, 6, 7
  deliver their files.

Key conventions:
- Routing: ONLY `/` is exposed. Entering a room: `router.push('/?room=CODE')`
  (soft) or `window.location.search = '?room=CODE'` (hard). Exiting:
  `router.push('/')` or `window.location.search = ''`.
- `onExit` for `<GameRoom />` is provided by the client wrapper
  `<GameHost />` (`src/components/dashboard/game-host.tsx`) — server
  components cannot pass function callbacks to client components.
- The body element is `min-h-screen flex flex-col` so the sticky footer
  (`<footer className="mt-auto">`) is pushed down naturally on short content
  and never overlays long content.
- Theme: light by default, system-respecting, class strategy, no flash on
  toggle (`disableTransitionOnChange`).
- Color palette: warm Ludo red primary. NO indigo/blue as primary.
- All owned files pass `bun run lint` cleanly. (The only 2 lint errors are in
  `src/components/game/dice.tsx` and `src/lib/ludo/client.ts` — peer-task
  files I do not touch.)

Expected peer-task interfaces (named exports, no default-only):
- `@/lib/auth` → `authOptions`
- `@/components/auth/auth-form` → `AuthForm` (props: `{ onAuthed?: () => void }`)
- `@/components/auth/user-menu` → `UserMenu` (no props)
- `@/components/friends/friends-panel` → `FriendsPanel` (no props)
- `@/components/lobby/quick-play` → `QuickPlay` (no props)
- `@/components/lobby/game-history` → `GameHistory` (no props)
- `@/components/lobby/create-game-dialog` → `CreateGameDialog` (no props)
- `@/components/lobby/join-game-dialog` → `JoinGameDialog` (no props)
- `@/components/game/game-room` → `GameRoom` (props:
  `{ code: string; userId: string; username: string; onExit: () => void }`)

Work record: `/agent-ctx/8-landing-dashboard-shell.md`.

---
Task ID: 5
Agent: real-time-game-service
Task: Build the WebSocket (socket.io) real-time game service mini-service on port 3003.

Work Log:
- Created `/home/z/my-project/mini-services/game-service/` as an independent bun project.
- `package.json` — name `ludo-game-service`, scripts `dev` (`bun --hot index.ts`) and `start` (`bun index.ts`). Deps: `socket.io`. DevDeps: `@types/socket.io`, `bun-types`.
- `index.ts` — socket.io server, port 3003 (hardcoded), path `/`, CORS `*`, pingTimeout 60s, pingInterval 25s. Imports the ludo engine + bot AI DIRECTLY via relative path (`../../src/lib/ludo/engine.ts` / `bot.ts`) — bun supports native TS, no copy needed. Documented in code header.
- In-memory stores: `rooms: Map<roomId, RoomState>` and `sockets: Map<socketId, {userId, roomId}>`.
- RoomState carries: id, code, mode, maxPlayers, botCount, seats (SeatState[]), gameState, hostUserId, createdAt, botTimer, destroyTimer.
- SeatState: { seat, userId, isBot, name, socketId, ready, disconnected?, forfeited?, joinedAt }.
- Room codes: 6-char uppercase alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I confusions). `room:join` with unknown code creates the room (host = joining user). `room:create` generates a fresh code and creates.
- Game start: validates all humans ready (when >1 human), re-orders seats so humans come first (in seat order) then bots, fills remaining seats with bots up to maxPlayers, calls `createInitialState`, broadcasts `game:started` then `game:state`, kicks off bot loop if first seat is a bot.
- Bot turn flow: `scheduleBotTurn(room)` — clears any existing bot timer, and if current seat is a bot, schedules a `setTimeout(botThinkDelay())` that:
  - phase `roll` → `applyRoll`, broadcast, recurse.
  - phase `move` → `chooseBotMove` → `applyMove`, broadcast, recurse.
  - phase `gameover` → `endGame`, broadcast `game:over`, stop.
  Only ONE bot timer per room at any time; cleared on game over / room destroy / state reset.
- Disconnect handling: marks seat `disconnected=true`, `socketId=null`. Mid-game disconnect = forfeit (push seat to `winners`, pass turn if it was theirs, re-check game over, schedule bot turn if next seat is bot). Lobby disconnect = remove seat. If all humans have left mid-game → endGame immediately. Starts a 60s destroy timer that nukes the room if no human reconnects. Empty rooms are destroyed immediately.
- Validation: `game:roll` / `game:move` from non-current-seat sockets → ignored + `room:error`. `game:move` with illegal `{tokenId, direction}` (not in `state.legalMoves`) → ignored + `room:error`. `room:add-bot` / `room:remove-bot` / `room:start` are host-only. `room:start` rejected if game already started or fewer than 2 seats filled.
- Chat: `chat:message { content }` broadcast as `{ userId, username, content, timestamp }` to all sockets in the room. Content truncated to 500 chars.

Verification:
- `bun install` succeeded (socket.io@4.8.4, @types/socket.io@3.0.2, bun-types@1.4.3).
- `bun run dev` boots cleanly on port 3003.
- Smoke-tested via socket.io-client: created a 4-seat room (1 human + 3 bots), started the game, observed the engine emitting `roll`/`move`/`pass`/`turn` events cycling through Alice + 3 bots correctly — including auto-pass on no-moves, re-roll on 6, three-sixes rule, captures, and bot AI choosing forward moves. Disconnect correctly triggered `game:over` when the only human left.

How to start:
```bash
cd /home/z/my-project/mini-services/game-service
bun install     # one-time
bun run dev     # boots on port 3003 with hot reload
```
The service is currently running in the background (PID via `bun --hot index.ts`).

Stage Summary:
- The game-service is the **single authority** for game-state transitions during live play. The Next.js API will persist final results to the DB separately after `game:over`.
- Frontend (Task 7) connects with `io('/?XTransformPort=3003', { transports: ['websocket','polling'] })`.
- All event names below are FINAL — Task 7 should wire the client to exactly these.

=== EVENT NAMES (FINAL) ===

Server → Client:
- `room:state`     — full room snapshot { id, code, mode, maxPlayers, botCount, seats[], gameState, hostUserId, yourSeat, started, phase }
- `room:joined`    — { roomId, code, seat, mode, maxPlayers }  (sent only to the joining socket)
- `room:error`     — { message }
- `game:started`   — { gameState }                                (broadcast to room)
- `game:state`     — full GameState object                        (broadcast on every state change)
- `game:event`     — last GameEvent from engine                   (broadcast alongside game:state)
- `game:over`      — { winners: number[], players: Player[] }     (broadcast on game end)

Client → Server:
- `room:create`    — { userId, username, mode?, maxPlayers? }     → host creates a fresh-code room
- `room:join`      — { code, userId, username, mode?, maxPlayers? } → join existing room, or create with that code if absent
- `room:leave`     — (no payload)                                  → leave room (forfeit if mid-game)
- `room:ready`     — (no payload)                                  → toggle ready (humans only)
- `room:start`     — (no payload, host only)                      → start the game (fills bots to maxPlayers)
- `room:add-bot`   — (no payload, host only)                      → add a bot to the next free seat
- `room:remove-bot`— (no payload, host only)                      → remove the highest-seat bot
- `game:roll`      — (no payload)                                 → current human player rolls dice
- `game:move`      — { tokenId: number, direction: 'forward'|'backward' }  → current human player moves
- `game:forfeit`   — (no payload)                                  → player forfeits mid-game (tokens stay, turn skips them)
- `chat:message`   — { content: string }                          → broadcast chat message to room

=== FILES ===
- /home/z/my-project/mini-services/game-service/package.json
- /home/z/my-project/mini-services/game-service/index.ts            (the socket.io server + all event handlers + bot loop)
- /home/z/my-project/mini-services/game-service/service.log        (runtime log; truncated on each restart)

Notes for Task 7 (UI agent):
- The GameState shape matches `src/lib/ludo/engine.ts` exactly — import the type from there for the client.
- `game:state` is broadcast on EVERY state change, so the UI can simply re-render from it (no patching needed).
- `game:event` carries the engine's `lastEvent` for animations/sounds (types: `roll|move|pass|turn|capture|finish|gameover`).
- The room snapshot's `yourSeat` field tells the client which seat they are; compare with `gameState.currentSeat` to know whose turn it is.
- For bot seats, the client should disable roll/move buttons (the server will reject those events with `room:error` anyway).
- Chat is room-scoped; broadcast to everyone including bots (bots don't chat).

---

Task ID: 6
Agent: lobby-agent
Task: Game Lobby (create / join / list / preview / leave / start / finish games)

Work Log:
- Inspected existing scaffold + Task 1 schema, Task 4-a's `@/lib/auth`, Task 1's
  `@/lib/ludo/bot` (for `randomBotName`).
- Created `src/lib/lobby.ts` with: `generateRoomCode()` (6-char A–Z/2–9 alphabet,
  no 0/O/1/I ambiguity), `generateUniqueRoomCode()` retry helper,
  `toLobbyGameDTO()` serializer, `SEAT_TO_PLAYER_FIELD` map, `SEAT_COLORS`,
  and DTO interfaces.
- Built 7 API routes (all auth-guarded, idempotent where appropriate):
  - POST `/api/lobby`           — creates Game row + GamePlayer rows for host
    (seat 0) and bots (seats 1..botCount). Validates mode/maxPlayers/botCount.
    Returns `{game, code}`.
  - GET  `/api/lobby`           — current user's 20 most recent games (matched
    by player1..4Id OR GamePlayer.userId).
  - GET  `/api/lobby/active`    — joinable waiting games (has ≥1 human, not full),
    trimmed to 20.
  - GET  `/api/lobby/[code]`    — full game + players by room code (preview).
  - POST `/api/lobby/[code]/join`  — assigns next free seat, sets playerNId on
    Game. Idempotent for already-joined users.
  - POST `/api/lobby/[code]/leave`  — removes GamePlayer; if host leaves with
    other humans remaining, promotes next human to seat 0; if no humans remain,
    deletes the waiting room entirely.
  - POST `/api/lobby/[code]/start`  — host-only; sets status='playing',
    startedAt=now(). Returns 403 for non-host.
  - POST `/api/lobby/[code]/finish`  — accepts `{winners: number[]}` (seats in
    finish order); sets status='finished', finishedAt, winnerId (first winner's
    userId, or null if first winner is a bot), GamePlayer.finalRank per seat,
    and updates User.stats: gamesPlayed+1 for all human participants,
    wins+1 for 1st-place human, losses+1 for other humans. Idempotent.
- Built 4 UI components (all self-contained, shadcn/ui-based, mobile-responsive):
  - `src/components/lobby/create-game-dialog.tsx`
    Exports: `CreateGameDialog`, `gotoRoom`.
    Props: `trigger?: React.ReactNode` (default = "Create Game" button).
    Form: mode radio (Classic/Twist with tooltip explanation), max-players
    select (2/3/4), bot-count select (0..maxPlayers-1, auto-clamped). On
    submit → POST /api/lobby → `window.location.search = '?room=<code>'`.
  - `src/components/lobby/join-game-dialog.tsx`
    Exports: `JoinGameDialog`.
    Two paths: 6-char room code entry (auto-normalized) OR browse open rooms
    (GET /api/lobby/active) with mode/players/bots preview and a Join button
    per row. Self-hosted QueryClient + SonnerToaster + thin custom scrollbar.
  - `src/components/lobby/game-history.tsx`
    Exports: `GameHistory`. Fetches GET /api/lobby. Renders last 20 games with
    date, mode, result (Win/Loss/Unfinished), players, bots. Empty/loading/
    error states. Mobile-responsive with max-h-96 scroll list.
  - `src/components/lobby/quick-play.tsx`
    Exports: `QuickPlay`. Dashboard card with two big buttons:
    "Play vs Bots" (one-click: creates 4-player twist game with 3 bots,
    navigates to room) and "Create Private Room" (composes CreateGameDialog
    with custom trigger).

API endpoint list (for downstream agents / Task 8 page.tsx):
- POST   /api/lobby                        → { game: LobbyGameDTO, code }
- GET    /api/lobby                        → { games: LobbyGameDTO[] }
- GET    /api/lobby/active                 → { games: LobbyGameDTO[] }
- GET    /api/lobby/[code]                 → { game: LobbyGameDTO }
- POST   /api/lobby/[code]/join            → { game: LobbyGameDTO }
- POST   /api/lobby/[code]/leave           → { left: boolean, game: LobbyGameDTO | null }
- POST   /api/lobby/[code]/start           → { game: LobbyGameDTO }
- POST   /api/lobby/[code]/finish          → { game: LobbyGameDTO }
                                            Body: { winners: number[] }

Component exports (for downstream agents / Task 8 page.tsx):
- `import { CreateGameDialog, gotoRoom } from '@/components/lobby/create-game-dialog'`
- `import { JoinGameDialog } from '@/components/lobby/join-game-dialog'`
- `import { GameHistory } from '@/components/lobby/game-history'`
- `import { QuickPlay } from '@/components/lobby/quick-play'`

Stage Summary:
- All 7 lobby API routes work end-to-end (verified via curl with real
  NextAuth session, real Prisma reads/writes against SQLite).
- All 4 UI components compile cleanly; built to be dropped into Task 8's
  dashboard page.
- Temporary stub at `src/components/game/game-room.tsx` lets the dev server
  compile while Task 7 finishes the real GameRoom. Task 7 SHOULD OVERWRITE
  this stub. (The stub accepts the documented props: `{ code, userId,
  username, onExit }`.)

Lint status:
- All files in my scope pass `bunx eslint` cleanly.
- Project-wide `bun run lint` shows 1 error + 1 warning in
  `src/components/game/dice.tsx` and `src/lib/ludo/client.ts` — outside my
  scope (Task 5/7).

Key conventions:
- DTO shape `LobbyGameDTO` (in `src/lib/lobby.ts`) is the canonical shape
  returned by all lobby endpoints. The React UI consumes it directly.
- Room codes are 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars,
  no 0/O/1/I). All UI inputs normalize to this alphabet automatically.
- `?room=<code>` is the navigation convention used by create/join/quick-play
  to enter a game room; Task 8's `page.tsx` reads it.
- Bots are created at room-creation time as `GamePlayer` rows with
  `isBot=true, userId=null, botName=<randomBotName()>`. Their seats occupy
  1..botCount.

---
Task ID: 7
Agent: ludo-board-ui-subagent
Task: Build the Ludo Stars board UI — the main game room + 15x15 board + dice + chat + game-over modal + lobby.

Work Log:
- Read `/home/z/my-project/worklog.md` (Task 1 by main agent) and confirmed the engine + board geometry exports.
- Read `src/lib/ludo/engine.ts` fully — confirmed `GameState`, `Token`, `LegalMove`, `GameEvent`, `Color`, `COLORS`, `COLOR_START`, `isInBase`, `isFinished`, `isOnTrack`, `isInHomeColumn`, `progress`.
- Read `src/lib/ludo/board.ts` fully — confirmed `TRACK_CELLS`, `HOME_COLUMN_CELLS`, `BASE_DOCKS`, `BASE_REGIONS`, `CENTER_CELL`, `STAR_CELLS`, `posToCell`, `baseDockCell`, `cellToTrackIndex`, `COLOR_BG`, `COLOR_BG_SOFT`, `COLOR_BORDER`, `COLOR_TEXT`, `COLOR_DOT`.
- Waited for Task 5 to finish; then read `mini-services/game-service/index.ts` to confirm the exact socket event names + payload shapes (see "Socket events" table below).
- Installed `socket.io-client` (it was missing from package.json).
- Built all 9 components/files in `src/components/game/` + `src/lib/ludo/client.ts`.

Files created:
- `src/lib/ludo/client.ts` — exports `createGameSocket()`, `useGameRoom()` hook (returns `{ socket, connected, room, gameState, lastEvent, chat, error, mySeat, isMyTurn, legalMoves, roll, move, sendMessage, setReady, startGame, addBot, removeBot, leaveRoom }`), types `RoomState`, `SeatInfo`, `ChatMessage`, `UseGameRoomResult`, and constants `EV`, `SERVER_EV`, `GAME_SERVICE_PORT`.
- `src/components/game/token.tsx` — exports `Token` (framer-motion animated colored pawn; accepts `size` as number (px) or string (%)).
- `src/components/game/dice.tsx` — exports `Dice` (lucide dice icons + Roll button; glows on local player's turn).
- `src/components/game/direction-picker.tsx` — exports `DirectionPicker` (shadcn Popover; "↑ Forward (N)" / "↓ Backward (N)" with capture count badges).
- `src/components/game/player-card.tsx` — exports `PlayerCard` (avatar + color dot + name + BOT/YOU badges + turn highlight + rank crown).
- `src/components/game/chat-panel.tsx` — exports `ChatPanel` (ScrollArea + Input + Send button; auto-scrolls to bottom; system vs. user message styling).
- `src/components/game/game-over-modal.tsx` — exports `GameOverModal` (final rankings + CSS-only confetti + Play Again / Exit).
- `src/components/game/ludo-board.tsx` — exports `LudoBoard` (15x15 grid via inline `gridTemplateColumns: repeat(15, 1fr)`; 4 colored triangles in the center via `clip-path`; tokens absolutely-positioned overlays with framer-motion `layout` animation; legal-move destinations pulse-highlighted with `ring-2 ring-emerald-400 animate-pulse`).
- `src/components/game/game-room.tsx` — exports `GameRoom` (top-level component; props `{ code, userId, username, onExit }`). Lobby view shows room code (copyable), seat list (with Ready/Add Bot/Remove Bot/Start buttons for host), and chat. In-game view shows 4 player cards around the board + Dice + chat + last-event ticker.

Lint status:
- `bun run lint` — passes cleanly (0 errors, 0 warnings) for all files in my scope.
- `bunx tsc --noEmit` — passes cleanly for all files in my scope.

Stage Summary:
- All 9 files written and verified.
- Socket event names in `client.ts` MATCH what Task 5's `mini-services/game-service/index.ts` actually emits (confirmed by reading the server source).
- The board is responsive (`max-w-[min(95vw,600px)] aspect-square`), uses framer-motion for token movement and dice roll, and includes the twist-mode direction picker.
- The lobby, in-game, and game-over states all render with the documented UX.
- The `GameRoom` props match the stub Task 6 left behind (`{ code, userId, username, onExit }`) so Task 8's page.tsx can drop it in without changes.

Socket events used in `src/lib/ludo/client.ts` (exact names):

Client → server (the `EV` constant):
- `room:join` — payload `{ code, userId, username }`
- `room:ready` — no payload
- `room:start` — no payload
- `room:add-bot` — no payload
- `room:remove-bot` — no payload (server removes the last-added bot)
- `room:leave` — no payload
- `game:roll` — no payload
- `game:move` — payload `{ tokenId, direction }`
- `chat:message` — payload `{ content }`

Server → client (the `SERVER_EV` constant):
- `room:state` — payload `RoomState` (full snapshot — see `RoomState` interface in `client.ts`; key fields: `code`, `mode`, `maxPlayers`, `seats: SeatInfo[]` (only filled seats, no nulls), `gameState: GameState | null`, `hostUserId`, `yourSeat`, `started`, `phase`).
- `room:joined` — payload `{ roomId, code, seat, mode, maxPlayers }` (metadata only; full state arrives via `room:state`).
- `room:error` — payload `{ message }`.
- `game:started` — payload `{ gameState: GameState }` (wrapped).
- `game:state` — payload `GameState` (direct, not wrapped).
- `game:event` — payload `GameEvent` (the last event).
- `game:over` — payload `{ winners: number[], players: Player[] }` (summary, not full state).
- `chat:message` — payload `{ userId, username, content, timestamp }` (no `id`/`type` — client generates id).

Important payload quirks (confirmed by reading Task 5's server source):
- `room:state.seats` only contains *filled* seats — empty seats are not present. The LobbyView iterates 0..maxPlayers and looks up `seats.find(s => s.seat === i)` to find empty slots.
- `room:remove-bot` ignores any payload arg and removes the last-added bot server-side.
- The local user's seat is provided by the server in `room.yourSeat` (no need to scan seats).
- `chat:message` from the server has no `id` field; the client synthesizes one (`${timestamp}-${random}`) for React keys.
- `game:over` does NOT carry a full `GameState`; the client uses the last `game:state` payload (which has `phase: 'gameover'`) and just refreshes `winners`/`players` from the summary.

---
Task ID: 9
Agent: main
Task: Integration, end-to-end agent-browser verification, and fixes.

Work Log:
- Added `QueryClientProvider` to `src/components/app-providers.tsx` (TanStack Query was used by lobby/friends components but had no provider — caused "No QueryClient set" crash on dashboard).
- Fixed socket.io race condition in `src/lib/ludo/client.ts`: removed the `joinedRef` guard that prevented re-join on reconnect. Now always emits `room:join` on every `connect` event (server is idempotent). Also handles the case where socket.io auto-connects before the effect registers the `connect` handler.
- Fixed game-service `room:join` handler to allow mid-game reconnection for a user who already has a seat (was previously blocked with "Game already in progress"). This is critical for React StrictMode dev double-mounts.
- Added grace periods in the game-service disconnect handler:
  - `EMPTY_ROOM_DESTROY_GRACE_MS` (5s): empty rooms aren't destroyed immediately, absorbing StrictMode reconnects.
  - `PLAYER_DISCONNECT_FORFEIT_MS` (15s): a disconnected human player isn't immediately forfeited — they get 15s to reconnect.
  - `endGameTimer`: when all humans disconnect mid-game, the game isn't ended immediately — it waits 60s for a reconnect.
- Added auto-bot-fill + auto-start effect to `src/components/game/game-room.tsx`: reads `bots` and `autostart` URL query params (set by "Play vs Bots" and "Create Private Room") and pre-fills bot seats, then auto-starts when requested.
- Updated `src/components/lobby/quick-play.tsx` to navigate to `?room=CODE&bots=3&autostart=1` for the one-click "Play vs Bots" flow.
- Updated `src/components/lobby/create-game-dialog.tsx` to pass the chosen `bots` count via URL.
- Added diagnostic `console.log` calls to the game-service roll/move/reconnect handlers for monitoring.

Verification (agent-browser, via Caddy on port 81):
- ✅ Landing page renders with auth form (Login + Create Account tabs).
- ✅ Register flow: created "alice" account → auto-login → dashboard.
- ✅ Dashboard renders: TopNav, stats cards, Quick Play, Game History, Friends panel (3 tabs), Create/Join dialogs, sticky footer.
- ✅ "Play vs Bots" creates a 4-player twist room, auto-fills 3 bots, auto-starts.
- ✅ Game board renders: 15x15 grid, 16 tokens (4 per color), 4 colored bases, center finish, dice, chat panel, player cards.
- ✅ Dice rolling works: alice rolled 6 → 4 legal moves (release tokens). Rolled 1 → forward move. Rolled 6 again → 5 legal moves (token on track had BOTH forward + backward).
- ✅ Forward moves work: `seat 0 (alice) moved token 0 forward`.
- ✅ **TWIST RULE VERIFIED**: direction picker appeared with "Forward (6)" + "Backward (6)" buttons; clicking Backward executed `seat 0 (alice) moved token 0 backward`.
- ✅ Bots auto-play: `BOT seat 3 (Bot Zeta) moved token 12 forward`.
- ✅ No runtime errors in dev.log or browser console.

Stage Summary:
- The full stack is operational: auth → dashboard → lobby → game room → live play with bots.
- The custom "twist" rule (tokens can move backward from their start point) is fully implemented in the engine and verified end-to-end in the browser.
- All 5 subagent-produced feature areas integrate cleanly.
- Dev server runs on port 3000 (Next.js), game-service on port 3003 (socket.io), Caddy on port 81 routes both.

---
Task ID: 10-board-polish
Agent: board-polish-subagent
Task: 6-color board support + Ludo King UI polish + 5-6 player layout

Work Log:
- Read worklog Tasks 1, 7, 9 + full source of `board.ts`, `engine.ts`, `ludo-board.tsx`, `player-card.tsx`, `token.tsx`, `game-room.tsx`. Confirmed the new 6-color API: `COLORS` has 6 entries; `BASE_REGIONS` and `HOME_COLUMN_CELLS` only define the 4 standard colors; `posToCell` / `baseDockCell` now return `Cell | null` (null for purple/orange in base/home-column); new `isOnBoardColor()` helper exported.
- Rewrote `ludo-board.tsx::getCellInfo` to skip purple/orange when iterating `HOME_COLUMN_CELLS` and `BASE_REGIONS` (uses `isOnBoardColor(c)` + `undefined` guards). No more "cannot read property of undefined" crashes.
- Rewrote `ludo-board.tsx::getTokenPlacement` to handle nullable cells: added `offBoard: boolean` to `TokenPlacement`. When `posToCell`/`baseDockCell` returns null, returns `offBoard: true` and the render loop skips that token (it's drawn off-board by PlayerCard). Track positions (0–51) and center finish (pos=200) always render on-grid for every color.
- Added Ludo King polish to the board: colored start squares now show a rotated `ArrowRight` chevron pointing along the track's clockwise direction (red=up, green=right, yellow=down, blue=left, purple=left, orange=right); home-column approach cells (pos 100–104) use `COLOR_BG_SOFT` with the last home cell (pos 105) using full `COLOR_BG`; center finish keeps the 4 colored triangles + adds a centered `Crown` icon; board wrapped in `rounded-xl border-2 border-slate-800 bg-white p-1 shadow-2xl`; added pulsing `ring-4 ring-emerald-400/40` turn glow on the board wrapper when `state.currentSeat === mySeat` and phase is roll/move; track cells use `border border-slate-200`.
- Extended finished-token offset map to include purple (bottom-left-ish) and orange (top-right-ish) so finished purple/orange tokens cluster visibly at center without overlapping the 4 standard triangles.
- Added `OffBoardStrip` component to `player-card.tsx` — compact "Base ● ● ● ●" + "Home ▢ ▢ ▢ ▢ ▢ ★" rows rendered only for purple/orange players (when `!isOnBoardColor(color)` and tokens are provided). Each cell ~20px; renders mini colored tokens at the correct index when a token is in base (pos=-1, by token.index 0–3), in home column (pos 100–105), or finished (pos 200, shown as a crown in the last cell). Added optional `tokens?: Token[]` prop to PlayerCard.
- Replaced `game-room.tsx`'s fixed 4-seat `SEAT_POSITION` layout with a responsive `auto-fit minmax(min(100%, 160px), 1fr)` grid that scales to 2–6 players above the board. Removed the now-unused `EmptySeat` component, `SEAT_POSITION` map, and `seatForPosition` helper. Passes `tokens={gameState.tokens.filter((t) => t.seat === p.seat)}` to each `PlayerCard`. Board + dice remain centered; chat aside unchanged.
- Small polish to `token.tsx`: added a glossy top-left radial highlight (`bg-gradient-to-br from-white/70 to-transparent`) for a 3D marble shine; kept the existing inner highlight dot, white border, framer-motion animation, and aria-labels.
- Ran `bun run lint` — passes cleanly (0 errors, 0 warnings) for all in-scope files. `bunx tsc --noEmit` shows only pre-existing errors in files OUTSIDE my scope (`src/lib/ludo/board.ts:90` intentional — `HOME_COLUMN_CELLS` deliberately omits purple/orange; `mini-services/game-service/index.ts`; `src/app/api/lobby/route.ts`; skill examples). All 4 of my edited files compile cleanly.

Stage Summary:
- Files updated: `src/components/game/ludo-board.tsx`, `src/components/game/player-card.tsx`, `src/components/game/game-room.tsx`, `src/components/game/token.tsx`. Work record saved at `/home/z/my-project/agent-ctx/10-board-polish.md`.
- Key visual changes: board no longer crashes for 5-6 player games (purple/orange handled off-board); Ludo King-style start arrows + tinted home columns + center crown + physical-board frame + pulsing turn glow; PlayerCard shows compact off-board Base + Home strip for purple/orange; game-room uses responsive auto-fit grid for 2–6 players; token pawn has a 3D glossy shine. Existing 4-player games continue to render unchanged.

---
Task ID: 11
Agent: main
Task: Social links (Instagram), 5-6 player support, Ludo King UI polish.

Work Log:
- **Social links**: updated `src/components/ui/footer.tsx` — removed GitHub, added Instagram (lucide `Instagram` icon, links to instagram.com/ludostars). Kept Twitter. This footer is shared by landing + dashboard.
- **Engine 6-color support** (`src/lib/ludo/engine.ts`): added `purple` (seat 4, start=6) and `orange` (seat 5, start=32) to `Color`, `COLORS`, `COLOR_START`, `HOME_ENTRY`. Added 6 & 32 to `SAFE_SQUARES`. Updated `maxPlayers` comment to `2|3|4|5|6`. Engine internals (moveForward/moveBackward/applyRoll/applyMove/passTurn) are generic over maxPlayers, so 5-6 work without further changes.
- **Board geometry 6-color** (`src/lib/ludo/board.ts`): `BASE_DOCKS` now has purple/orange entries (placeholder -1,-1 cells since there's no room on the 15x15 grid). `BASE_REGIONS` changed to `Partial` (only 4 standard colors have on-grid regions). `HOME_COLUMN_CELLS` changed to `Partial` (purple/orange have no on-grid home column — 15x15 Ludo board only has 4 approach directions to center). Added `ON_BOARD_COLORS` set + `isOnBoardColor()`. `posToCell`/`baseDockCell` now return `Cell | null` — null when a purple/orange token is in base or home column (rendered off-board instead). Added purple/orange to all color class maps (COLOR_BG, COLOR_BG_SOFT, COLOR_BORDER, COLOR_TEXT, COLOR_DOT).
- **Lobby 5-6 players**: `src/app/api/lobby/route.ts` `validateCreate` now accepts `[2,3,4,5,6]`. Fixed a TS error with bot playerRows typing (userId: string | null). `src/components/lobby/create-game-dialog.tsx` max-players Select now offers 5 & 6 player options. Game-service `clampMaxPlayers` now caps at 6.
- **Passing mode+maxPlayers to websocket**: the websocket `room:join` defaults to 4 players if maxPlayers isn't sent. Added `RoomConfig { mode?, maxPlayers? }` to `src/lib/ludo/client.ts`; `createGameSocket` + `useGameRoom` now accept and forward config in the `room:join` emit. `src/app/page.tsx` (server component) now does a DB lookup (`db.game.findUnique`) to read the persisted Game row's mode+maxPlayers and passes them to `GameHost` → `GameRoom` → `useGameRoom`. `game-host.tsx` and `game-room.tsx` updated to accept + forward these props.
- **Board UI 6-color + Ludo King polish** (subagent Task 10-board-polish): `ludo-board.tsx` fixed 6-color crashes (guards undefined BASE_REGIONS/HOME_COLUMN_CELLS for purple/orange; `getTokenPlacement` adds `offBoard` flag → skips rendering those tokens on-grid). Ludo King polish: colored start squares with clockwise arrow chevrons, home-column approach cells use soft tint (last cell full color), center finish with 4 triangles + Crown icon, board wrapped in rounded bordered shadowed frame, pulsing emerald turn-glow on the board when it's your roll/move, clean slate cell borders. `player-card.tsx` renders off-board mini Base + Home strips for purple/orange (4 dock circles + 6 home cells with crown). `game-room.tsx` uses responsive auto-fit grid for 2-6 player cards. `token.tsx` glossy 3D marble shine.

Verification (agent-browser, via Caddy port 81):
- ✅ Footer shows Instagram + Twitter (GitHub removed).
- ✅ Create Private Room dialog offers 5 & 6 player options.
- ✅ Created a 6-player classic room (1 human + 5 bots). DB row confirmed maxPlayers=6.
- ✅ `[room:join]` payload carries maxPlayers=6 → room created with `max=6`.
- ✅ Lobby shows "6/6 players" with 6 seats (alice + Bot Delta/Sigma/Sigma/Kappa/Alpha).
- ✅ Started the game; service log: "game started — 6 players (1 human, 5 bot)".
- ✅ All 6 seats cycled through turns: seat 0 (alice) → BOT seat 1 (Bot Delta) → BOT seat 2 (Bot Sigma) → BOT seat 3 (Bot Sigma) → BOT seat 4 (Bot Kappa, purple) → BOT seat 5 (Bot Alpha, orange).
- ✅ Purple player card renders "purple base docks" + "purple home column" off-board strips.
- ✅ Dice rolling + token moves work in the 6-player game.
- ✅ No runtime errors in dev.log or browser console. Lint + tsc clean.

Stage Summary:
- 5 and 6 player games fully supported end-to-end (lobby → DB → websocket → engine → board → bot AI).
- Purple & orange players (seats 4 & 5) share the 52-cell track; their bases + home columns render as compact off-board strips in their PlayerCards (since the 15x15 Ludo board physically only has 4 corner bases / 4 center-approach directions).
- Board polished to Ludo King style: colored start squares with direction arrows, safe-star markings, colored home columns, crowned center, framed board, turn glow.
- Social links: Instagram (no GitHub).

---
Task ID: 12-ui-audit
Agent: ui-audit-subagent
Task: Production UI audit & polish (loading/empty/error states, responsive, a11y, dark mode)

Work Log:
- Read `/home/z/my-project/worklog.md` (Tasks 1, 7, 9, 10, 11) for project context. The app is a full-stack Ludo game (Next.js 16 + shadcn/ui + Tailwind 4 + next-themes light/dark) with auth, friends, lobby, real-time socket.io play, 2-6 player support, and a twist rule (backward moves).
- Audited all in-scope UI files: `landing.tsx`, `dashboard.tsx`, `top-nav.tsx`, `theme-toggle.tsx`, `stats-cards.tsx`, `game-room.tsx`, `ludo-board.tsx`, `player-card.tsx`, `dice.tsx`, `token.tsx`, `direction-picker.tsx`, `chat-panel.tsx`, `game-over-modal.tsx`, `create-game-dialog.tsx`, `join-game-dialog.tsx`, `game-history.tsx`, `quick-play.tsx`, `friends-panel.tsx`, `auth-form.tsx`, `user-menu.tsx`, `footer.tsx`, `layout.tsx`, `page.tsx`, `app-providers.tsx`.
- Confirmed prior work:
  - Loading states: auth-form (`submitting`), create-game-dialog (`mutation.isPending`), join-game-dialog (`joinByCode.isPending` / `joinActive.isPending`), quick-play (`quickMutation.isPending`), friends-panel (skeleton loaders + per-mutation `isPending`), game-history (`query.isLoading` spinner + Retry button on `isError`). All async actions show spinners + disable. ✅
  - Empty states: friends-panel Friends/Find/Requests tabs each have `EmptyState`; chat-panel already had "No messages yet. Say hi 👋". ✅ (Existing emoji in chat-panel left intact per the "don't add emojis" rule.)
  - Footer: rendered on landing (line 117) + dashboard (line 135); correctly uses `mt-auto`; layout.tsx body has `flex min-h-screen flex-col`; landing main wrapper `flex-1 flex-col`; dashboard wrapper `flex-1 flex-col`. Game room omits footer intentionally (immersive UI, acceptable per task spec).
  - Responsive: dashboard `lg:grid-cols-3`; game-room `lg:flex-row` board+chat, auto-fit `minmax(160px, 1fr)` player-card grid scales 2-6; board `max-w-[min(95vw,600px)]`; chat `h-64 w-full lg:h-auto lg:w-80`. ✅
  - A11y: TopNav logo aria-label, ThemeToggle aria-label, UserMenu aria-label, Dice aria-label, Token aria-label per token, CellView start/star aria-labels, DirectionPicker aria-label, ChatPanel `aria-label="Room chat"`, Footer nav `aria-label="Footer"`. ✅
- Found & fixed specific issues:
  - `ludo-board.tsx` — track/star/center/start/home cells + board frame used `bg-white` + light `border-slate-*` colors that render as jarring pure-white blocks in dark mode. Added dark variants (`dark:bg-slate-900`, `dark:border-slate-700`, `dark:border-slate-200/40`) to every cell type and the outer frame so the board adapts to theme.
  - `game-room.tsx` — `useGameRoom.error` was only surfaced in the LobbyView banner; in-game errors were silently swallowed. Added a `useEffect(() => { if (error) toast.error(error) }, [error])` so errors toast in BOTH lobby and in-game views. Also added a prominent full-width amber "Connection lost — trying to reconnect…" banner (AnimatePresence + framer-motion height animation, `role="status"`, `WifiOff` icon) that slides in below the header when the socket drops mid-game. Upgraded the tiny "● Connected / ○ Reconnecting…" header indicator to use proper icons (emerald dot when connected, pulsing `WifiOff` when reconnecting) with `aria-live="polite"`. Added `aria-label="Copy room code"` (and dynamic "Room code copied") and `aria-label="Leave room"` to the header's icon-only-on-mobile Copy and Leave buttons.
  - `game-history.tsx` — empty state was plain text ("No games yet. Create or join a game to get started!") with no CTA. Replaced with a Trophy icon + headline "No games yet — start playing!" + helpful description + a "Create a game" button that opens the `CreateGameDialog`. Imported `CreateGameDialog` + `Dices` icon.
  - `join-game-dialog.tsx` — empty open-rooms state was plain text ("No open rooms right now. Create one and invite a friend!") with no CTA. Replaced with a Users icon + the message "No open rooms right now — create one!" + an inline "Create room" button that does a quick POST `/api/lobby` (4-player classic, 0 bots) + navigates to the new room via `gotoRoom`. Proper loading state via `quickCreate.isPending` (Loader2 spinner). Imported `Dices` icon + added the `quickCreate` mutation.

Stage Summary:
- Files updated: `src/components/game/ludo-board.tsx`, `src/components/game/game-room.tsx`, `src/components/lobby/game-history.tsx`, `src/components/lobby/join-game-dialog.tsx`. Work record saved at `/home/z/my-project/agent-ctx/12-ui-audit.md`.
- Key fixes: (1) dark-mode-aware board cells (the previous `bg-white` rendered as a pure-white slab in dark mode); (2) game-room errors now toast in both lobby and in-game views (previously swallowed mid-game); (3) a prominent animated "Connection lost — reconnecting…" banner replaces the easily-missed inline text indicator; (4) game-history empty state gains a "Create a game" CTA button; (5) join-game-dialog empty rooms state gains an inline "Create room" quick-action button; (6) aria-labels added to the game-room header's icon-only-on-mobile Copy/Leave buttons.
- No game logic, engine, bot AI, websocket protocol, API routes, or game-service code was touched. No new dependencies added.
- Lint status: `bun run lint` — passes cleanly (0 errors, 0 warnings) for all in-scope files. The single remaining project-wide warning is in `src/app/global-error.tsx` (outside my scope — pre-existing unused eslint-disable directive).
- Prettier status: `bunx prettier --check "src/components/game/ludo-board.tsx" "src/components/game/game-room.tsx" "src/components/lobby/game-history.tsx" "src/components/lobby/join-game-dialog.tsx"` — all pass. (4 other files outside my scope — `src/app/{error,global-error,loading}.tsx`, `src/lib/db.ts` — still have prettier issues; not touched.)
- Dev server (`bun run dev`) — re-compiles cleanly after each edit; no runtime errors logged.

---
Task ID: 13
Agent: main
Task: Production-readiness pass — format, clean logs, error boundaries, UI polish, hostability verification.

Work Log:
- **Code formatting**: installed `prettier` + `prettier-plugin-tailwindcss` (dev deps). Added `.prettierrc.json` (semi:false, singleQuote, trailingComma:all, printWidth:90, tailwindcss plugin) and `.prettierignore`. Ran `prettier --write` on all `src/**/*.{ts,tsx,css}` + `mini-services/game-service/index.ts`. Added `format` + `format:check` scripts to package.json. All files now use consistent Prettier style.
- **Removed debug logs**: stripped verbose per-roll/move diagnostic `console.log` calls from `mini-services/game-service/index.ts` (kept operational lifecycle logs: room create/destroy/join/leave/start/over). Silenced Prisma query logging in production (`src/lib/db.ts` now uses `['error','warn']` in prod, `['query','error','warn']` in dev).
- **Error boundaries**: added `src/app/error.tsx` (route-level, keeps layout shell), `src/app/global-error.tsx` (global, replaces document), and `src/app/loading.tsx` (route loading state with spinner). All use semantic HTML, lucide icons, retry + go-home buttons, error digest display.
- **UI polish (subagent Task 12)**: dark-mode-aware board cells (`bg-white dark:bg-slate-900`), error visibility via toast in game room (both lobby + in-game), reconnecting banner with WifiOff icon + aria-live, game-history empty state with CTA, join-game-dialog empty state with quick-create button, aria-labels on icon-only mobile buttons.
- **Copy fixes**: updated landing hero + quick-play button to say "2–6 players" (was "2/3/4"). Landing feature bullet updated to "2–6 players".
- **Production config**: created `.env.example` (documents DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL). Updated package.json `name` to "ludo-stars", version to "1.0.0", added `game-service` script.
- **README**: comprehensive `README.md` with features, architecture diagram, getting started (dev + prod), scripts table, twist-rule explanation, bot AI explanation, tech stack, project structure.
- **Type fix**: fixed Prisma `log` type error in `src/lib/db.ts` (inline ternary instead of extracted variable).

Verification:
- ✅ `bun run build` — production build succeeds (compiled in 17.8s, 9 routes generated, 0 errors).
- ✅ `bun run lint` — 0 errors, 0 warnings.
- ✅ `prettier --check` — all files formatted.
- ✅ `tsc --noEmit` — 0 app errors (mini-services TS error is expected: separate Bun project using .ts import extensions, handled natively by Bun).
- ✅ Agent-browser end-to-end: landing (Instagram+Twitter footer, no GitHub) → login → dashboard (dark mode toggle works) → create 6-player twist room → start game → roll 6 → release token → roll until direction picker appears → click Backward → twist move executes.
- ✅ All 3 services healthy: Next.js (3000), game-service (3003), Caddy (81).

Stage Summary:
- The app is production-ready and hostable: `bun run build` succeeds, all code is formatted + linted + type-checked, error boundaries + loading states in place, debug logs removed, README + .env.example documentation complete.
- To host: set NEXTAUTH_SECRET + NEXTAUTH_URL in .env, run `bun run build && bun run start`, and separately run the game-service (`cd mini-services/game-service && bun run start`).
