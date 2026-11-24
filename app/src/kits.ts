import type { Peer } from '../../types'

/**
 * The small Mochis that stand by while a busy chat runs subagents: one per
 * subagent, never more than MAX_KITS, drawn as plain SVG with nothing that moves.
 */

/** The most small Mochis that stand by at once. */
export const MAX_KITS = 5

/** How many small Mochis stand by: one for each subagent running in a busy chat, MAX_KITS at most. */
export function kitsOf(peers: readonly Peer[]): number {
  const n = peers.reduce((sum, p) => sum + (p.state === 'busy' ? (p.agents?.length ?? 0) : 0), 0)
  return Math.min(n, MAX_KITS)
}

/** Where each of `n` kits stands in a square of `side` points: a row along the bottom, centred. */
export function kitSpots(n: number, side: number): { x: number; y: number; r: number }[] {
  if (n <= 0) return []
  const r = Math.round(side * 0.09)
  const gap = r / 2
  const y = side - r
  return Array.from({ length: n }, (_, i) => ({ x: side / 2 + (i - (n - 1) / 2) * (2 * r + gap), y, r }))
}

/** The kits as SVG: for each spot a body circle filled `ink` and two eye dots; nothing that moves by itself. */
export function kitsSvg(spots: readonly { x: number; y: number; r: number }[], ink: string): string {
  if (spots.length === 0) return ''
  const fill = ink.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const kits = spots.map(({ x, y, r }) => {
    const eye = r * 0.18
    const dx = r * 0.35
    const ey = y - r * 0.15
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
      + `<circle cx="${x - dx}" cy="${ey}" r="${eye}" fill="#fff"/>`
      + `<circle cx="${x + dx}" cy="${ey}" r="${eye}" fill="#fff"/>`
  })
  return `<g class="kits">${kits.join('')}</g>`
}
