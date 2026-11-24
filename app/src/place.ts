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

/** An edge of the screen Mochi peeks over. The top has the menu bar, which a window does not go past. */
export type Edge = 'bottom' | 'left' | 'right'

/** The edge nearest Mochi's body in a window at `at`: its feet to the bottom, its middle to either side. */
export function nearestEdge(at: Point, body: Body, area: Area): Edge {
  const mid = at.x + body.x + body.w / 2
  const far: Record<Edge, number> = { bottom: area.y + area.h - (at.y + body.y + body.h), left: mid - area.x, right: area.x + area.w - mid }
  return (['bottom', 'right', 'left'] as const).reduce((a, b) => (far[b] < far[a] ? b : a))
}

/** The edge a window left at `at` has more than half Mochi's body past, to peek over; null when it is past none. */
export function pushedPast(at: Point, body: Body, area: Area): Edge | null {
  const mid = at.x + body.x + body.w / 2
  return isPushedDown(at, body, area) ? 'bottom' : mid > area.x + area.w ? 'right' : mid < area.x ? 'left' : null
}

/**
 * Where the window stands for Mochi to peek over an edge. Over the bottom:
 * where it was left across (its body whole on the screen), and down so only the
 * top shows. Over a side Mochi lies on its side, turned a quarter about its
 * body's middle, its head toward the screen: across so 45% of it shows, and up
 * and down where it was, whole on the screen.
 */
export function peekAt(at: Point, body: Body, area: Area, edge: Edge = 'bottom'): Point {
  if (edge === 'bottom') {
    const x = Math.min(Math.max(at.x, area.x - body.x), area.x + area.w - body.x - body.w)
    return { x, y: area.y + area.h - body.y - body.h * PEEK_SHOWS }
  }
  // Turned, the body is its height wide and its width tall, about the same middle.
  const mx = body.x + body.w / 2
  const my = body.y + body.h / 2
  const y = Math.min(Math.max(at.y, area.y - (my - body.w / 2)), area.y + area.h - (my + body.w / 2))
  const x = edge === 'right' ? area.x + area.w - body.h * PEEK_SHOWS - (mx - body.h / 2) : area.x + body.h * PEEK_SHOWS - (mx + body.h / 2)
  return { x, y }
}

/** What of a window w × h at `at` shows on the screen: a box in the window's units, from its top left. */
export const shownIn = (at: Point, w: number, h: number, area: Area): { left: number; top: number; right: number; bottom: number } => ({
  left: Math.max(0, area.x - at.x),
  top: Math.max(0, area.y - at.y),
  right: Math.min(w, area.x + area.w - at.x),
  bottom: Math.min(h, area.y + area.h - at.y),
})
