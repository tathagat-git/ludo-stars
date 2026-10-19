# Task 10-board-polish — board-polish-subagent

## Task
6-color board support + Ludo King UI polish + 5-6 player layout.

## Files Updated
- `src/components/game/ludo-board.tsx` — full rewrite of `getCellInfo` and `getTokenPlacement` to handle the new nullable `posToCell` / `baseDockCell` returns (purple/orange tokens in base or home column). Added Ludo King polish: colored start-square direction arrows, soft-tint home columns with darker final cell, crown in the center, physical-board frame (`rounded-xl border-2 border-slate-800 shadow-2xl`), pulsing emerald turn glow when `state.currentSeat === mySeat` during roll/move.
- `src/components/game/player-card.tsx` — added an off-board **Base** strip (4 docks) and **Home** strip (6 cells, last = crown) for purple/orange players only (`isOnBoardColor(color) === false`). New optional `tokens?: Token[]` prop; only renders the strip when tokens are provided AND the color is off-board.
- `src/components/game/game-room.tsx` — replaced the fixed 4-seat `SEAT_POSITION` layout with a responsive `auto-fit minmax(160px, 1fr)` grid that scales to 2–6 player cards above the board. Removed the now-unused `EmptySeat` component and `SEAT_POSITION`/`seatForPosition` map. Passes `tokens` to each `PlayerCard`. Board + dice remain centered below the player grid; chat aside unchanged.
- `src/components/game/token.tsx` — small visual polish: added a glossy top-left radial highlight (`bg-gradient-to-br from-white/70 to-transparent`) to give the pawn a 3D marble shine; kept the existing inner highlight dot and white border. No API change.

## Key Visual Changes
1. **6-color safe**: Board no longer crashes when `COLORS` contains purple/orange. Tokens whose `posToCell()` returns `null` (purple/orange in base/home-column) carry an `offBoard: true` flag on `TokenPlacement` and are skipped in the render loop — they're drawn in the PlayerCard's off-board strip instead.
2. **Finished purple/orange tokens** still cluster at the center (pos=200 always returns `CENTER_CELL` for every color); added purple→bottom-left-ish and orange→top-right-ish offsets to the finished-token offsets map so all 6 colors cluster visibly without overlapping the 4 standard triangles.
3. **Start squares** (track idx 0, 13, 26, 39, 6, 32) now show a colored background plus a rotated `ArrowRight` chevron pointing along the track's clockwise direction at that cell (red=up, green=right, yellow=down, blue=left, purple=left, orange=right).
4. **Home columns**: approach cells (pos 100–104) use `COLOR_BG_SOFT[color]` (light tint); the final home cell (pos 105, adjacent to center) uses `COLOR_BG[color]` (full color) for emphasis.
5. **Center finish**: kept the 4 standard colored triangles; added a centered `Crown` lucide icon to signify the finish line.
6. **Board frame**: `rounded-xl border-2 border-slate-800 bg-white p-1 shadow-2xl` + inner `ring-1 ring-slate-700/40` for a physical-board look.
7. **Turn glow**: when `mySeat === state.currentSeat` and phase is `roll` or `move`, the board wrapper pulses `ring-4 ring-emerald-400/40`.
8. **Cell borders**: track cells use `border border-slate-200` (clean light-gray grid); base region cells use `border-white/60` so the colored corner blends like a real Ludo board; base dock circles use white border + tint.
9. **Off-board strip** (purple/orange PlayerCard only): compact "Base ● ● ● ●" + "Home ▢ ▢ ▢ ▢ ▢ ★" rows, each cell ~20px, with mini colored tokens drawn at the right index when that token is in base / home column / finished.
10. **2–6 player layout**: cards auto-fit into a responsive grid (2-per-row on mobile, up to 6-per-row on wide desktop). Purple/orange cards are taller (because of the off-board strip) but the grid handles it.
11. **Token polish**: glossy 3D shine overlay; ring/aria-labels unchanged for accessibility.

## Lint & Type Status
- `bun run lint` — passes cleanly (0 errors, 0 warnings) for all in-scope files.
- `bunx tsc --noEmit` — only pre-existing errors remain in files OUTSIDE my scope (`src/lib/ludo/board.ts:90` — intentional: `HOME_COLUMN_CELLS` deliberately omits purple/orange per the main agent's spec; `mini-services/game-service/index.ts`, `src/app/api/lobby/route.ts`, `skills/*` examples). All my edited files compile cleanly.
- Dev server (`bun run dev`) — runs without new compile errors; existing `/` route renders, `/?room=...` route serves the game room.

## Notes for Downstream Agents
- `PlayerCard` now accepts an optional `tokens?: Token[]` prop. The off-board strip only renders when `tokens` is provided AND `!isOnBoardColor(player.color)`. Standard-color cards ignore `tokens` entirely, so other callers (e.g., future spectators) can omit it without breaking.
- The 4 standard colors' PlayerCards remain unchanged visually — their bases are still rendered on the 15x15 grid by `ludo-board.tsx`.
- The `EmptySeat` component was removed from `game-room.tsx` because the new auto-fit layout only iterates `players` (filled seats). In-game, all seats are filled (since the game has started).
