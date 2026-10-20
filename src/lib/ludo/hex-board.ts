// Hex board geometry — generates a hexagonal/pentagonal board layout for
// 5-6 player games, adapted from the Ludo Royale reference design.

import type { Color } from './engine'

export interface HexBoardConfig {
  n: number
  R: number
  ringLen: number
  cellPerPlayer: number
  ids: Color[]
  ring: [number, number][]
  home: Record<string, [number, number][]>
  off: Record<string, number>
  safe: Set<number>
  ang: Record<string, number>
  bc: Record<string, [number, number]>
  slot: (color: Color, i: number) => [number, number]
  FIN: number
  OUT: number
}

const COLORS_6: Color[] = ['red', 'green', 'yellow', 'blue', 'purple', 'orange']

const rad = (a: number) => (a * Math.PI) / 180

function loc(k: number, n: number, lx: number, ly: number): [number, number] {
  const t = rad((k * 360) / n)
  return [lx * Math.cos(t) + ly * Math.sin(t), lx * Math.sin(t) - ly * Math.cos(t)]
}

export function makeHexBoard(n: number): HexBoardConfig {
  const L = 6
  const cellPer = 2 * L + 1
  const r0 = n === 6 ? 2.7 : 2.2
  const ids = COLORS_6.slice(0, n)
  const ring: [number, number][] = []
  const home: Record<string, [number, number][]> = {}
  const off: Record<string, number> = {}
  const ang: Record<string, number> = {}
  const safe = new Set<number>()
  const bc: Record<string, [number, number]> = {}

  ids.forEach((c, k) => {
    ang[c] = (k * 360) / n
    for (let j = 0; j < L; j++) ring.push(loc(k, n, -1, r0 + j))
    ring.push(loc(k, n, 0, r0 + L - 1))
    for (let j = L - 1; j >= 0; j--) ring.push(loc(k, n, 1, r0 + j))
    home[c] = Array.from({ length: L - 1 }, (_, j) => loc(k, n, 0, r0 + L - 2 - j))
    off[c] = k * cellPer + L + 2
    safe.add(off[c])
    safe.add(k * cellPer + L - 3)
    const d = n === 6 ? 7.6 : 6.8
    const t = rad((k * 360) / n + 180 / n)
    bc[c] = [d * Math.sin(t), -d * Math.cos(t)]
  })

  const ringLen = ring.length
  const OUT = ringLen - 2
  const FIN = OUT + L

  const slot = (color: Color, i: number): [number, number] => {
    const [bx, by] = bc[color]!
    return [bx + (i % 2 ? 0.8 : -0.8), by + (i > 1 ? 0.8 : -0.8)]
  }

  return {
    n,
    R: n === 6 ? 9.5 : 8.7,
    ringLen,
    cellPerPlayer: cellPer,
    ids,
    ring,
    home,
    off,
    safe,
    ang,
    bc,
    slot,
    FIN,
    OUT,
  }
}

const ENGINE_START: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
  purple: 6,
  orange: 32,
}

export function hexTokenPos(
  enginePos: number,
  color: Color,
  config: HexBoardConfig,
  tokenIndex: number,
): { x: number; y: number; scale: number } {
  if (enginePos < 0) {
    const [x, y] = config.slot(color, tokenIndex)
    return { x, y, scale: 1 }
  }
  if (enginePos <= 51) {
    const colorOff = config.off[color]!
    const engineStart = ENGINE_START[color]!
    const engineProgress = ((enginePos - engineStart + 52) % 52) / 52
    const ringIdx =
      Math.round(colorOff + engineProgress * config.ringLen) % config.ringLen
    const [x, y] = config.ring[ringIdx]!
    return { x, y, scale: 1 }
  }
  if (enginePos >= 100 && enginePos <= 105) {
    const homeIdx = enginePos - 100
    if (homeIdx < config.home[color]!.length) {
      const [x, y] = config.home[color]![homeIdx]!
      return { x, y, scale: 1 }
    }
  }
  const a = rad(config.ang[color]!)
  return {
    x: Math.sin(a) * 0.8 + (tokenIndex % 2 ? 0.12 : -0.12),
    y: -Math.cos(a) * 0.8 + (tokenIndex > 1 ? 0.12 : -0.12),
    scale: 0.5,
  }
}