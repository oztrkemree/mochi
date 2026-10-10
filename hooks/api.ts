import type { Face, Mood, MochiMood, MochiReaction } from '../types'
import { clip } from './text'

// What other plugins may ask of Mochi through `$.mochi` (docs/API.md): a
// mood from a short list and a short line, now and then, never over a face
// the person should not miss. Everything a plugin passes is checked here.

/** The moods another plugin may put on Mochi. */
export const API_MOODS: readonly MochiMood[] = ['wave', 'pleased', 'success', 'proud', 'party', 'nervous', 'error', 'shocked']

/** The least time between two reactions of one plugin. */
export const API_GAP_MS = 10_000

/** Control characters and the marks that turn text around. */
const UNSEEN = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

/** A reaction as asked, made safe: a known mood, one plain line cut to 60 columns, a hold of 1 to 15 seconds; null when it is none. */
export function reactionOf(input: unknown): Required<MochiReaction> | null {
  if (typeof input !== 'object' || input === null) return null
  const { mood, line, holdMs } = input as Record<string, unknown>
  if (typeof mood !== 'string' || !(API_MOODS as readonly string[]).includes(mood) || typeof line !== 'string') return null
  // They go, so a line can neither break the band nor read backwards.
  const plain = line.replace(UNSEEN, ' ').replace(/\s+/g, ' ').trim()
  if (plain === '') return null
  const hold = typeof holdMs === 'number' && Number.isFinite(holdMs) ? Math.min(15_000, Math.max(1000, holdMs)) : 5000
  return { mood: mood as MochiMood, line: clip(plain, 60), holdMs: hold }
}

/** A celebration as asked: the party mood with its line, held six seconds. */
export const cheerOf = (input: unknown): Required<MochiReaction> | null =>
  reactionOf({ mood: 'party', line: typeof input === 'object' && input !== null ? (input as { line?: unknown }).line : undefined, holdMs: 6000 })

/** The line as Mochi says it: the plugin's name after it, so the person knows who spoke. */
export const signed = (line: string, plugin: string): string => `${line} · ${clip(plugin, 24)}`

/** Faces a reaction never covers: Mochi waiting on the person, warning, compacting, or celebrating. */
const KEPT: ReadonlySet<Mood> = new Set(['asking', 'scared', 'nervous', 'dizzy', 'party', 'squeezed'])

/** Whether the face shows something the person should not miss, held or waiting. */
export const isKept = (f: Pick<Face, 'mood' | 'until'>, now: number): boolean => KEPT.has(f.mood) && (f.until === 0 || f.until > now)

/** Whether a plugin that last reacted at `last` may react again at `now`. */
export const mayReact = (last: number | undefined, now: number): boolean => last === undefined || now - last >= API_GAP_MS
