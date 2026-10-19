// Board geometry: maps game positions (track indices, home column cells) to
// (row, col) coordinates on a 15x15 grid for rendering. Also defines the
// 4 colored bases and the 4 home bases (token "docks" in base).

import { Color, COLOR_START, HOME_ENTRY, COLORS } from './engine'

export interface Cell {
  row: number
  col: number
}

// 52-cell main track, indexed 0..51, going clockwise from Red's start.
// Layout (15x15 grid):
//   Red    base = bottom-left  (rows 9-13, cols 1-5),   start (13,6), home col = col 7 rows 13→8
//   Green  base = top-left     (rows 1-5, cols 1-5),    start (6,0),  home col = row 7 cols 1→5
//   Yellow base = top-right    (rows 1-5, cols 9-13),  start (0,8),  home col = col 7 rows 1→5... wait
//
// Let me just commit to this track ordering (clockwise from Red start):

export const TRACK_CELLS: Cell[] = [
  // 0..5  — bottom arm LEFT column, going UP (col 6, rows 13→8)
  { row: 13, col: 6 }, // 0  Red start
  { row: 12, col: 6 }, // 1
  { row: 11, col: 6 }, // 2
  { row: 10, col: 6 }, // 3
  { row: 9, col: 6 },  // 4
  { row: 8, col: 6 },  // 5
  // 6..11 — left arm BOTTOM row, going LEFT (row 8, cols 5→0)
  { row: 8, col: 5 }, // 6
  { row: 8, col: 4 }, // 7
  { row: 8, col: 3 }, // 8
  { row: 8, col: 2 }, // 9
  { row: 8, col: 1 }, // 10
  { row: 8, col: 0 }, // 11
  // 12..13 — left arm LEFT column, going UP (col 0, rows 7→6)
  { row: 7, col: 0 }, // 12 Green homeEntry
  { row: 6, col: 0 }, // 13 Green start
  // 14..18 — top arm LEFT column, going RIGHT (row 6, cols 1→5)
  { row: 6, col: 1 }, // 14
  { row: 6, col: 2 }, // 15
  { row: 6, col: 3 }, // 16
  { row: 6, col: 4 }, // 17
  { row: 6, col: 5 }, // 18
  // 19..24 — top arm LEFT column, going UP (col 6, rows 5→0)
  { row: 5, col: 6 }, // 19
  { row: 4, col: 6 }, // 20
  { row: 3, col: 6 }, // 21
  { row: 2, col: 6 }, // 22
  { row: 1, col: 6 }, // 23
  { row: 0, col: 6 }, // 24 Yellow homeEntry
  // 25..26 — top row, going RIGHT (row 0, cols 7→8)
  { row: 0, col: 7 }, // 25 Yellow start
  { row: 0, col: 8 }, // 26
  // 27..31 — top arm RIGHT column, going DOWN (col 8, rows 1→5)
  { row: 1, col: 8 }, // 27
  { row: 2, col: 8 }, // 28
  { row: 3, col: 8 }, // 29
  { row: 4, col: 8 }, // 30
  { row: 5, col: 8 }, // 31
  // 32..37 — right arm TOP row, going RIGHT (row 6, cols 9→14)
  { row: 6, col: 9 },  // 32
  { row: 6, col: 10 }, // 33
  { row: 6, col: 11 }, // 34
  { row: 6, col: 12 }, // 35
  { row: 6, col: 13 }, // 36
  { row: 6, col: 14 }, // 37 Blue homeEntry
  // 38..39 — right arm RIGHT column, going DOWN (col 14, rows 7→8)
  { row: 7, col: 14 }, // 38 Blue start
  { row: 8, col: 14 }, // 39
  // 40..45 — right arm BOTTOM row, going LEFT (row 8, cols 13→9)
  { row: 8, col: 13 }, // 40
  { row: 8, col: 12 }, // 41
  { row: 8, col: 11 }, // 42
  { row: 8, col: 10 }, // 43
  { row: 8, col: 9 },  // 44
  // 45..50 — bottom arm RIGHT column, going DOWN (col 8, rows 9→14)
  { row: 9, col: 8 },  // 45
  { row: 10, col: 8 }, // 46
  { row: 11, col: 8 }, // 47
  { row: 12, col: 8 }, // 48
  { row: 13, col: 8 }, // 49
  { row: 14, col: 8 }, // 50
  // 51 — bottom row, going LEFT (row 14, col 7)
  { row: 14, col: 7 }, // 51 Red homeEntry
]

