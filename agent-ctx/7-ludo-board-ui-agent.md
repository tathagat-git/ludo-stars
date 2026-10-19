# Task 7 — Ludo Board UI Subagent — Work Record

## Task scope
Build the React UI layer for the Ludo Stars game board. Files:

- `src/lib/ludo/client.ts` — socket helper + `useGameRoom` hook.
- `src/components/game/token.tsx` — single colored pawn.
- `src/components/game/dice.tsx` — die + Roll Dice button.
- `src/components/game/direction-picker.tsx` — Popover for picking forward/backward.
- `src/components/game/player-card.tsx` — player avatar panel.
- `src/components/game/chat-panel.tsx` — in-room chat.
- `src/components/game/game-over-modal.tsx` — final standings modal with CSS confetti.
- `src/components/game/ludo-board.tsx` — the 15x15 grid board.
- `src/components/game/game-room.tsx` — top-level game room layout (lobby + in-game + game-over).

## Imports from Task 1 (engine.ts + board.ts)
The board reads:
- `GameState`, `Token`, `LegalMove`, `Color`, `COLORS`, `COLOR_START` from `engine.ts`.
- `posToCell`, `baseDockCell`, `cellToTrackIndex`, `HOME_COLUMN_CELLS`, `BASE_DOCKS`, `BASE_REGIONS`, `CENTER_CELL`, `STAR_CELLS`, `COLOR_BG`, `COLOR_BORDER`, `COLOR_DOT` from `board.ts`.
- Helpers `isInBase`, `isFinished` from `engine.ts`.

## Socket events used (in `src/lib/ludo/client.ts`)

**Client → server** (the `EV` constant):
| Constant            | Event name       | Payload                                  |
|---------------------|------------------|------------------------------------------|
| `EV.ROOM_JOIN`      | `room:join`      | `{ code, userId, username }`             |
| `EV.ROOM_READY`     | `room:ready`     | (none)                                   |
| `EV.ROOM_START`     | `room:start`     | (none)                                   |
| `EV.ROOM_ADD_BOT`   | `room:add-bot`   | (none)                                   |
| `EV.ROOM_REMOVE_BOT`| `room:remove-bot`| (none — server removes the last-added bot)|
| `EV.ROOM_LEAVE`     | `room:leave`     | (none)                                   |
| `EV.GAME_ROLL`      | `game:roll`      | (none)                                   |
| `EV.GAME_MOVE`      | `game:move`      | `{ tokenId, direction }`                 |
| `EV.CHAT_MESSAGE`   | `chat:message`   | `{ content }`                            |

**Server → client** (the `SERVER_EV` constant):
| Constant             | Event name      | Payload                                                          |
|----------------------|-----------------|------------------------------------------------------------------|
| `SERVER_EV.ROOM_STATE`   | `room:state`    | `RoomState` (full room snapshot — see interface in client.ts)   |
| `SERVER_EV.ROOM_JOINED`  | `room:joined`   | `{ roomId, code, seat, mode, maxPlayers }`                       |
| `SERVER_EV.ROOM_ERROR`   | `room:error`    | `{ message }`                                                    |
| `SERVER_EV.GAME_STARTED` | `game:started`  | `{ gameState: GameState }` (wrapped)                             |
| `SERVER_EV.GAME_STATE`   | `game:state`    | `GameState` (direct)                                             |
| `SERVER_EV.GAME_EVENT`   | `game:event`    | `GameEvent` (the last event)                                     |
| `SERVER_EV.GAME_OVER`    | `game:over`     | `{ winners: number[], players: Player[] }`                       |
| `SERVER_EV.CHAT_MESSAGE` | `chat:message`  | `{ userId, username, content, timestamp }`                      |

**Important payload quirks confirmed by reading `mini-services/game-service/index.ts`:**
- `room:state` returns the full room snapshot with shape `{ id, code, mode, maxPlayers, botCount, seats: SeatInfo[], gameState: GameState|null, hostUserId, yourSeat, started, phase }`. `seats` only contains *filled* seats (no nulls).
- `room:joined` returns only metadata (roomId/code/seat/mode/maxPlayers); the full state arrives separately via `room:state`.
- `game:started` wraps the state in `{ gameState }`.
- `game:over` payload is `{ winners, players }` (not a full `GameState`).
- `chat:message` has no `id`/`type` fields; the client generates a synthetic id.
- `room:remove-bot` ignores any payload and removes the last-added bot.

## Layout / UX
- The 15x15 board uses `display: grid` with `gridTemplateColumns: repeat(15, 1fr)` inline style (Tailwind `grid-cols-15` doesn't exist). Each cell is `aspect-square`.
- Tokens are absolutely-positioned overlays (percentage-based top/left/width/height) with framer-motion `layout` for animated moves.
- 4 colored triangles in the center cell (CSS `clip-path: polygon(...)`).
- Each base region is a 5x5 colored block (from `BASE_REGIONS`) with the 4 dock circles rendered as inner white-bordered circles.
- Legal-move destinations get a pulsing `ring-2 ring-emerald-400` overlay.
- Clicking a legal token: if only one direction is legal → calls `onTokenClick(tokenId, dir)` immediately; if both directions are legal → opens the `DirectionPicker` popover.
- 4 player cards around the board: red bottom, green left, yellow top, blue right (matches Ludo King orientation).
- On mobile, the side players collapse into a 2-col grid below the board.
- Dice glows (emerald ring) when it's the local player's turn.
- Lobby view: copyable room code, seat list with Ready/Add Bot/Remove Bot/Start buttons (host-only restrictions enforced).
- Game-over modal: animated rankings + CSS confetti + Play Again / Exit buttons.

## Accessibility
- All buttons ≥ 44px (mobile touch target).
- `aria-label`s on tokens, dice button, chat input, send button, room code copy.
- Semantic HTML: `<main>`, `<header>`, `<section>`, `<aside>`, `<footer>`.
- `aria-live="polite"` on the last-event ticker.

## Verification
- `bun run lint` — passes (0 errors, 0 warnings).
- `bunx tsc --noEmit` — no errors in any of the new files.
- `socket.io-client` package installed via `bun add socket.io-client`.
- Dev server compiles cleanly (verified via `dev.log`).

## Files written
```
src/lib/ludo/client.ts
src/components/game/token.tsx
src/components/game/dice.tsx
src/components/game/direction-picker.tsx
src/components/game/player-card.tsx
src/components/game/chat-panel.tsx
src/components/game/game-over-modal.tsx
src/components/game/ludo-board.tsx
src/components/game/game-room.tsx
```
