import type { DayRec, Env, Face, Info, Outfit, Panel, Peer, Prefs, Shot } from '../types'
import { NEW_WATCH } from './guard'
import type { Watch } from './guard'
import { pickLang, t } from './i18n'
import type { Lang } from './i18n'
import { SLOT, SLOTS, SLOT_ITEMS, itemOf } from './level'
import type { Platform } from './system'

// What register.tsx and render.tsx share: the defaults of the values kept in
// $.state, and this load's own bookkeeping.

export const DEFAULT_PREFS: Prefs = { isCompact: false, isHidden: false, hasSound: false, hasShield: true, hasAlert: true, pick: {}, open: { level: false, wardrobe: false }, lang: 'auto' }
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
  const open = { level: saved?.open?.level === true, wardrobe: saved?.open?.wardrobe === true }
  // Choices saved before there were languages were made in Turkish, its only one then.
  const lang = typeof saved?.lang === 'string' && (saved.lang === 'auto' || pickLang(saved.lang) !== null) ? saved.lang : saved !== undefined ? 'tr' : 'auto'
  return { ...DEFAULT_PREFS, ...rest, pick, open, lang }
}
export const NO_ENV: Env = {
  context: -1, agents: 0, turnTools: 0, tokens: 0, window: 0, slices: [], limits: [], cost: 0, recent: [], last: '', compactAt: 0, allSlices: [], git: null, turns: [], files: [], kinds: {}, startedAt: 0,
  samples: [], peers: [], history: null, tz: 0, lastEdit: null,
}
/** The face at rest, in the language in use. */
export const rest0 = (): Omit<Face, 'frameAt'> => ({ mood: 'idle', line: t().st.ready, until: 0, since: 0 })
export const NO_FACE: Face = { mood: 'idle', line: '', until: 0, since: 0, frameAt: -1 }
export const FIRST_SHOT: Shot = { mood: 'idle', scene: { context: -1, agents: 0 }, at: 0, from: null }
export const NO_INFO: Info = {
  label: '', detail: '', context: { percent: -1, tokens: 0, window: 0, slices: [] }, limits: [], cost: 0, agents: 0, tools: 0, isBusy: false, recent: [], last: '', compactPct: 0, warn: 0, git: null,
}
export const NO_PANEL: Panel = { shot: FIRST_SHOT, info: NO_INFO, infoFrom: null, infoAt: 0 }

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
  lastStatus: undefined as string | undefined,
  autoLang: null as Lang | null,
  lastEnv: null as Env | null,
  /** Where this chat stands for the others, since when, and the wait last told of (its `stateAt`). */
  state: null as Peer['state'] | null,
  stateAt: 0,
  waitTold: 0,
  /** The shield waits on the person's word. */
  isAsking: false,
  /** This chat's folder and whether git keeps it as a linked worktree, for the board of chats. */
  folder: '',
  isWorktree: false,
  /** The timer's last look at the usage windows' resets. */
  resetsSeenAt: 0,
}
