/** The minute counts Mochi offers for a rest after long unbroken work; 0 is off. */
export const BREAK_MINUTES = [0, 60, 90, 120] as const

/** How long a chat must stay quiet to count as a real rest, which ends the stretch of work. */
export const REST_MS = 5 * 60_000

/** A stretch of work: when it began, when it last went quiet, and whether the break was already said. */
export type Stretch = { since: number | null; quietAt: number | null; told: boolean }

/** No stretch of work yet. */
export const FRESH: Stretch = { since: null, quietAt: null, told: false }

/** The stretch one look later, and whether a break is due now (once per stretch). */
export function stepBreak(s: Stretch, isBusy: boolean, now: number, minutes: number): { stretch: Stretch; due: boolean } {
  const on = minutes > 0 && (BREAK_MINUTES as readonly number[]).includes(minutes)
  if (!on) return { stretch: FRESH, due: false }
  if (isBusy) {
    const since = s.since ?? now
    const due = !s.told && now - since >= minutes * 60_000
    return { stretch: { since, quietAt: null, told: s.told || due }, due }
  }
  if (s.since === null) return { stretch: s, due: false }
  const quietAt = s.quietAt ?? now
  if (now - quietAt >= REST_MS) return { stretch: FRESH, due: false }
  return { stretch: { ...s, quietAt }, due: false }
}
