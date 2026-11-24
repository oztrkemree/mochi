/** How long one round of the hop game lasts, in ms. */
export const ROUND_MS = 30_000
/** How many hops Mochi makes in one round. */
export const HOPS = 12
/** How soon after a hop a press must come to catch it, in ms. */
export const WITHIN_MS = 800

/** When Mochi hops in a round, in ms from its start; the same seed gives the same round. */
export function roundOf(seed: number): number[] {
  const slot = ROUND_MS / HOPS
  let s = seed >>> 0
  return Array.from({ length: HOPS }, (_, i) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return i * slot + 500 + Math.floor((s / 2 ** 32) * 1200)
  })
}

/** How many hops were caught: a hop counts once when a press came no later than WITHIN_MS after it. */
export function scoreOf(hops: readonly number[], presses: readonly number[]): number {
  const times = [...presses].sort((a, b) => a - b)
  let used = 0
  let score = 0
  for (const h of [...hops].sort((a, b) => a - b)) {
    const at = times.findIndex((p, i) => i >= used && h <= p && p <= h + WITHIN_MS)
    if (at < 0) continue
    score++
    used = at + 1
  }
  return score
}

/** The best score kept (`kept` is the stored text, null for none) against a new score. */
export function bestOf(kept: string | null, score: number): { best: number; isNew: boolean } {
  const n = Number(kept)
  const best = Number.isInteger(n) && n >= 0 ? n : 0
  return score > best ? { best: score, isNew: true } : { best, isNew: false }
}
