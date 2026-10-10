import type { Block, DayRec, Env, Face, FileDiff, Info, Outfit, Panel, Peer, Prefs, Section, Shot, Tab } from '../types'
import type { GhTrouble } from './ci'
import type { Pending, TipId } from './coach'
import type { Reaction } from './react'
import { NEW_WATCH } from './guard'
import type { Watch } from './guard'
import { pickLang, t } from './i18n'
import type { Lang } from './i18n'
import { SLOT, SLOTS, SLOT_ITEMS, itemOf } from './level'
import type { Platform } from './system'

// What register.tsx and render.tsx share: the defaults of the values kept in
// $.state, and this load's own bookkeeping.

/** The detail pane's sections in order, and which start open: what is live now, not what is looked at once in a while. */
export const SECTIONS: readonly Section[] = ['chats', 'changes', 'context', 'activity', 'level', 'wardrobe', 'badges', 'settings', 'more']
const OPEN: Record<Section, boolean> = { chats: true, changes: true, context: false, activity: true, level: true, wardrobe: true, badges: false, settings: true, more: true }
export const BLOCKS: readonly Block[] = ['overview', ...SECTIONS]
/** The pane's tabs, and the tab each block lives in. */
export const TABS: readonly Tab[] = ['now', 'past', 'mochi', 'settings']
export const TAB_OF: Record<Block, Tab> = {
  overview: 'now', chats: 'now', changes: 'now', context: 'now', activity: 'past', level: 'past', badges: 'past', wardrobe: 'mochi', settings: 'settings', more: 'settings',
}
/** A tab's blocks in the person's order. */
export const inTab = (order: readonly Block[], tab: Tab): Block[] => order.filter(b => TAB_OF[b] === tab)
export const DEFAULT_PREFS: Prefs = { isCompact: false, isHidden: false, hasSound: false, hasShield: true, hasAlert: true, pick: {}, open: OPEN, order: [...BLOCKS], hidden: [], isArranging: false, tab: 'now', shelf: 'head', lang: 'auto', hasCi: true, hasTips: true, hasPlugins: true, hasBreaks: true, birthday: '', firstDay: '' }
export const ALL_ITEMS = SLOTS.flatMap(slot => SLOT_ITEMS[slot])

/**
 * Saved preferences, completed, with an older version's single `wear` turned
 * into a choice per slot and its item ids into today's.
 */
export function restorePrefs(saved: (Partial<Prefs> & { wear?: unknown }) | undefined): Prefs {
  const pick: Partial<Outfit> = {}
  const worn = itemOf(saved?.wear)
  if (saved?.pick && typeof saved.pick === 'object') {
    for (const slot of SLOTS) {
      const v = (saved.pick as Record<string, unknown>)[slot]
      const item = itemOf(v)
      if (v === null) pick[slot] = null
      else if (item !== null && SLOT[item] === slot) pick[slot] = item
    }
  } else if (saved?.wear === 'none') {
    for (const slot of SLOTS) pick[slot] = null
  } else if (worn !== null) {
    pick[SLOT[worn]] = worn
  }
  const { wear: _old, ...rest } = saved ?? {}
  const was = (saved?.open ?? {}) as Partial<Record<Section, unknown>>
  const open = Object.fromEntries(SECTIONS.map(s => [s, typeof was[s] === 'boolean' ? was[s] : OPEN[s]])) as Record<Section, boolean>
  // Choices saved before there were languages were made in Turkish, its only one then.
  const lang = typeof saved?.lang === 'string' && (saved.lang === 'auto' || pickLang(saved.lang) !== null) ? saved.lang : saved !== undefined ? 'tr' : 'auto'
  const shelf = SLOTS.find(slot => slot === saved?.shelf) ?? 'head'
  const tab = TABS.find(x => x === saved?.tab) ?? 'now'
  return { ...DEFAULT_PREFS, ...rest, pick, open, shelf, lang, ...layoutOf(saved?.order, saved?.hidden), isArranging: false, tab }
}

