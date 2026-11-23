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

/** Mochi's body as the window holds it: its box from the window's top left, in the window's units. */
export type Body = { x: number; y: number; w: number; h: number }

/** How much of Mochi's body is left showing when it peeks over the bottom of the screen: its head, and its eyes. */
export const PEEK_SHOWS = 0.45

/** Whether a window left at `at` has more than half Mochi's body below the bottom of the screen: pushed to the edge, to peek. */
export const isPushedDown = (at: Point, body: Body, area: Area): boolean => at.y + body.y + body.h / 2 > area.y + area.h

/** Where the window stands for Mochi to peek: where it was left across (its body whole on the screen), and down so only the top shows. */
export function peekAt(at: Point, body: Body, area: Area): Point {
  const x = Math.min(Math.max(at.x, area.x - body.x), area.x + area.w - body.x - body.w)
  return { x, y: area.y + area.h - body.y - body.h * PEEK_SHOWS }
}
