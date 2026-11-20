/** A screen's work area, in points: where a window may stand, without the menu bar or the taskbar. */
export type Area = { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number }

/** The screen whose work area holds a point (the window's bottom right corner); null when no screen connected now does. */
export function areaOf(corner: Point, areas: readonly Area[]): Area | null {
  // A point on the right or bottom edge still belongs to the screen: a corner is kept a little inside it, but not always.
  return areas.find(a => corner.x > a.x && corner.x <= a.x + a.w + 1 && corner.y > a.y && corner.y <= a.y + a.h + 1) ?? null
}

/** Where a window of w × h stands with its bottom right corner at `corner`, kept whole inside the screen it is on. */
export function fit(corner: Point, w: number, h: number, area: Area): Point {
  const within = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))
  return { x: within(corner.x - w, area.x, area.x + area.w - w), y: within(corner.y - h, area.y, area.y + area.h - h) }
}