/** The pane's order and what is hidden, from what was saved: unknown names dropped, a block it does not name (a newer one) put where it goes by default. */
export function layoutOf(order: unknown, hidden: unknown): { order: Block[]; hidden: Block[] } {
  const known = (list: unknown) => (Array.isArray(list) ? BLOCKS.filter(b => list.includes(b)) : [])
  const saved = Array.isArray(order) ? order.filter((b, i): b is Block => BLOCKS.includes(b) && order.indexOf(b) === i) : []
  const next = [...saved]
  for (const b of BLOCKS) {
    if (next.includes(b)) continue
    // After the block it follows by default, or first.
    const before = BLOCKS.slice(0, BLOCKS.indexOf(b)).reverse().find(x => next.includes(x))
    next.splice(before === undefined ? 0 : next.indexOf(before) + 1, 0, b)
  }
  return { order: next, hidden: known(hidden) }
}

/** The order with a block swapped with the one before or after it in its own tab; unchanged at the tab's end. */
export function stepped(order: readonly Block[], block: Block, way: 'up' | 'down'): Block[] {
  const mates = inTab(order, TAB_OF[block])
  const other = mates[mates.indexOf(block) + (way === 'up' ? -1 : 1)]
  if (other === undefined) return [...order]
  return order.map(b => (b === block ? other : b === other ? block : b))
}

/** The order with one tab's blocks put in the order `part` gives them; null when `part` is not exactly that tab's blocks. */
export function reordered(order: readonly Block[], part: unknown): Block[] | null {
  if (!Array.isArray(part)) return null
  const first = BLOCKS.find(b => b === part[0])
  if (first === undefined) return null
  const mates = inTab(order, TAB_OF[first])
  if (part.length !== mates.length || !mates.every(b => part.includes(b))) return null
  let k = 0
  return order.map(b => (TAB_OF[b] === TAB_OF[first] ? (part[k++] as Block) : b))
}
export const NO_ENV: Env = {
  context: -1, agents: 0, turnTools: 0, tokens: 0, window: 0, slices: [], limits: [], cost: 0, recent: [], last: '', compactAt: 0, allSlices: [], git: null, turns: [], files: [], kinds: {}, startedAt: 0,
  samples: [], peers: [], history: null, tz: 0, lastEdit: null, ci: null, pr: null, badges: [],
}
/** The face at rest, in the language in use. */
export const rest0 = (): Omit<Face, 'frameAt'> => ({ mood: 'idle', line: t().st.ready, until: 0, since: 0 })
export const NO_FACE: Face = { mood: 'idle', line: '', until: 0, since: 0, frameAt: -1 }
export const FIRST_SHOT: Shot = { mood: 'idle', scene: { context: -1, agents: 0 }, at: 0, from: null }
export const NO_INFO: Info = {
  label: '', detail: '', context: { percent: -1, tokens: 0, window: 0, slices: [] }, limits: [], cost: 0, agents: 0, tools: 0, isBusy: false, recent: [], last: '', compactPct: 0, warn: 0, git: null,
}
export const NO_PANEL: Panel = { shot: FIRST_SHOT, info: NO_INFO, infoFrom: null, infoAt: 0 }
/** What the last of the details pane's actions answered, and the part of it worth copying; '' when there is none to show. */
export const NO_SAID = { text: '', copy: '', open: '' }
/** The changed file picked in the details pane's Changes, this chat's own; `path` '' when none is. */
export const NO_DIFF: FileDiff = { path: '', lines: [], more: 0 }

/**
 * Per-load bookkeeping (a reload starts it over); what the drawing reads lives
 * in $.state. One object, so that every module can change it.
 */
