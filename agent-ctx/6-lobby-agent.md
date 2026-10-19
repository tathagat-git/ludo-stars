# Task 6 — Game Lobby (create / join / list games)

**Agent**: lobby-agent
**Scope**: Lobby API routes + UI components (Dashboard entry points for
creating/joining/previewing/leaving/starting/finishing Ludo games).

## Files created (ALL mine)

### Shared helpers
- `src/lib/lobby.ts`
  - `generateRoomCode()` — 6-char A–Z/2–9 (no 0/O/1/I ambiguity).
  - `generateUniqueRoomCode(isUnique)` — retry-until-unique helper.
  - `toLobbyGameDTO(game)` — serializer producing a safe JSON shape for
    UI consumption (no User.passwordHash leaks).
  - `SEAT_TO_PLAYER_FIELD` / `PLAYER_FIELD_TO_SEAT` — seat index ↔
    `playerNId` field-name map.
  - `SEAT_COLORS = ['red','green','yellow','blue']` (matches engine).
  - Types: `GameMode`, `GameStatus`, `LobbyGameDTO`, `LobbyGamePlayerDTO`.

### API routes
| Method | Path                                       | Purpose                                           |
|--------|--------------------------------------------|---------------------------------------------------|
| POST   | `/api/lobby`                               | Create a new game room (host = seat 0)             |
| GET    | `/api/lobby`                               | Current user's 20 most recent games                |
| GET    | `/api/lobby/active`                        | Open (waiting + joinable) rooms, max 20            |
| GET    | `/api/lobby/[code]`                        | Fetch a single game by room code                   |
| POST   | `/api/lobby/[code]/join`                   | Join a waiting game (next free seat)               |
| POST   | `/api/lobby/[code]/leave`                  | Leave a waiting game (host reassignment / cleanup)  |
| POST   | `/api/lobby/[code]/start`                  | Mark game as `playing` (host-only, persistence only)|
| POST   | `/api/lobby/[code]/finish`                 | Mark game as `finished`, set ranks, update stats   |

**Auth**: all routes call `getServerSession(authOptions)` (import from
`@/lib/auth`, provided by Task 4-a). 401 on missing session.
**Idempotency**: `join`/`leave`/`start`/`finish` are idempotent.
**Stats**: `/finish` increments `User.gamesPlayed` for all human seats,
`User.wins` for the 1st-place human, `User.losses` for other humans.

### UI components (`src/components/lobby/`)
- `create-game-dialog.tsx`
  - **Exports**: `CreateGameDialog`, `gotoRoom`
  - Props: `trigger?: React.ReactNode` (default = "Create Game" button)
  - Mode radio (Classic / Twist), max-players select, bot-count select.
  - Twist mode explained via `Tooltip`.
  - On submit → `POST /api/lobby` → `window.location.search = '?room=<code>'`.
- `join-game-dialog.tsx`
  - **Exports**: `JoinGameDialog`
  - Props: `trigger?: React.ReactNode`
  - Two paths: enter room code (auto-normalized to A–Z/2–9) OR browse open
    rooms (`GET /api/lobby/active`).
  - Joining → `POST /api/lobby/[code]/join` → navigate to `?room=<code>`.
  - Self-hosted `QueryClientProvider` + `SonnerToaster`.
- `game-history.tsx`
  - **Exports**: `GameHistory`
  - Fetches `GET /api/lobby`, renders user's last 20 games.
  - Shows date, mode, result (Win/Loss/Unfinished), players, bots.
  - Empty + loading + error states.
  - Mobile-responsive, custom thin scrollbar (`max-h-96 overflow-y-auto`).
- `quick-play.tsx`
  - **Exports**: `QuickPlay`
  - Dashboard card with two large buttons:
    1. "Play vs Bots" → creates `{mode:'twist', maxPlayers:4, botCount:3}` → goto room
    2. "Create Private Room" → renders `<CreateGameDialog trigger={...} />`

## Temporary stub created (NOT mine — Task 7 will overwrite)
- `src/components/game/game-room.tsx` — minimal placeholder so the Next.js
  dev server compiles while Task 7 finishes the real GameRoom component.
  This stub clearly states at the top that Task 7 SHOULD OVERWRITE it.

## Test results
All endpoints verified by curl + browser-style cookie session:
- `POST /api/lobby` → 201, returns `{game, code}` ✓
- `GET /api/lobby` → 200, returns user's games ✓
- `GET /api/lobby/[code]` → 200, returns game with players ✓
- `POST /api/lobby/[code]/join` → 200, assigns next free seat ✓
- `POST /api/lobby/[code]/leave` → 200, removes GamePlayer ✓
- `POST /api/lobby/[code]/start` → 200 (host), 403 (non-host) ✓
- `POST /api/lobby/[code]/finish` → 200, sets ranks + user stats ✓
- `POST /api/lobby/[code]/finish` again → 200 (idempotent) ✓
- `POST /api/lobby/ZZZZZZ/join` → 404 ✓
- `GET /api/lobby` without auth → 401 ✓
- `GET /api/lobby/active` → 200, returns joinable waiting games ✓

## Lint status
- All lobby files (`src/app/api/lobby/**`, `src/components/lobby/**`,
  `src/lib/lobby.ts`, `src/components/game/game-room.tsx`) pass
  `bunx eslint` cleanly.
- Project-wide `bun run lint` still shows 1 error + 1 warning in
  `src/components/game/dice.tsx` and `src/lib/ludo/client.ts` — those
  belong to Task 5/7, not my scope.

## Dependencies / assumptions
- Imports `authOptions` from `@/lib/auth` (provided by Task 4-a).
- Uses `randomBotName` from `@/lib/ludo/bot` (provided by Task 1).
- Uses Prisma models `Game`, `GamePlayer`, `User` (Task 1 schema).
- Game-room stub at `@/components/game/game-room` will be replaced by Task 7.
- The `?room=<code>` query param is read by Task 8's `page.tsx` to render
  the game room. My UI writes to `window.location.search` to navigate.
