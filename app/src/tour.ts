/**
 * Mochi's first words, once: hello, the agents to listen to, whether
 * requests may be answered from the bubble, and where the pocket is. Then,
 * now and then, one thing more it can do, never the same twice.
 */

/** The steps of the first meeting, in order. */
export const TOUR = ['hello', 'claude', 'codex', 'approve', 'pocket'] as const
export type Step = (typeof TOUR)[number]

/** How an agent stands, as the app reads its settings file. */
export type AgentState = 'on' | 'off' | 'broken' | 'missing'

/** The next step not yet taken: an agent is asked about only while it is there and not connected. */
export function nextStep(seen: ReadonlySet<string>, agents: Record<'claude' | 'codex', AgentState>): Step | null {
  return TOUR.find(step => !seen.has(step) && (step === 'claude' || step === 'codex' ? agents[step] === 'off' : true)) ?? null
}

/** The things Mochi tells of itself after the first meeting, one a day at most. */
export const TIPS = ['rightClick', 'drag', 'edge', 'today', 'wardrobe', 'pat', 'shield', 'line'] as const
export type Tip = (typeof TIPS)[number]

/** How long after the last one a tip may come, and how long Mochi must have been quiet first. */
export const TIP_EVERY_MS = 20 * 60 * 60_000
export const TIP_QUIET_MS = 10 * 60_000

/** The tip to tell now, or null: the tour done, none told for a day, Mochi quiet a while, and one not yet told. */
export function tipNow(told: readonly string[], lastAt: number, quietSince: number, now: number, isTourDone: boolean): Tip | null {
  if (!isTourDone || now - lastAt < TIP_EVERY_MS || now - quietSince < TIP_QUIET_MS) return null
  return TIPS.find(tip => !told.includes(tip)) ?? null
}
