import { LANGS, type Lang } from '../../hooks/i18n'
import { BREAK_MINUTES } from './breaks'
import { type Temper, temperFrom } from './temper'
import type { JobsDetail } from './world'

/**
 * What the person sets for the desktop Mochi. Kept in the app's own storage,
 * shared by its windows; the settings window says each change to Mochi's
 * window at once.
 */
export type Settings = {
  size: Size
  /** Which news Mochi speaks of. */
  talk: { asking: boolean; done: boolean; failed: boolean; limit: boolean }
  /** How long a bubble stays up. */
  talkSeconds: number
  /** Over the other windows, and over an app that fills the screen. */
  onTop: boolean
  /** The button beside Mochi that lists the agents. */
  showAgents: boolean
  /** A request for permission can be answered from Mochi's bubble. */
  approve: boolean
  /** A shell command that cannot be undone is asked about first, in a Claude Code chat the app follows. */
  shield: boolean
  /** A soft sound with what Mochi says. */
  sound: boolean
  /** The language Mochi speaks; 'auto' follows the system. */
  lang: 'auto' | Lang
  /** A chat at rest this many minutes leaves the list of agents; 0 keeps every one. */
  idleMinutes: number
  /** With no chat working, waiting or failed this many seconds, Mochi leaves the screen until there is; 0 keeps it on the screen. */
  leaveSeconds: number
  /** How much the bubbles over Mochi say of each chat at work: nothing, how it stands, or its plan and subagents too. */
  jobs: JobsDetail
  /** Unbroken work this many minutes brings a word to rest; 0 never. */
  breakMinutes: number
  /** How Mochi carries itself: calm as it always was, playful with a word of its own, or serious. */
  temper: Temper
  /** A folder the person's computers share; the days of work are copied both ways through it. '' for none. */
  syncFolder: string
  /** Mochi looks after the computer: servers left running, a full disk, a low battery, a new version of an agent. */
  care: boolean
}

export type Size = 'small' | 'medium' | 'large' | 'huge'
/** The side of the square Mochi stands in, in points. */
export const SIZES: Record<Size, number> = { small: 96, medium: 128, large: 160, huge: 200 }
export const TALK_SECONDS = [5, 9, 15, 30] as const
export const IDLE_MINUTES = [15, 30, 60, 0] as const
export const LEAVE_SECONDS = [15, 30, 60, 300, 0] as const
export const JOBS: readonly JobsDetail[] = ['off', 'brief', 'full']

export const DEFAULTS: Settings = { size: 'medium', talk: { asking: true, done: true, failed: true, limit: true }, talkSeconds: 9, onTop: true, showAgents: true, approve: false, shield: true, sound: false, lang: 'auto', idleMinutes: 30, leaveSeconds: 30, jobs: 'brief', breakMinutes: 90, temper: 'calm', syncFolder: '', care: true }

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
    talk: { asking: flag(talk.asking, true), done: flag(talk.done, true), failed: flag(talk.failed, true), limit: flag(talk.limit, true) },
    talkSeconds: (TALK_SECONDS as readonly unknown[]).includes(v.talkSeconds) ? (v.talkSeconds as number) : DEFAULTS.talkSeconds,
    onTop: flag(v.onTop, DEFAULTS.onTop),
    showAgents: flag(v.showAgents, DEFAULTS.showAgents),
    approve: flag(v.approve, DEFAULTS.approve),
    shield: flag(v.shield, DEFAULTS.shield),
    sound: flag(v.sound, DEFAULTS.sound),
    lang: v.lang === 'auto' || (LANGS as unknown[]).includes(v.lang) ? (v.lang as Settings['lang']) : DEFAULTS.lang,
    idleMinutes: (IDLE_MINUTES as readonly unknown[]).includes(v.idleMinutes) ? (v.idleMinutes as number) : DEFAULTS.idleMinutes,
    leaveSeconds: (LEAVE_SECONDS as readonly unknown[]).includes(v.leaveSeconds) ? (v.leaveSeconds as number) : DEFAULTS.leaveSeconds,
    jobs: (JOBS as readonly unknown[]).includes(v.jobs) ? (v.jobs as JobsDetail) : DEFAULTS.jobs,
    breakMinutes: (BREAK_MINUTES as readonly unknown[]).includes(v.breakMinutes) ? (v.breakMinutes as number) : DEFAULTS.breakMinutes,
    temper: temperFrom(v.temper),
    syncFolder: typeof v.syncFolder === 'string' && v.syncFolder.length <= 400 ? v.syncFolder : DEFAULTS.syncFolder,
    care: flag(v.care, DEFAULTS.care),
  }
}

/** Whether Mochi speaks of this kind of news: a limit that is back goes with the limits, the nudge to commit with the turns that finish, and a new level is always said. */
export const talksAbout = (s: Settings, kind: keyof Settings['talk'] | 'back' | 'level' | 'nudge'): boolean => kind === 'level' || s.talk[kind === 'back' ? 'limit' : kind === 'nudge' ? 'done' : kind]

/** The settings kept now; the defaults where storage cannot be read. */
export function loadSettings(): Settings {
  try {
    return settingsFrom(localStorage.getItem(KEY))
  } catch {
    return DEFAULTS
  }
}
