/** The tempers Mochi can be in, in the order they are offered. */
export const TEMPERS = ['calm', 'playful', 'serious'] as const

/** One of the tempers Mochi can be in. */
export type Temper = (typeof TEMPERS)[number]

/** The temper from a stored value; calm (Mochi as it always was) for anything else. */
export function temperFrom(v: unknown): Temper {
  return TEMPERS.find(t => t === v) ?? 'calm'
}

/** Whether Mochi hops when it has news. */
export const hopsOn = (t: Temper): boolean => t !== 'serious'

/** Whether Mochi gives a tip now and then. */
export const tipsOn = (t: Temper): boolean => t !== 'serious'

/** Whether Mochi offers its game. */
export const playsOn = (t: Temper): boolean => t !== 'serious'

/** The kinds of news a playful word can follow. */
export type QuipKind = 'done' | 'failed' | 'level'

/** Whether news of this kind can take a playful word. */
export const isQuipKind = (kind: string): kind is QuipKind => kind === 'done' || kind === 'failed' || kind === 'level'

/** A playful word to add after news of this kind: one time in three, by `roll`; null otherwise and in any other temper. */
export function quipOf(t: Temper, kind: string, roll: number, quips: Record<QuipKind, readonly string[]>): string | null {
  const list = isQuipKind(kind) ? quips[kind] : undefined
  if (t !== 'playful' || !list?.length || !Number.isInteger(roll) || roll < 0 || roll % 3 !== 0) return null
  return list[Math.floor(roll / 3) % list.length]
}