export const chat = {
  /** The system Mochi runs on, found once per load. */
  platform: 'linux' as Platform,
  /** The timer's beats since the load. */
  beat: 0,
  isBusy: false,
  lastActivity: 0,
  lastTypedAt: 0,
  faceToken: 0,
  errorRun: 0,
  callId: 0,
  gitAt: 0,
  isGitWanted: true,
  lastNudge: 0,
  warned: 0,
  pendingWarn: 0,
  costAtStart: 0,
  detailAt: 0,
  stream: null as 'thinking' | 'talking' | null,
  turn: { startedAt: 0, tools: 0, edits: 0, errors: 0 },
  watch: NEW_WATCH as Watch,
  pendingLimit: '',
  warnedLimits: [] as string[],
  /** Where Mochi keeps what outlives the chat, shared by every chat on the machine. */
  dataDir: '',
  sessionId: '',
  /** This chat's short name for the others; '' until known. */
  label: '',
  isLabelFromPrompt: false,
  /** This chat's own days, written to its file in `days/` after each turn. */
  myDays: {} as Record<string, DayRec>,
  /** The other chats' days, as last read. */
  otherDays: [] as Record<string, DayRec>[],
  historyAt: 0,
  samplesAt: 0,
  liveAt: 0,
  liveKey: '',
  peersAt: 0,
  peerMtimes: {} as Record<string, number>,
  peerCache: {} as Record<string, Peer>,
  lastTurnFailed: false,
  /** Where the band was last drawn: the desktop rebuilds the band on every redraw, so there the details live in the status line. */
  drawnOn: null as 'terminal' | 'remote' | null,
  /** The band was last drawn where its rings open the details at a click: the desktop app. */
  canClick: false,
  lastStatus: undefined as string | undefined,
  autoLang: null as Lang | null,
  lastEnv: null as Env | null,
  /** Where this chat stands for the others, since when, and the wait last told of (its `stateAt`). */
  state: null as Peer['state'] | null,
  stateAt: 0,
  waitTold: 0,
  /** The shield waits on the person's word. */
  isAsking: false,
  /** Claude Code's permission questions on the face: its token, the face the first covered and that face's token, and the calls they ask about. */
  perm: null as { token: number; was: number; face: Omit<Face, 'frameAt'>; keys: string[] } | null,
  /** The prompt said good night: once its reply is done, Mochi goes to sleep. */
  isGoodNight: false,
  /** This chat's folder and whether git keeps it as a linked worktree, for the board of chats. */
  folder: '',
  isWorktree: false,
  /** The timer's last look at the usage windows' resets. */
  resetsSeenAt: 0,
  /** The pushed commit whose CI Mochi follows, '' when none; when it was pushed and when gh was last asked. */
  ciSha: '',
  ciSince: 0,
  ciAt: 0,
  isCiAsking: false,
  isPrAsking: false,
  /** Why gh stays silent, once a call has said; null when it answers or before it is asked. */
  ghTrouble: null as GhTrouble | null,
  /** The coach: tips waiting for an idle moment, the tour's next step (-1 when none), an instruction to offer for CLAUDE.md. */
  coach: {
    pending: {} as Pending,
    /** When Mochi last looked for something to say; a later time holds it off until then. */
    at: 0,
    tour: -1,
    rule: '',
    /** That instruction as the person wrote it, letter case kept, for the question and CLAUDE.md. */
    ruleText: '',
    /** Permission questions this chat, by program or tool. */
    asks: {} as Record<string, number>,
    isLongFirst: false,
    hasPlanned: false,
    retired: [] as TipId[],
    /** This plugin's version, from its plugin.json. */
    version: '',
    /** What a newer version's first start has to say once someone can see it: the tour, what is new, or only that it was seen. */
    welcome: '' as '' | 'tour' | 'news' | 'seen',
    /** The day's greeting, held back by a start that drew nowhere. */
    greet: false,
  },
  /** The days files this chat counted, by name: one gone means a history reset in some chat. */
  counted: [] as string[],
  /** When each other plugin last made Mochi react, by its name. */
  reactedAt: {} as Record<string, number>,
  /** When the person's shield.json was last changed, as last read (0: there is none; -1: not read yet). */
  rulesAt: -1,
  /** Turns in a row without an error, for a badge. */
  calm: 0,
  /** A test run failed in this turn: a green one after it is a comeback. */
  isTestRed: false,
  /** When the current stretch of work began (0 after a quiet gap), and when a stretch was last suggested. */
  workFrom: 0,
  lastStretch: 0,
  /** The day of the last 13:37 wink. */
  winkDay: '',
  /** The badge awards in line, run one at a time. */
  awards: Promise.resolve() as Promise<void>,
  /**
   * Ultracode: the agents a workflow script started and has not heard back from,
   * how many ran this round, how many of those answered, and since when, when
   * the last one ended (0 while one runs), when any of them last did something,
   * the tool calls the subagents have open, and the finale a busy turn's end shows.
   */
  flow: { ids: new Set<string>(), total: 0, ok: 0, startedAt: 0, idleAt: 0, at: 0, calls: 0, finale: null as Reaction | null },
}
