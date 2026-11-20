import { LANGS, type Lang } from '../../hooks/i18n'

/**
 * What the person sets for the desktop Mochi. Kept in the app's own storage,
 * shared by its windows; the settings window says each change to Mochi's
 * window at once.
 */
export type Settings = {
  size: Size
  /** Which news Mochi speaks of. */
  talk: { asking: boolean; done: boolean; failed: boolean }
  /** How long a bubble stays up. */
  talkSeconds: number
  /** Over the other windows, and over an app that fills the screen. */
  onTop: boolean
  /** The button beside Mochi that lists the agents. */
  showAgents: boolean
  /** The language Mochi speaks; 'auto' follows the system. */
  lang: 'auto' | Lang
}

export type Size = 'small' | 'medium' | 'large' | 'huge'
/** The side of the square Mochi stands in, in points. */
export const SIZES: Record<Size, number> = { small: 96, medium: 128, large: 160, huge: 200 }
export const TALK_SECONDS = [5, 9, 15, 30] as const

export const DEFAULTS: Settings = { size: 'medium', talk: { asking: true, done: true, failed: true }, talkSeconds: 9, onTop: true, showAgents: true, lang: 'auto' }

export const KEY = 'settings'
/** The event the settings window sends Mochi's window with every change. */
export const CHANGED = 'settings-changed'

const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** Settings from what was kept: each value checked on its own, a missing or odd one the default. */
export function settingsFrom(text: string | null): Settings {
  let v: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(text ?? 'null')
    if (typeof parsed === 'object' && parsed !== null) v = parsed as Record<string, unknown>
  } catch {
    // Nothing kept, or not as JSON: the defaults.
  }
  const talk = typeof v.talk === 'object' && v.talk !== null ? (v.talk as Record<string, unknown>) : {}
  return {
    size: typeof v.size === 'string' && Object.hasOwn(SIZES, v.size) ? (v.size as Size) : DEFAULTS.size,
    talk: { asking: flag(talk.asking, true), done: flag(talk.done, true), failed: flag(talk.failed, true) },
    talkSeconds: (TALK_SECONDS as readonly unknown[]).includes(v.talkSeconds) ? (v.talkSeconds as number) : DEFAULTS.talkSeconds,
    onTop: flag(v.onTop, DEFAULTS.onTop),
    showAgents: flag(v.showAgents, DEFAULTS.showAgents),
    lang: v.lang === 'auto' || (LANGS as unknown[]).includes(v.lang) ? (v.lang as Settings['lang']) : DEFAULTS.lang,
  }
}

export const talksAbout = (s: Settings, kind: keyof Settings['talk']): boolean => s.talk[kind]

/** The settings kept now; the defaults where storage cannot be read. */
export function loadSettings(): Settings {
  try {
    return settingsFrom(localStorage.getItem(KEY))
  } catch {
    return DEFAULTS
  }
}