// Home columns: each standard color has 6 cells leading from the track
// perimeter to the center (7,7). Position 100 = first cell, 105 = center.
// Order: from track → center. Purple & orange have NO on-grid home column
// (they render off-board in the PlayerCard), so their entries are empty.
export const HOME_COLUMN_CELLS: Partial<Record<Color, Cell[]>> = {
  // Red: from (13,7) going UP to (8,7)
  red: [
    { row: 13, col: 7 }, // 100
    { row: 12, col: 7 }, // 101
    { row: 11, col: 7 }, // 102
    { row: 10, col: 7 }, // 103
    { row: 9, col: 7 },  // 104
    { row: 8, col: 7 },  // 105 (center)
  ],
  // Green: from (7,1) going RIGHT to (7,6)
  green: [
    { row: 7, col: 1 }, // 100
    { row: 7, col: 2 }, // 101
    { row: 7, col: 3 }, // 102
    { row: 7, col: 4 }, // 103
    { row: 7, col: 5 }, // 104
    { row: 7, col: 6 }, // 105 (center)
  ],
  // Yellow: from (1,7) going DOWN to (6,7)
  yellow: [
    { row: 1, col: 7 }, // 100
    { row: 2, col: 7 }, // 101
    { row: 3, col: 7 }, // 102
    { row: 4, col: 7 }, // 103
    { row: 5, col: 7 }, // 104
    { row: 6, col: 7 }, // 105 (center)
  ],
  // Blue: from (7,13) going LEFT to (7,8)
  blue: [
    { row: 7, col: 13 }, // 100
    { row: 7, col: 12 }, // 101
    { row: 7, col: 11 }, // 102
    { row: 7, col: 10 }, // 103
    { row: 7, col: 9 },  // 104
    { row: 7, col: 8 },  // 105 (center)
  ],
}

// Token "docks" inside each base (4 cells per color, where the 4 tokens sit
// before being released).
//
// For the 4 standard colors (red/green/yellow/blue) the docks sit inside the
// corner base regions on the 15x15 grid. For purple & orange (the extra
// 5-6 player colors) there is no room on the grid, so their docks are
// rendered off-board inside the PlayerCard — these dock entries are still
// defined (used by the off-board strip renderer) but use placeholder cells
// that the board grid simply never reads (the board skips purple/orange
// tokens that are in base/home-column).
export const BASE_DOCKS: Record<Color, Cell[]> = {
  red: [
    { row: 10, col: 2 },
    { row: 10, col: 4 },
    { row: 12, col: 2 },
    { row: 12, col: 4 },
  ],
  green: [
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
    { row: 4, col: 4 },
  ],
  yellow: [
    { row: 2, col: 10 },
    { row: 2, col: 12 },
    { row: 4, col: 10 },
    { row: 4, col: 12 },
  ],
  blue: [
    { row: 10, col: 10 },
    { row: 10, col: 12 },
    { row: 12, col: 10 },
    { row: 12, col: 12 },
  ],
  // Purple & orange docks are placeholders (-1,-1) — rendered off-board by
  // the PlayerCard's mini base strip, never on the 15x15 grid.
  purple: [
    { row: -1, col: -1 },
    { row: -1, col: -1 },
    { row: -1, col: -1 },
    { row: -1, col: -1 },
  ],
  orange: [
    { row: -1, col: -1 },
    { row: -1, col: -1 },
    { row: -1, col: -1 },
    { row: -1, col: -1 },
  ],
}

