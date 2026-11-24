import type { Act, Mood, Peer } from '../../types'

/**
 * The moments Mochi plays: what a chat just did, read from two looks at the
 * chats, and what Mochi does by itself while nothing happens. Each is held for
 * a breath or two, then Mochi is what the chats make it again.
 */

/** How long each moment is held, in ms: long enough to play once through, never long enough to hide what a chat needs. */
export const ACT_MS: Partial<Record<Act | Mood, number>> = {
  perk: 1300, giggle: 1900, whee: 3000, land: 1000, cheer: 1900, phew: 2400, ready: 1400, fistpump: 1400, oops: 1600, juggle: 3000,
  hum: 3800, curious: 3400, hop: 1700, sneeze: 2300, spin: 1500, dance: 3800, dream: 4800, shy: 2600,
  party: 3200, wave: 1600, love: 2600, dizzy: 2400, stretch: 2900,
}

/** What a moment Mochi plays may stand for: a moment, or a mood held a while. */
export type Beat = Act | 'party' | 'wave'

/** The order they win in when one look brings several: what went wrong first, then what is most worth a cheer. */
const RANK: Beat[] = ['oops', 'party', 'phew', 'cheer', 'fistpump', 'wave', 'ready', 'perk']

/** A turn this long is worth a wipe of the brow when it ends. */
const LONG_TURN_S = 300

/**
 * What a chat did between two looks, as a moment to play: a turn finished (a
 * cheer; a long one, a wipe of the brow; one cut off, a start), a step of its
 * plan done or the whole plan, a helper set to work, a new start, a chat opened.
 * The one that matters most of all the chats; null when none did anything.
 */
export function actOf(before: readonly Peer[], after: readonly Peer[], stalled: ReadonlySet<string> = new Set()): Beat | null {
  const found = new Set<Beat>()
  for (const p of after) {
    const was = before.find(b => b.id === p.id)
    // A chat opened: greeted, or, already at work, a start. (The window leaves out the chats it reads in at its own start.)
    if (!was) {
      found.add(p.state === 'busy' ? 'ready' : 'perk')
      continue
    }
    // A chat taken as stopped because it went silent did nothing.
    if (stalled.has(p.id)) continue
    if (was.state === 'busy' && p.state === 'idle') {
      const turn = p.lastTurn
      const isCut = turn && /abort|interrupt|cancel/i.test(turn.reason)
      found.add(isCut ? 'oops' : (turn?.seconds ?? 0) >= LONG_TURN_S ? 'phew' : 'cheer')
    }
    // A new start; an answer to a chat that waited on the person is none.
    if ((was.state === 'idle' || was.state === 'error') && p.state === 'busy') found.add('ready')
    if (was.plan && p.plan && p.plan.total === was.plan.total && p.plan.done > was.plan.done) found.add(p.plan.done >= p.plan.total ? 'party' : 'fistpump')
    if ((p.agents?.length ?? 0) > (was.agents?.length ?? 0)) found.add('wave')
  }
  return RANK.find(b => found.has(b)) ?? null
}

/** Of two moments, the one that matters more: what waits while another plays goes next. */
export const louder = (a: Beat | null, b: Beat | null): Beat | null => (a === null ? b : b === null ? a : RANK.indexOf(a) <= RANK.indexOf(b) ? a : b)

/** Codex's chats are named so by the app; every other chat is Claude Code's. */
export const isCodex = (p: Pick<Peer, 'id'>): boolean => p.id.startsWith('codex-')

/** Whether Claude Code and Codex both work right now: Mochi keeps a ball in the air for each. */
export const isDuo = (peers: readonly Peer[]): boolean => {
  const busy = peers.filter(p => p.state === 'busy')
  return busy.some(isCodex) && busy.some(p => !isCodex(p))
}

/** What Mochi does by itself, by the mood it is in; asleep, it dreams. */
const AWAKE: Act[] = ['hum', 'curious', 'hop', 'spin', 'dance', 'hum', 'curious', 'hop', 'sneeze']
const AT_EASE: readonly Mood[] = ['idle', 'proud', 'pleased']

/**
 * Something to do by itself once a minute, now and then: a hum, a look about, a
 * hop, a twirl, a dance, a stretch, rarely a sneeze; a dream while asleep.
 * `roll` and `pick` are chances between 0 and 1. Null most minutes, and always
 * while a chat works, waits or failed: then the chats are what Mochi shows.
 */
export function fidgetOf(mood: Mood, roll: number, pick: number): Act | 'stretch' | null {
  if (mood === 'sleeping') return roll < 0.25 ? 'dream' : null
  if (!AT_EASE.includes(mood) || roll >= 0.35) return null
  const all = [...AWAKE, 'stretch' as const]
  return all[Math.min(all.length - 1, Math.floor(pick * all.length))] ?? null
}

/** What a pat brings, by chance: mostly love, sometimes a bashful wiggle or a twirl. */
export const patOf = (pick: number): 'love' | 'shy' | 'spin' => (pick < 0.55 ? 'love' : pick < 0.8 ? 'shy' : 'spin')

/** Presses close together: three make Mochi giggle, six make it dizzy. */
export function pokesOf(times: readonly number[], now: number): 'giggle' | 'dizzy' | null {
  const recent = times.filter(t => now - t <= 1200).length
  return recent >= 6 ? 'dizzy' : recent >= 3 ? 'giggle' : null
}