// Base region (the 5x5 colored area in each corner). Only the 4 standard
// colors have on-grid base regions; purple & orange are rendered off-board.
export const BASE_REGIONS: Partial<Record<Color, { row: number; col: number; color: Color }>> = {
  red: { row: 11, col: 3, color: 'red' },
  green: { row: 3, col: 3, color: 'green' },
  yellow: { row: 3, col: 11, color: 'yellow' },
  blue: { row: 11, col: 11, color: 'blue' },
}

// Colors that render their base + home column on the 15x15 grid (the 4
// standard corner colors). Purple & orange render off-board.
export const ON_BOARD_COLORS: ReadonlySet<Color> = new Set<Color>(['red', 'green', 'yellow', 'blue'])

/// True if a color's base + home column is rendered on the 15x15 grid.
export function isOnBoardColor(color: Color): boolean {
  return ON_BOARD_COLORS.has(color)
}

// Center finish cell (the dead center of the 15x15 grid).
export const CENTER_CELL: Cell = { row: 7, col: 7 }

/// Convert an encoded token position to a (row, col) cell on the 15x15 grid.
/// Returns `null` when the token should be rendered OFF the grid — this
/// happens for purple & orange (the 5-6 player extra colors) when they are
/// in base or in their home column. Those tokens are drawn inside their
/// PlayerCard's mini base/home strip instead. Track positions and the
/// center finish are always on-grid for every color.
export function posToCell(pos: number, seat: number): Cell | null {
  const color = COLORS[seat]
  if (!color) return null
  if (pos === -1) {
    // In base. Standard colors: dock on-grid. Purple/orange: off-grid.
    if (!isOnBoardColor(color)) return null
    return BASE_DOCKS[color]![0]!
  }
  if (pos === 200) {
    // Finished — every color finishes at the center.
    return CENTER_CELL
  }
  if (pos >= 0 && pos <= 51) {
    // On the shared track — always on-grid for every color.
    return TRACK_CELLS[pos]!
  }
  if (pos >= 100 && pos <= 105) {
    // Home column. Standard colors: on-grid. Purple/orange: off-grid strip.
    if (!isOnBoardColor(color)) return null
    const cells = HOME_COLUMN_CELLS[color]
    return cells ? cells[pos - 100]! : null
  }
  return CENTER_CELL
}

/// Get the dock cell for a specific token in base. Returns null for the
/// off-board colors (purple/orange) — caller should render those off-board.
export function baseDockCell(seat: number, tokenIndex: number): Cell | null {
  const color = COLORS[seat]
  if (!color || !isOnBoardColor(color)) return null
  return BASE_DOCKS[color]![tokenIndex % 4]!
}

// Color → Tailwind class map for cell backgrounds.
export const COLOR_BG: Record<Color, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
}

export const COLOR_BG_SOFT: Record<Color, string> = {
  red: 'bg-red-100',
  green: 'bg-green-100',
  yellow: 'bg-yellow-100',
  blue: 'bg-blue-100',
  purple: 'bg-purple-100',
  orange: 'bg-orange-100',
}

export const COLOR_BORDER: Record<Color, string> = {
  red: 'border-red-500',
  green: 'border-green-500',
  yellow: 'border-yellow-400',
  blue: 'border-blue-500',
  purple: 'border-purple-500',
  orange: 'border-orange-500',
}

export const COLOR_TEXT: Record<Color, string> = {
  red: 'text-red-600',
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
}

export const COLOR_DOT: Record<Color, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
}

/// Star icon position (the 4 "safe" non-start squares), for rendering a
/// small star glyph on those cells.
export const STAR_CELLS: Cell[] = [
  TRACK_CELLS[8]!,  // row 8 col 3
  TRACK_CELLS[21]!, // row 3 col 6
  TRACK_CELLS[34]!, // row 6 col 11
  TRACK_CELLS[47]!, // row 12 col 8
]

// Track index → cell, reverse lookup (used by the UI to highlight a token's
// track cell).
export function cellToTrackIndex(row: number, col: number): number | null {
  for (let i = 0; i < TRACK_CELLS.length; i++) {
    const c = TRACK_CELLS[i]!
    if (c.row === row && c.col === col) return i
  }
  return null
}
