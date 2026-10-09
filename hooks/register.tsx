import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DayRec, Env, Face, Info, Item, Limit, Mood, Outfit, Panel, Peer, Prefs, Recent, Scene, Shot, Slice } from '../types'
import { LOOKS, asciiRows, kaomoji, moodLabel } from './looks'
import { afterTool, beforeTool, duration, isCommit, onPrompt, onTurnEnd, restLine, subject, waitsOnPerson } from './react'
import type { Reaction, SoundName } from './react'
import { detailHeight, detailLines, detailSvg, levelSummary, levelSvg } from './detail'
import { addSample, ago, clockAt, contextWarning, dayKey, forecastFull, lineDelta, local, parseGit, parseNumstat, parseTz, parseWc, warnLevel, withLines } from './facts'
import { NEW_WATCH, danger, dangerKey, watchCall } from './guard'
import { DICTS, LANGS, pickLang, setLang, t } from './i18n'
import type { Lang } from './i18n'
import type { Watch } from './guard'
import { ASCII_HAT, EMPTY_DAY, SLOT, SLOTS, SLOT_ITEMS, UNLOCKS, itemName, itemShort, slotName, addDay, hintFor, levelOf, outfitFor, season, summarize, unlocked, wearable, xpOf } from './level'
import { WEAR } from './wear'
import { peerLabel, peerNews, peerOf, peersLine } from './live'
import { PANEL_H, limitName, panelSvg, toolKind } from './panel'
import { POSES, VECTOR_WEAR, paramsAt, svgFor } from './rig'
import { clip } from './sound'

const DEFAULT_PREFS: Prefs = { isCompact: false, isHidden: false, hasSound: false, hasShield: true, hasAlert: true, pick: {}, open: { level: false, wardrobe: false }, lang: 'auto' }
const ALL_ITEMS = SLOTS.flatMap(slot => SLOT_ITEMS[slot])
const isItem = (v: unknown): v is Item => typeof v === 'string' && (ALL_ITEMS as string[]).includes(v)

/** Saved preferences, completed, with an older version's single `wear` turned into a choice per slot. */
function restorePrefs(saved: (Partial<Prefs> & { wear?: unknown }) | undefined): Prefs {
  const pick: Partial<Outfit> = {}
  if (saved?.pick && typeof saved.pick === 'object') {
    for (const slot of SLOTS) {
      const v = (saved.pick as Record<string, unknown>)[slot]
      if (v === null) pick[slot] = null
      else if (isItem(v) && SLOT[v] === slot) pick[slot] = v
    }
  } else if (saved?.wear === 'none') {
    for (const slot of SLOTS) pick[slot] = null
  } else if (isItem(saved?.wear)) {
    pick[SLOT[saved.wear]] = saved.wear
  }
  const { wear: _old, ...rest } = saved ?? {}
  const open = { level: saved?.open?.level === true, wardrobe: saved?.open?.wardrobe === true }
  // Choices saved before there were languages were made in Turkish, its only one then.
  const lang = typeof saved?.lang === 'string' && (saved.lang === 'auto' || pickLang(saved.lang) !== null) ? saved.lang : saved !== undefined ? 'tr' : 'auto'
  return { ...DEFAULT_PREFS, ...rest, pick, open, lang }
}
const NO_ENV: Env = {
  context: -1, agents: 0, turnTools: 0, tokens: 0, window: 0, slices: [], limits: [], cost: 0, recent: [], last: '', compactAt: 0, allSlices: [], git: null, turns: [], files: [], kinds: {}, startedAt: 0,
  samples: [], peers: [], history: null, tz: 0, lastEdit: null,
}
/** The face at rest, in the language in use. */
const rest0 = (): Omit<Face, 'frameAt'> => ({ mood: 'idle', line: t().st.ready, until: 0, since: 0 })
const FIRST_SHOT: Shot = { mood: 'idle', scene: { context: -1, agents: 0 }, at: 0, from: null }

const face = atom({ plugin: 'mochi', key: 'face' } as const, { mood: 'idle' as Mood, line: '', until: 0, since: 0, frameAt: -1 })
const shot = atom({ plugin: 'mochi', key: 'shot' } as const, FIRST_SHOT)
const NO_INFO: Info = {
  label: '', detail: '', context: { percent: -1, tokens: 0, window: 0, slices: [] }, limits: [], cost: 0, agents: 0, tools: 0, isBusy: false, recent: [], last: '', compactPct: 0, warn: 0, git: null,
}
const panel = atom({ plugin: 'mochi', key: 'panel' } as const, { shot: FIRST_SHOT, info: NO_INFO, infoFrom: null, infoAt: 0 })
const detail = atom({ plugin: 'mochi', key: 'detail' } as const, NO_ENV)
const DETAIL = 'mochi-detay'
const GIT_EVERY_MS = 60_000
const NUDGE_EVERY_MS = 45 * 60_000
const COMMIT_STALE_MS = 90 * 60_000
const frame = atom({ plugin: 'mochi', key: 'frame' } as const, 0)
const sec = atom({ plugin: 'mochi', key: 'sec' } as const, 0)
const env = atom({ plugin: 'mochi', key: 'env' } as const, NO_ENV)
const prefs = atom({ plugin: 'mochi', key: 'prefs' } as const, DEFAULT_PREFS)

const TICK_MS = 450
const SLEEPY_AFTER = 3 * 60_000
const SLEEP_AFTER = 8 * 60_000
const LISTEN_FOR = 4000
const LONG_TOOL = 12_000
const AFTER_TOOL_MS = 1500
/** The least time one drawing stays before the next takes over, so bursts of tool calls glide rather than flicker. */
const DWELL_MS = 450
/** The desktop rebuilds its band on each redraw: new figures wait this long, unless the pose changes anyway. */
const INFO_EVERY_MS = 2500

/** A turn this long ends with a system notification; a question this far into one too. */
const LONG_TURN_S = 120
const ASKS_AFTER_MS = 60_000
const PEERS_EVERY_MS = 3000
const LIVE_EVERY_MS = 15_000
const HISTORY_EVERY_MS = 10 * 60_000
const SAMPLES_EVERY_MS = 5 * 60_000

/** Moods that belong to a running tool, so a long run turns them into `waiting`. */
const TOOL_MOODS: ReadonlySet<Mood> = new Set(['reading', 'searching', 'writing', 'running', 'nervous', 'web', 'scared'])

const width = (s: string) => [...s].length
/** Turkish letters folded to ASCII, for matching what the person typed. */
const plain = (s: string) => s.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const cut = (s: string, max: number) => (width(s) <= max ? s : `${[...s].slice(0, Math.max(1, max - 1)).join('')}…`)

type Dollar = EngineInterface

// Per-load bookkeeping (a reload starts it over); what the drawing reads lives in $.state.
let isBusy = false
let lastActivity = 0
let lastTypedAt = 0
let faceToken = 0
let errorRun = 0
let callId = 0
let gitAt = 0
let isGitWanted = true
let lastNudge = 0
let warned = 0
let pendingWarn = 0
let costAtStart = 0
let detailAt = 0
let stream: 'thinking' | 'talking' | null = null
let turn = { startedAt: 0, tools: 0, edits: 0, errors: 0 }
let watch: Watch = NEW_WATCH
let pendingLimit = ''
let warnedLimits: string[] = []

// Where Mochi keeps what outlives the chat, shared by every chat on the machine.
let dataDir = ''
/** Where chats still running the mascot under its former name (Brutex) keep theirs, read alongside until they restart. */
let formerDir = ''
let sessionId = ''
/** This chat's short name for the others; '' until known. */
let label = ''
let isLabelFromPrompt = false
/** This chat's own days, written to its file in `days/` after each turn. */
let myDays: Record<string, DayRec> = {}
/** The other chats' days, as last read. */
let otherDays: Record<string, DayRec>[] = []
let historyAt = 0
let samplesAt = 0
let liveAt = 0
let liveKey = ''
let peersAt = 0
let peerMtimes: Record<string, number> = {}
let peerCache: Record<string, Peer> = {}
let lastTurnFailed = false
/** Where the band was last drawn: the desktop rebuilds the band on every redraw, so there the details live in the status line. */
let drawnOn: 'terminal' | 'remote' | null = null
let lastStatus: string | undefined

async function play($: Dollar, sound: SoundName | undefined) {
  if (sound === undefined || !(await read($, prefs)).hasSound) return
  void $.audio.play({ base64: clip(sound), mime: 'audio/wav' }).catch(() => undefined)
}

/** Whether the pose leaves the right hand down and empty, to hold a cup or a balloon. */
const canHold = (mood: Mood) => POSES[mood].held === undefined && POSES[mood].armR >= -40 && POSES[mood].armR <= 0

/** What Mochi has on now: the person's choice (while it can still be worn), what it earned, the season and the hour. */
function outfitNow(p: Prefs, v: Env, mood: Mood, now: number): Outfit {
  const ok = wearable(v.history, now, v.tz)
  const pick: Partial<Outfit> = {}
  for (const slot of SLOTS) {
    const chosen = p.pick[slot]
    if (chosen === null || (chosen !== undefined && ok.includes(chosen))) pick[slot] = chosen
  }
  return outfitFor(pick, unlocked(v.history), now, v.tz, mood, canHold(mood))
}

/** Puts on an item, or takes it off when it is already on; the slot then stays empty. */
async function toggleItem($: Dollar, item: Item) {
  const now = await $.clock.now()
  const v = await read($, env)
  if (!wearable(v.history, now, v.tz).includes(item)) return
  const worn = outfitNow(await read($, prefs), v, (await read($, face)).mood, now)
  const slot = SLOT[item]
  await setPrefs($, p => ({ ...p, pick: { ...p.pick, [slot]: worn[slot] === item ? null : item } }))
  await sync($)
}

/** The scene the drawing shows, in steps coarse enough not to redraw on every token. */
function sceneOf(v: Env, outfit: Outfit): Scene {
  return { context: v.context < 0 ? -1 : Math.round(v.context / 5) * 5, agents: Math.min(3, v.agents), outfit }
}

const sameScene = (a: Scene, b: Scene) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Brings the desktop drawing to the current mood and scene: the new shot
 * starts from exactly what the old one shows at this moment. Within the dwell
 * it waits; the next tick tries again.
 */
async function sync($: Dollar) {
  const now = await $.clock.now()
  const mood = (await read($, face)).mood
  const v = await read($, env)
  const scene = sceneOf(v, outfitNow(await read($, prefs), v, mood, now))
  const cur = await read($, shot)
  if (cur.mood === mood && sameScene(cur.scene, scene)) return
  if (cur.at > 0 && now - cur.at < DWELL_MS) return
  const params = paramsAt(cur.from?.params ?? null, cur.mood, cur.at > 0 ? now - cur.at : 60_000)
  await update($, shot, () => ({ mood, scene, at: now, from: { params, mood: cur.mood, scene: cur.scene } }))
}

/** The status line: the details on a surface whose band only shows the mascot, or a face while hidden. */
async function statusText($: Dollar): Promise<string | undefined> {
  const p = await read($, prefs)
  const f = await read($, face)
  return p.isHidden ? `${kaomoji(f.mood, 0)} ${f.line}` : undefined
}

/** What the desktop panel would show now. */
async function infoNow($: Dollar): Promise<Info> {
  const f = await read($, face)
  const v = await read($, env)
  return {
    label: moodLabel(f.mood),
    detail: f.line,
    context: { percent: v.context, tokens: v.tokens, window: v.window, slices: v.slices },
    limits: v.limits,
    cost: Math.round(v.cost * 100) / 100,
    agents: v.agents,
    tools: v.turnTools,
    isBusy,
    recent: v.recent,
    last: v.last,
    compactPct: v.compactAt > 0 && v.window > 0 ? (v.compactAt / v.window) * 100 : 0,
    warn: warnLevel(v),
    git: v.git ? { branch: v.git.branch, changed: v.git.changed, ahead: v.git.ahead, behind: v.git.behind, lastCommit: v.git.lastCommit } : null,
    forecast: forecasts(v, await $.clock.now()),
    tz: v.tz,
    peers: v.peers,
  }
}

/** When each usage window runs out at this pace, rounded to the minute so the panel does not redraw for nothing. */
function forecasts(v: Env, now: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of v.limits) {
    const at = forecastFull(v.samples, l, now)
    if (at !== null) out[l.kind] = Math.round(at / 60_000) * 60_000
  }
  return out
}

/**
 * Redraws the desktop panel when the pose changed, or when its figures did and
 * the last redraw is old enough; a minute's turn redraws the reset countdowns.
 */
async function drawPanel($: Dollar) {
  if (drawnOn !== 'remote') return
  const now = await $.clock.now()
  const cur = await read($, panel)
  const s = await read($, shot)
  const info = await infoNow($)
  const isNewShot = cur.shot.at !== s.at
  const minute = Math.floor(now / 60_000) !== Math.floor(cur.infoAt / 60_000) && info.limits.length > 0
  const isNewInfo = JSON.stringify(info) !== JSON.stringify(cur.info)
  if (!isNewShot && !minute && !(isNewInfo && now - cur.infoAt >= INFO_EVERY_MS)) return
  await update($, panel, () => ({ shot: s, info, infoFrom: isNewInfo ? cur.info : cur.infoFrom, infoAt: isNewInfo || minute ? now : cur.infoAt }))
}

const toLimits = (list: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): Limit[] =>
  list.map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt ? Date.parse(l.resetsAt) || 0 : 0 }))

/** Reads the context's categories (estimated locally, no request) and the usage windows. */
async function measure($: Dollar) {
  const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
  if (usage === undefined) return
  const b = usage.context.breakdown
  const slices: Slice[] = b ? b.categories.filter(c => c.kind === 'used' && c.tokens > 0).map(c => ({ name: c.name, tokens: c.tokens, color: c.color })) : []
  const allSlices = b ? b.categories.filter(c => c.kind !== 'deferred' && c.tokens > 0).map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })) : []
  await setEnv($, v => ({
    ...v,
    startedAt: usage.startedAt || v.startedAt,
    compactAt: b ? (b.isAutoCompactEnabled ? (b.autoCompactThreshold ?? 0) : 0) : v.compactAt,
    allSlices: allSlices.length > 0 ? allSlices : v.allSlices,
    context: usage.context.percent ?? v.context,
    tokens: usage.context.tokens ?? v.tokens,
    window: usage.context.window || v.window,
    slices: slices.length > 0 ? slices : v.slices,
    limits: usage.rateLimits.length > 0 ? toLimits(usage.rateLimits) : v.limits,
    cost: usage.cost?.usd ?? v.cost,
  }))
  await noteLimits($)
}

/** Records the usage windows' readings and warns once per window when one will run out before its reset. */
async function noteLimits($: Dollar) {
  const now = await $.clock.now()
  const v = await update($, env, x => ({ ...x, samples: x.limits.reduce((list, l) => addSample(list, l.kind, l.percent, now), x.samples) }))
  for (const l of v.limits) {
    const at = forecastFull(v.samples, l, now)
    const key = `${l.kind}:${Math.round(l.resetsAt / 60_000)}`
    if (at === null || warnedLimits.includes(key)) continue
    const isSoon = l.kind === 'five_hour' ? at - now <= 45 * 60_000 : at - now <= 24 * 60 * 60_000
    if (!isSoon) continue
    warnedLimits = [...warnedLimits, key]
    const name = t().limit.long[l.kind] ?? l.kind
    const line = t().limit.pace(name, clockAt(at, now, v.tz), clockAt(l.resetsAt, now, v.tz))
    if (isBusy) pendingLimit = line
    else await show($, { mood: 'nervous', line, holdMs: 10_000, sound: 'alarm' })
    $.ui.toast(`Mochi: ${line}`, { timeoutMs: 8000 })
  }
}

async function refreshStatus($: Dollar) {
  const text = await statusText($)
  if (text === lastStatus) return
  lastStatus = text
  $.ui.status(text)
}

/** Writes the face; a new mood records the frame it changed on, then the drawing follows. */
async function putFace($: Dollar, next: Omit<Face, 'frameAt'>) {
  const n = await read($, frame)
  await update($, face, f => ({ ...next, frameAt: f.mood === next.mood ? f.frameAt : n }))
  await sync($)
  await refreshStatus($)
  await drawPanel($)
  void writeLive($).catch(() => undefined)
}

/** Puts a reaction on the face; `since` starts a visible clock. Returns a token for "is it still mine". */
async function show($: Dollar, r: Reaction, since = 0): Promise<number> {
  const now = await $.clock.now()
  faceToken += 1
  const token = faceToken
  await putFace($, { mood: r.mood, line: r.line, until: r.holdMs > 0 ? now + r.holdMs : 0, since })
  await play($, r.sound)
  return token
}

async function rest($: Dollar) {
  faceToken += 1
  await putFace($, isBusy ? { mood: 'thinking', line: t().st.thinking, until: 0, since: 0 } : rest0())
}

/** The model's stream: thinking or writing its answer. Writes only on a change. */
async function noteStream($: Dollar, kind: 'thinking' | 'talking') {
  if (stream === kind) return
  stream = kind
  const now = await $.clock.now()
  const f = await read($, face)
  if (f.until > now || TOOL_MOODS.has(f.mood) || f.mood === 'asking' || f.mood === 'agent' || f.mood === 'waiting') return
  await show($, kind === 'thinking'
    ? { mood: 'thinking', line: t().st.thinking, holdMs: 0 }
    : { mood: 'talking', line: t().st.talking, holdMs: 0 }, now)
}

async function noteTyping($: Dollar, isEmpty: boolean) {
  const f = await read($, face)
  if (isEmpty) {
    if (f.mood === 'listening') await rest($)
    return
  }
  if (f.mood !== 'listening' && f.until === 0) {
    faceToken += 1
    await putFace($, { mood: 'listening', line: 'dinliyor', until: 0, since: 0 })
  }
}

async function setEnv($: Dollar, change: (v: Env) => Env) {
  const v = await update($, env, change)
  await watchContext($, v)
  await sync($)
  await refreshStatus($)
  await drawPanel($)
}

/**
 * Warns once per level as the context nears its compaction point: at once
 * when idle, at the end of the turn when busy (so the work is not interrupted).
 */
async function watchContext($: Dollar, v: Env) {
  const level = warnLevel(v)
  if (level < warned) {
    warned = level
    pendingWarn = 0
    return
  }
  if (level <= warned) return
  warned = level
  if (isBusy) {
    pendingWarn = level
    return
  }
  await show($, { mood: level >= 3 ? 'scared' : 'nervous', line: contextWarning(v, level), holdMs: 10_000, sound: 'alarm' })
}

/** Reads the repository: branch, ahead and behind, changed paths, the last commit. */
async function refreshGit($: Dollar) {
  gitAt = await $.clock.now()
  isGitWanted = false
  const run = (args: string[]) => $.process.run(args, { timeoutMs: 5000 }).catch(() => undefined)
  const status = await run(['git', 'status', '--porcelain=v1', '-b', '-uall'])
  const log = status?.exitCode === 0 ? await run(['git', 'log', '-1', '--format=%ct']) : undefined
  const base = status?.exitCode === 0 ? parseGit(status.stdout, log?.exitCode === 0 ? log.stdout : '') : null
  if (base === null) {
    await setEnv($, v => (v.git === null ? v : { ...v, git: null }))
    return
  }
  const top = await run(['git', 'rev-parse', '--show-toplevel'])
  const root = top?.exitCode === 0 ? top.stdout.trim() : ''
  // Lines added and removed against the last commit, staged or not; before the first commit, what is staged.
  const diff = await run(['git', 'diff', ...(base.lastCommit > 0 ? ['HEAD'] : ['--cached']), '--numstat', '--no-renames'])
  // A new file not yet added counts as all added: its lines, for the first twenty.
  const fresh = root === '' ? [] : base.files.filter(f => f.code === '??' && !f.path.endsWith('/')).slice(0, 20)
  const wc = fresh.length > 0 ? await run(['wc', '-l', '--', ...fresh.map(f => `${root}/${f.path}`)]) : undefined
  const counts: Record<string, number> = {}
  for (const [path, n] of Object.entries(parseWc(wc?.stdout ?? ''))) counts[path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path] = n
  const git = withLines(base, parseNumstat(diff?.stdout ?? ''), counts, root)
  await setEnv($, v => (JSON.stringify(v.git) === JSON.stringify(git) ? v : { ...v, git }))
}

/** What an edit is about to change, in lines; a Write is compared with the file as it stands before it. */
async function editDelta($: Dollar, tool: string, args: Record<string, unknown>, path: string): Promise<ReturnType<typeof lineDelta> | null> {
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  if (tool === 'Edit') return lineDelta(text(args.old_string), text(args.new_string))
  if (tool === 'Write') return lineDelta(await $.fs.read(path).catch(() => ''), text(args.content))
  if (tool === 'MultiEdit' && Array.isArray(args.edits)) {
    const parts = (args.edits as Record<string, unknown>[]).map(x => lineDelta(text(x.old_string), text(x.new_string)))
    const first = parts.find(x => x.add + x.del > 0) ?? parts[0]
    if (first === undefined) return null
    return { ...first, add: parts.reduce((a, x) => a + x.add, 0), del: parts.reduce((a, x) => a + x.del, 0) }
  }
  return null
}

// ---------- what outlives the chat ----------

const q = (s: string) => `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

/**
 * A system notification (and a toast) about this chat: a long turn ended, or it
 * waits on the person. macOS only; elsewhere the toast alone.
 */
async function notify($: Dollar, text: string) {
  if (!(await read($, prefs)).hasAlert) return
  $.ui.toast(`Mochi: ${text}`, { timeoutMs: 8000 })
  const script = `display notification ${q(text)} with title "Mochi" subtitle ${q(label)} sound name "Glass"`
  void $.process.run(['osascript', '-e', script], { timeoutMs: 5000 }).catch(() => undefined)
}

/** Where this chat stands, for the other chats: working, asking, idle or failed. */
async function liveNow($: Dollar): Promise<Omit<Peer, 'at'>> {
  const f = await read($, face)
  // Waiting on the person is the asking face held open; a nudge or another chat's news holds it only a while.
  const isAsking = f.mood === 'asking' && f.until === 0
  const state: Peer['state'] = isAsking ? 'asking' : isBusy ? 'busy' : lastTurnFailed ? 'error' : 'idle'
  return { id: sessionId, label: label || t().word.chat, state, line: f.line, since: state === 'busy' ? turn.startedAt : 0 }
}

/** Writes this chat's file when where it stands changed (at most every 1.5 s), and every 15 s so the others know it is alive. */
async function writeLive($: Dollar, isForced = false) {
  if (dataDir === '' || sessionId === '') return
  const now = await $.clock.now()
  const live = await liveNow($)
  const key = JSON.stringify(live)
  if (!isForced && (key === liveKey ? now - liveAt < LIVE_EVERY_MS : now - liveAt < 1500)) return
  liveKey = key
  liveAt = now
  await $.fs.write(`${dataDir}/live/${sessionId}.json`, JSON.stringify({ ...live, at: now })).catch(() => undefined)
}

/** Reads the other chats' files that changed, and says what is worth saying about them. */
async function readPeers($: Dollar) {
  if (dataDir === '') return
  const now = await $.clock.now()
  peersAt = now
  const seen: Record<string, number> = {}
  for (const dir of [`${dataDir}/live`, ...(formerDir ? [`${formerDir}/live`] : [])]) {
    for (const entry of await $.fs.list(dir).catch(() => [])) {
      const path = `${dir}/${entry.name}`
      if (!entry.name.endsWith('.json') || entry.name === `${sessionId}.json` || now - entry.mtimeMs > 60_000) continue
      seen[path] = entry.mtimeMs
      if (peerMtimes[path] === entry.mtimeMs && peerCache[path]) continue
      const text = await $.fs.read(path).catch(() => '')
      try {
        const peer = peerOf(JSON.parse(text), now)
        if (peer) peerCache[path] = peer
      } catch {
        // A file caught mid-write: read it next time.
      }
    }
  }
  peerMtimes = seen
  for (const path of Object.keys(peerCache)) if (seen[path] === undefined) delete peerCache[path]
  // A chat may have a file under both names: the fresher one counts.
  const byId: Record<string, Peer> = {}
  for (const p of Object.values(peerCache)) if (now - p.at <= 45_000 && (byId[p.id]?.at ?? 0) < p.at) byId[p.id] = p
  const peers = Object.values(byId).sort((a, b) => a.label.localeCompare(b.label))
  const before = (await read($, env)).peers
  if (JSON.stringify(before) === JSON.stringify(peers)) return
  await setEnv($, v => ({ ...v, peers }))
  const news = peerNews(before, peers, now)
  if (news.length === 0) return
  for (const line of news) $.ui.toast(`Mochi: ${line}`, { timeoutMs: 6000 })
  const f = await read($, face)
  if (!isBusy && f.until === 0 && (f.mood === 'idle' || f.mood === 'sleepy' || f.mood === 'sleeping')) {
    await show($, { mood: news[0]?.includes('onay') || news[0]?.includes('cevab') ? 'asking' : 'pleased', line: news[0] ?? '', holdMs: 5000 })
  }
}

/** Every chat's days, read in one go (each file is one line), with this chat's own from memory. */
async function refreshHistory($: Dollar) {
  if (dataDir === '') return
  historyAt = await $.clock.now()
  const ran = await $.process.run(['sh', '-c', 'cat "$0"/*.json "$1"/*.json 2>/dev/null; exit 0', `${dataDir}/days`, `${formerDir || dataDir}/days`], { timeoutMs: 8000 }).catch(() => undefined)
  // A chat that ran under both names has a file in each, the later one holding all of the earlier: it counts once, by its fuller file.
  const turnsIn = (days: Record<string, DayRec>) => Object.values(days).reduce((a, d) => a + (d.turns ?? 0), 0)
  const byId: Record<string, Record<string, DayRec>> = {}
  for (const line of (ran?.stdout ?? '').split('\n')) {
    if (line.trim() === '') continue
    try {
      const file = JSON.parse(line) as { id?: unknown; days?: unknown }
      if (typeof file.id !== 'string' || file.id === sessionId || typeof file.days !== 'object' || file.days === null) continue
      const days = file.days as Record<string, DayRec>
      const had = byId[file.id]
      if (had === undefined || turnsIn(days) > turnsIn(had)) byId[file.id] = days
    } catch {
      // A file caught mid-write counts next time.
    }
  }
  otherDays = Object.values(byId)
  await recount($)
}

/** The history from the other chats as last read and this one as it stands; a new level is celebrated. */
async function recount($: Dollar) {
  const now = await $.clock.now()
  const v = await read($, env)
  const history = summarize([...otherDays, myDays], dayKey(now, v.tz))
  await setEnv($, x => ({ ...x, history }))
  await checkLevel($)
}

async function saveDays($: Dollar) {
  if (dataDir === '' || sessionId === '') return
  await $.fs.write(`${dataDir}/days/${sessionId}.json`, `${JSON.stringify({ id: sessionId, label, days: myDays })}\n`).catch(() => undefined)
}

async function addToday($: Dollar, rec: Partial<DayRec>) {
  const now = await $.clock.now()
  const key = dayKey(now, (await read($, env)).tz)
  myDays = { ...myDays, [key]: addDay(myDays[key] ?? EMPTY_DAY, rec) }
}

/** A level or item earned since the last look is celebrated once, in whichever chat sees it first. */
async function checkLevel($: Dollar) {
  if (dataDir === '') return
  const h = (await read($, env)).history
  if (h === null) return
  const level = levelOf(xpOf(h)).level
  const items = unlocked(h)
  const path = `${dataDir}/level.json`
  let saved: { level?: number; items?: Item[] } | null = null
  try {
    saved = JSON.parse(await $.fs.read(path)) as { level?: number; items?: Item[] }
  } catch {
    saved = null
  }
  const fresh = items.filter(i => !(saved?.items ?? []).includes(i))
  if (saved !== null && (saved.level ?? 1) >= level && fresh.length === 0) return
  await $.fs.write(path, JSON.stringify({ level, items })).catch(() => undefined)
  if (saved === null) return
  const parts = [...((saved.level ?? 1) < level ? [t().st.level(level)] : []), ...(fresh.length > 0 ? [t().st.newItems(fresh.map(itemName).join(', '))] : [])]
  await show($, { mood: 'party', line: parts.join(' · '), holdMs: 8000, sound: 'party' })
  $.ui.toast(`Mochi: ${parts.join(' · ')}${fresh.length > 0 ? t().note.seeWardrobe : ''}`, { timeoutMs: 8000 })
}

/** The usage readings are the account's, so every chat shares one file of them. */
async function saveSamples($: Dollar) {
  if (dataDir === '') return
  samplesAt = await $.clock.now()
  const path = `${dataDir}/usage.json`
  let theirs: Env['samples'] = []
  try {
    const parsed = JSON.parse(await $.fs.read(path)) as unknown
    if (Array.isArray(parsed)) theirs = parsed.filter((x): x is Env['samples'][number] => typeof x === 'object' && x !== null && typeof (x as { at?: unknown }).at === 'number')
  } catch {
    theirs = []
  }
  const now = samplesAt
  const v = await update($, env, x => {
    const all = [...theirs, ...x.samples].filter(s => now - s.at < 48 * 60 * 60_000).sort((a, b) => a.at - b.at)
    const merged = all.filter((s, i) => i === 0 || s.at !== all[i - 1]?.at || s.kind !== all[i - 1]?.kind).slice(-400)
    return { ...x, samples: merged }
  })
  await $.fs.write(path, JSON.stringify(v.samples)).catch(() => undefined)
}

/**
 * The preferences saved under the mascot's former name (Brutex), which kept
 * its own store: read once, so the choices made there carry over.
 */
async function formerPrefs($: Dollar): Promise<unknown> {
  const home = await $.env.get('HOME').catch(() => undefined)
  if (!home) return undefined
  const dir = `${home}/.claude/plugins/store`
  const old = (await $.fs.list(dir).catch(() => [])).find(f => f.name.startsWith('brutex_inline-') && f.name.endsWith('.json'))
  if (old === undefined) return undefined
  try {
    return (JSON.parse(await $.fs.read(`${dir}/${old.name}`)) as { prefs?: unknown }).prefs
  } catch {
    return undefined
  }
}

// ---------- the language ----------

let autoLang: Lang | null = null

/**
 * The language to speak when none is chosen: Claude Code's own `language`
 * setting, then the system's preferred languages (macOS), then `LANG`; English
 * when none of them is one Mochi speaks.
 */
async function detectLang($: Dollar): Promise<Lang> {
  const settings = await $.settings.read().catch(() => undefined)
  const fromSettings = pickLang(typeof settings?.language === 'string' ? settings.language : undefined)
  if (fromSettings) return fromSettings
  const mac = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 3000 }).catch(() => undefined)
  if (mac?.exitCode === 0) {
    for (const code of mac.stdout.match(/[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*/g) ?? []) {
      const found = pickLang(code)
      if (found) return found
    }
  }
  return pickLang(await $.env.get('LANG').catch(() => undefined)) ?? 'en'
}

/** Speaks the chosen language, or the detected one for `auto`. */
async function applyLang($: Dollar, p: Prefs): Promise<Lang> {
  const chosen = p.lang === 'auto' ? null : pickLang(p.lang)
  if (chosen) {
    setLang(chosen)
    return chosen
  }
  if (autoLang === null) autoLang = await detectLang($)
  setLang(autoLang)
  return autoLang
}

/** Finds the shared folder, the clock's zone and this chat's name, and picks up where a resumed chat left off. */
async function startShared($: Dollar) {
  const home = await $.env.get('HOME').catch(() => undefined)
  sessionId = await $.session.id().catch(() => '')
  dataDir = home ? `${home}/.claude/mochi` : ''
  formerDir = home ? `${home}/.claude/brutex` : ''
  const zone = await $.process.run(['date', '+%z'], { timeoutMs: 3000 }).catch(() => undefined)
  const tz = zone?.exitCode === 0 ? parseTz(zone.stdout) : 0
  await update($, env, v => ({ ...v, tz }))
  label = peerLabel(await $.session.root().catch(() => ''), '')
  isLabelFromPrompt = label === ''
  if (isLabelFromPrompt) void firstPromptLabel($).catch(() => undefined)
  if (dataDir === '' || sessionId === '') return
  // A resumed chat may have a file under both names; the fuller one holds the other.
  myDays = {}
  const turnsIn = (days: Record<string, DayRec>) => Object.values(days).reduce((a, d) => a + (d.turns ?? 0), 0)
  for (const dir of [dataDir, formerDir]) {
    if (dir === '') continue
    try {
      const file = JSON.parse(await $.fs.read(`${dir}/days/${sessionId}.json`)) as { days?: Record<string, DayRec> }
      if (file.days && turnsIn(file.days) >= turnsIn(myDays)) myDays = file.days
    } catch {
      // Not under this name.
    }
  }
  void saveSamples($).catch(() => undefined)
  void refreshHistory($).catch(() => undefined)
  void cleanLive($).catch(() => undefined)
  void writeLive($, true).catch(() => undefined)
}

/** A resumed chat in a folder that names nothing takes its name from its first prompt. */
async function firstPromptLabel($: Dollar) {
  const found = await $.session.messages()
  const first = Array.isArray(found) ? found.find(m => m.role === 'user' && typeof m.text === 'string' && !m.text.trim().startsWith('<')) : undefined
  if (first && label === '') label = peerLabel('', first.text)
}

/** Files of chats closed long ago (or that never said goodbye) are removed. */
async function cleanLive($: Dollar) {
  const now = await $.clock.now()
  const list = await $.fs.list(`${dataDir}/live`).catch(() => [])
  const old = list.filter(f => f.name.endsWith('.json') && now - f.mtimeMs > 10 * 60_000).map(f => `${dataDir}/live/${f.name}`)
  if (old.length > 0) await $.process.run(['rm', '-f', ...old], { timeoutMs: 5000 }).catch(() => undefined)
}

async function openDetail($: Dollar) {
  await update($, detail, () => ({ ...NO_ENV, ...(lastEnv ?? NO_ENV) }))
  detailAt = await $.clock.now()
  const opened = await $.ui.open({ id: DETAIL, title: t().detail.title })
  if (!opened.isPlaced) $.ui.toast(t().note.detailFailed(opened.reason))
}
let lastEnv: Env | null = null

async function setPrefs($: Dollar, change: (p: Prefs) => Prefs) {
  const next = await update($, prefs, change)
  await $.store.set('prefs', next)
  await refreshStatus($)
  return next
}

async function tick($: Dollar) {
  const now = await $.clock.now()
  const p = await read($, prefs)
  if (!p.isHidden) await update($, frame, n => (n + 1) % 840)
  const f = await read($, face)
  const s = Math.floor(now / 1000)
  if (f.since > 0 && (await read($, sec)) !== s) await update($, sec, () => s)
  await sync($)
  await refreshStatus($)
  await drawPanel($)
  const v = await read($, env)
  lastEnv = v
  if ((isGitWanted && now - gitAt > 4000) || now - gitAt > GIT_EVERY_MS) void refreshGit($).catch(() => undefined)
  void writeLive($).catch(() => undefined)
  if (now - peersAt > PEERS_EVERY_MS) void readPeers($).catch(() => undefined)
  if (now - historyAt > HISTORY_EVERY_MS) void refreshHistory($).catch(() => undefined)
  if (now - samplesAt > SAMPLES_EVERY_MS) void saveSamples($).catch(() => undefined)
  if (now - detailAt > 3000) {
    detailAt = now
    const d = await read($, detail)
    if (JSON.stringify(d) !== JSON.stringify(v)) await update($, detail, () => v)
  }
  const git = v.git
  if (!isBusy && git && git.changed > 0 && f.until === 0 && (f.mood === 'idle' || f.mood === 'sleepy') && now - lastNudge > NUDGE_EVERY_MS
    && (git.lastCommit === 0 || now - git.lastCommit > COMMIT_STALE_MS) && now - lastActivity > 20_000) {
    lastNudge = now
    await show($, { mood: 'asking', line: t().st.commitNudge(git.changed, git.lastCommit > 0 ? t().st.lastCommit(ago(now - git.lastCommit)) : t().st.noCommits), holdMs: 9000 })
    return
  }

  if (f.until > 0) {
    if (now > f.until) await rest($)
    return
  }
  if (TOOL_MOODS.has(f.mood) && f.since > 0 && now - f.since > LONG_TOOL) {
    await putFace($, { ...f, mood: 'waiting' })
    return
  }
  if (f.mood === 'listening' && now - lastTypedAt > LISTEN_FOR) {
    await rest($)
    return
  }
  if (isBusy) return
  const quiet = now - lastActivity
  // Late at night Mochi tires sooner.
  const isNight = season(now, v.tz).isNight
  const sleepAfter = isNight ? 4 * 60_000 : SLEEP_AFTER
  const sleepyAfter = isNight ? 90_000 : SLEEPY_AFTER
  const mood: Mood | null = quiet > sleepAfter ? 'sleeping' : quiet > sleepyAfter ? 'sleepy' : null
  if (mood !== null && (f.mood === 'idle' || f.mood === 'sleepy' || f.mood === 'sleeping')) {
    const line = restLine(mood, quiet)
    if (f.mood !== mood || f.line !== line) await putFace($, { mood, line, until: 0, since: 0 })
  }
}

/** The wardrobe's buttons act in the `ui.press` hook, where `$` is at hand; their own handler has nothing left to do. */
const pressed = () => undefined

/** An item's picture for the wardrobe, faded while locked. */
function iconSvg(item: Item, isOpen: boolean): string {
  const vector = VECTOR_WEAR[item]
  if (vector) {
    const [x, y, w, h] = vector.box
    // Glasses read as glasses on a patch of Mochi's own clay, not on the dark card.
    const skin = vector.onSkin ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${Math.min(w, h) / 2 - 1}" fill="#D97757"/>` : ''
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="100%" height="100%"><g opacity="${isOpen ? 1 : 0.38}">${skin}${vector.svg}</g></svg>`
  }
  const a = WEAR[item]
  const scale = Math.min(44 / a.w, 30 / a.h)
  const w = a.w * scale
  const h = a.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 32" width="100%" height="100%"><image href="${a.uri}" x="${(46 - w) / 2}" y="${(32 - h) / 2}" width="${w}" height="${h}" opacity="${isOpen ? 1 : 0.38}"/></svg>`
}

/** The terminal drawing's hat row, when the mood leaves it empty and something is worn on the head. */
function withHat(rows: string[], head: Item | null, isShiftedRight: boolean): string[] {
  const hat = head ? ASCII_HAT[head] : undefined
  const top = rows[0]
  if (hat === undefined || top === undefined || top.trim() !== '') return rows
  const at = isShiftedRight ? 3 : 2
  return [top.slice(0, at) + hat + top.slice(at + 5), ...rows.slice(1)]
}

async function wake($: Dollar): Promise<boolean> {
  const now = await $.clock.now()
  const quiet = now - lastActivity
  lastActivity = now
  const mood = (await read($, face)).mood
  return quiet > SLEEPY_AFTER || mood === 'sleeping' || mood === 'sleepy'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // The language first: everything after it speaks it.
    const saved = ((await $.store.get('prefs')) ?? (await formerPrefs($))) as (Partial<Prefs> & { wear?: unknown }) | undefined
    const p = await update($, prefs, () => restorePrefs(saved))
    if (saved !== undefined) await $.store.set('prefs', p)
    await applyLang($, p)
    await $.command.register({ name: 'mochi', description: t().cmd.description, argumentHint: t().cmd.hint })
    // State outlives a reload: a value an older version wrote may lack fields
    // this one reads, so every value is completed with its defaults first.
    await update($, env, v => ({ ...NO_ENV, ...v }))
    await update($, face, f => ({ ...rest0(), ...f, frameAt: f.frameAt ?? -1 }))
    await update($, shot, v => ({ ...FIRST_SHOT, ...v, scene: { ...FIRST_SHOT.scene, ...v.scene } }))
    await update($, panel, v => ({ shot: { ...FIRST_SHOT, ...v.shot }, info: { ...NO_INFO, ...v.info }, infoFrom: null, infoAt: v.infoAt ?? 0 }))
    lastActivity = await $.clock.now()
    await startShared($).catch(() => undefined)
    await measure($)
    lastNudge = await $.clock.now()
    void refreshGit($).catch(() => undefined)
    await show($, { mood: 'wave', line: t().st.ready, holdMs: 3000 })
    if (p.isHidden) await refreshStatus($)
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const ran = await next(e)
    if (isBusy) return ran
    lastTypedAt = await $.clock.now()
    lastActivity = lastTypedAt
    await noteTyping($, ran.text.trim() === '')

    return ran
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    if (text.startsWith('/')) return next(e)
    if (isLabelFromPrompt && label === '') label = peerLabel('', text)
    lastTurnFailed = false
    const wasAsleep = await wake($)
    const now = await $.clock.now()
    stream = null
    await show($, onPrompt(text, wasAsleep), now)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    isBusy = true
    stream = null
    errorRun = 0
    watch = NEW_WATCH
    lastTurnFailed = false
    turn = { startedAt: await $.clock.now(), tools: 0, edits: 0, errors: 0 }
    costAtStart = (await read($, env)).cost
    await setEnv($, v => ({ ...v, turnTools: 0 }))

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const isMain = e.agentId === undefined
    for await (const chunk of next(e)) {
      if (isMain && (chunk.kind === 'thinking' || chunk.kind === 'text')) {
        await noteStream($, chunk.kind === 'thinking' ? 'thinking' : 'talking')
      }
      yield chunk
    }
  })

  on('tool.call', async ($, e, next) => {
    const args = e as unknown as Record<string, unknown> & { tool: string }
    const isSub = e.agentId !== undefined
    const isAgent = e.tool === 'Agent' || String(e.tool) === 'Task'
    const startedAt = await $.clock.now()
    lastActivity = startedAt

    // The shield: a command that cannot be undone waits for the person's word.
    const cmd = e.tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
    const what = cmd === '' ? null : danger(cmd)
    const whatKey = cmd === '' ? null : dangerKey(cmd)
    if (what !== null && (await read($, prefs)).hasShield && (await $.session.surfaces()).length > 0) {
      await show($, { mood: 'scared', line: `${t().st.awaitingApproval} · ${what}`, holdMs: 0, sound: 'alarm' })
      if (isBusy && startedAt - turn.startedAt >= ASKS_AFTER_MS) await notify($, `onay bekliyor · ${what}`)
      const shown = cmd.length > 300 ? `${cmd.slice(0, 299)}…` : cmd
      const d = t().shield
      const answer = await $.ui.ask(d.question(what, shown), { header: 'Mochi', options: [d.run, d.stop] }).catch(() => d.stop)
      if (answer !== d.run) {
        await show($, { mood: 'denied', line: `${t().st.halted} · ${what}`, holdMs: 5000 })
        // Said to the model, so always in English.
        return { deny: `The user stopped this command at Mochi's prompt (it ${whatKey ? DICTS.en.danger[whatKey] : 'cannot be undone'}). Do not retry it; ask the user how to proceed if it is needed.` }
      }
      await show($, { mood: 'nervous', line: `${t().st.approved} · ${subject(args)}`, holdMs: 0 }, startedAt)
    }

    let token = -1
    if (isSub) {
      const f = await read($, face)
      if (f.mood === 'agent') await update($, face, v => ({ ...v, line: `ajan · ${beforeTool(args).line}` }))
    } else if (what === null || !(await read($, prefs)).hasShield) {
      stream = null
      token = await show($, beforeTool(args), waitsOnPerson(e.tool) ? 0 : startedAt)
      if (waitsOnPerson(e.tool) && isBusy && startedAt - turn.startedAt >= ASKS_AFTER_MS) await notify($, beforeTool(args).line)
    }
    if (isAgent) await setEnv($, v => ({ ...v, agents: v.agents + 1 }))
    callId += 1
    const id = callId
    const path = typeof args.file_path === 'string' ? args.file_path : typeof args.notebook_path === 'string' ? args.notebook_path : ''
    const isWrite = /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(e.tool)
    const delta = !isSub && isWrite && path !== '' ? await editDelta($, e.tool, args, path).catch(() => null) : null
    if (!isSub) {
      const kind = toolKind(e.tool)
      const entry: Recent = { id, kind, state: 'run' }
      await setEnv($, v => ({
        ...v,
        recent: [...v.recent, entry].slice(-12),
        kinds: { ...v.kinds, [kind]: (v.kinds[kind] ?? 0) + 1 },
        files: path === '' || !(isWrite || e.tool === 'Read') ? v.files : [
          ...v.files.filter(x => x.path !== path),
          (() => {
            const old = v.files.find(x => x.path === path)
            return { path, reads: (old?.reads ?? 0) + (isWrite ? 0 : 1), edits: (old?.edits ?? 0) + (isWrite ? 1 : 0), at: startedAt }
          })(),
        ].slice(-60),
      }))
      if (isWrite || e.tool === 'Bash') isGitWanted = true
    }

    let ran
    try {
      ran = await next(e)
    } finally {
      if (isAgent) await setEnv($, v => ({ ...v, agents: Math.max(0, v.agents - 1) }))
    }

    // The loop watch, over the subagents' calls too (each its own).
    const isError = ran.isError === true
    const isDenied = ran.deny !== undefined
    const looked = watchCall(watch, isSub ? { ...args, tool: `${e.agentId}:${e.tool}` } : args, isError, typeof ran.text === 'string' ? ran.text : '')
    watch = looked.watch
    if (looked.alarm !== null && !waitsOnPerson(e.tool)) {
      const about = subject(args)
      await show($, { mood: 'dizzy', line: `${t().st.loop} · ${looked.alarm} · ${about}`, holdMs: 10_000, sound: 'alarm' })
      $.ui.toast(`Mochi: ${t().note.loop(looked.alarm, about)}`, { timeoutMs: 9000 })
      if (isSub) return ran
    }
    if (isSub) return ran
    if (cmd !== '' && isCommit(cmd) && !isError && !isDenied) await addToday($, { commits: 1 })
    if (delta !== null && !isError && !isDenied) {
      const at = await $.clock.now()
      await setEnv($, v => ({
        ...v,
        files: v.files.map(f => (f.path === path ? { ...f, add: (f.add ?? 0) + delta.add, del: (f.del ?? 0) + delta.del } : f)),
        lastEdit: delta.add + delta.del > 0 ? { path, at, ...delta } : v.lastEdit,
      }))
    }

    await update($, env, v => ({ ...v, recent: v.recent.map(r => (r.id === id ? { ...r, state: isError || isDenied ? 'fail' as const : 'ok' as const } : r)) }))
    errorRun = isError || isDenied ? errorRun + 1 : 0
    turn.tools += 1
    if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(e.tool) && !isError && !isDenied) turn.edits += 1
    if (isError) turn.errors += 1
    await update($, env, v => ({ ...v, turnTools: turn.tools }))

    const outcome = {
      ...(isDenied ? { deny: ran.deny } : {}),
      ...(isError ? { isError: true as const } : {}),
      ...(typeof ran.text === 'string' ? { text: ran.text } : {}),
    }
    const now = await $.clock.now()
    const after = afterTool(args, outcome, errorRun, (now - startedAt) / 1000)
    if (looked.alarm !== null) {
      // The loop's alarm stays on the face.
    } else if (after !== null) {
      await show($, after)
    } else if (token === faceToken) {
      await update($, face, f => ({ ...f, until: now + AFTER_TOOL_MS }))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('classic.PermissionRequest', async ($, e, next) => {
    const input = typeof e.tool_input === 'object' && e.tool_input !== null ? (e.tool_input as Record<string, unknown>) : {}
    const line = `${t().st.awaitingApproval} · ${subject({ ...input, tool: e.tool_name })}`
    await show($, { mood: 'asking', line, holdMs: 0 })
    if (isBusy && (await $.clock.now()) - turn.startedAt >= ASKS_AFTER_MS) await notify($, line)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    isBusy = false
    stream = null
    const now = await $.clock.now()
    lastActivity = now
    void measure($).catch(() => undefined)
    const ended = onTurnEnd({
      reason: e.reason,
      seconds: Math.round((now - turn.startedAt) / 1000),
      tools: turn.tools,
      edits: turn.edits,
      errors: turn.errors,
    })
    const spent = Math.max(0, (await read($, env)).cost - costAtStart)
    const rec = { at: now, seconds: Math.round((now - turn.startedAt) / 1000), tools: turn.tools, edits: turn.edits, errors: turn.errors, cost: spent }
    const after = await update($, env, v => ({ ...v, last: ended.line.replace(/^bitti · /, ''), turns: [...v.turns, rec].slice(-40) }))
    isGitWanted = true
    lastTurnFailed = e.reason === 'error'
    if (pendingWarn > 0) {
      const level = pendingWarn
      pendingWarn = 0
      await show($, { mood: level >= 3 ? 'scared' : 'nervous', line: contextWarning(after, level), holdMs: 12_000, sound: 'alarm' })
    } else if (pendingLimit !== '') {
      await show($, { mood: 'nervous', line: pendingLimit, holdMs: 10_000, sound: 'alarm' })
    } else {
      await show($, ended)
    }
    pendingLimit = ''
    if (rec.seconds >= LONG_TURN_S && e.reason !== 'aborted') await notify($, ended.line)

    // The day's tally, for the history and the level.
    await addToday($, { turns: 1, tools: turn.tools, edits: turn.edits, errors: turn.errors, cost: spent, secs: rec.seconds, night: season(now, after.tz).isNight ? 1 : 0 })
    await saveDays($)
    await recount($)

    return done
  })

  on('session.measure', async ($, e, next) => {
    const { percent, tokens, window } = e.context
    const context = percent ?? (tokens !== undefined && window > 0 ? Math.round((tokens / window) * 100) : -1)
    await setEnv($, v => ({
      ...v,
      context: context >= 0 ? context : v.context,
      tokens: tokens ?? v.tokens,
      window: window || v.window,
      limits: e.rateLimits.length > 0 ? toLimits(e.rateLimits) : v.limits,
      cost: e.cost?.usd ?? v.cost,
    }))
    if (e.rateLimits.length > 0) await noteLimits($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (dataDir !== '' && sessionId !== '') {
      await saveDays($)
      await $.process.run(['rm', '-f', `${dataDir}/live/${sessionId}.json`], { timeoutMs: 3000 }).catch(() => undefined)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const now = await $.clock.now()
    await show($, { mood: 'squeezed', line: t().st.compacting, holdMs: 0 }, now)
    const done = await next(e)
    warned = 0
    pendingWarn = 0
    await show($, { mood: 'success', line: t().st.compacted, holdMs: 4000 })
    void measure($).catch(() => undefined)

    return done
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'mochi' }, async ($, e) => {
    const [first = '', ...more] = e.args.trim().split(/\s+/)
    const word = plain(first)
    const arg = plain(more.join(' '))
    const p = await read($, prefs)
    const d = t().cmd
    /** Whether `value` names the command: its English words, or the words of the language in use. */
    const names = (value: string, key: keyof typeof d.words, ...english: string[]) =>
      english.includes(value) || d.words[key].some(w => plain(w) === value)

    if (names(word, 'small', 'small', 'compact') || names(word, 'big', 'big', 'full')) {
      const isCompact = names(word, 'small', 'small', 'compact')
      await setPrefs($, v => ({ ...v, isCompact, isHidden: false }))
      return { text: isCompact ? d.small : d.big }
    }
    if (names(word, 'details', 'details', 'detail')) {
      await openDetail($)
      return { text: d.detailOpened }
    }
    if (names(word, 'shield', 'shield')) {
      const next = await setPrefs($, v => ({ ...v, hasShield: !v.hasShield }))
      return { text: next.hasShield ? d.shieldOn : d.shieldOff }
    }
    if (names(word, 'alerts', 'alerts', 'alert', 'notifications')) {
      const next = await setPrefs($, v => ({ ...v, hasAlert: !v.hasAlert }))
      return { text: next.hasAlert ? d.alertsOn(LONG_TURN_S / 60) : d.alertsOff }
    }
    if (names(word, 'lang', 'lang', 'language')) {
      const list = LANGS.map(l => `${l} (${DICTS[l].name})`).join(', ')
      if (arg === '') return { text: d.langNow(t().name, list) }
      if (names(arg, 'auto', 'auto')) {
        autoLang = null
        const next = await setPrefs($, v => ({ ...v, lang: 'auto' }))
        await applyLang($, next)
        await rest($)
        return { text: t().cmd.langAuto(t().name) }
      }
      const chosen = pickLang(arg)
      if (chosen === null) return { text: d.langUnknown(arg, list) }
      const next = await setPrefs($, v => ({ ...v, lang: chosen }))
      await applyLang($, next)
      await rest($)
      return { text: t().cmd.langSet(t().name) }
    }
    if (names(word, 'level', 'level', 'xp')) {
      const h = (await read($, env)).history
      const xp = xpOf(h)
      const l = levelOf(xp)
      const total = h?.total ?? EMPTY_DAY
      const open = unlocked(h)
      return {
        text: [
          d.levelLine(l.level, xp, l.next - xp),
          d.statsLine(total.turns, total.edits, total.commits, h?.activeDays ?? 0, h?.streak ?? 0),
          d.unlocked(open.map(itemName).join(', ') || d.noneYet),
          d.locked(UNLOCKS.filter(u => !open.includes(u.item)).map(u => `${itemName(u.item)} (${hintFor(u.item)})`).join(', ') || d.none),
        ].join('\n'),
      }
    }
    if (names(word, 'wear', 'wear', 'outfit', 'accessory', 'accessories')) {
      const v = await read($, env)
      const now = await $.clock.now()
      const ok = wearable(v.history, now, v.tz)
      if (arg === '') {
        const worn = outfitNow(p, v, (await read($, face)).mood, now)
        return {
          text: [
            ...SLOTS.map(slot => `${slotName(slot)}: ${worn[slot] ? itemName(worn[slot]) : t().ui.empty}${p.pick[slot] === undefined ? t().ui.autoMark : ''}`),
            d.wearList(ok.length, ALL_ITEMS.length, ok.map(itemShort).join(', ')),
            d.wearHow,
          ].join('\n'),
        }
      }
      if (names(arg, 'auto', 'auto')) {
        await setPrefs($, x => ({ ...x, pick: {} }))
        await sync($)
        return { text: d.wearAuto }
      }
      if (names(arg, 'none', 'none', 'off')) {
        await setPrefs($, x => ({ ...x, pick: { head: null, face: null, neck: null, held: null, ground: null } }))
        await sync($)
        return { text: d.wearNone }
      }
      // An item by its id, or its name in the language in use or in English.
      const item = ALL_ITEMS.find(i => i === arg || [itemName(i), itemShort(i), DICTS.en.item.name[i], DICTS.en.item.short[i]].some(n => plain(n) === arg || plain(n).startsWith(arg)))
      if (item === undefined) return { text: d.noSuchItem(arg) }
      if (!ok.includes(item)) return { text: d.itemLocked(itemName(item), hintFor(item)) }
      await setPrefs($, x => ({ ...x, pick: { ...x.pick, [SLOT[item]]: item } }))
      await sync($)
      return { text: d.itemOn(itemName(item)) }
    }
    if (names(word, 'sound', 'sound')) {
      const next = await setPrefs($, v => ({ ...v, hasSound: !v.hasSound }))
      if (next.hasSound) await play($, 'ding')
      return { text: next.hasSound ? d.soundOn : d.soundOff }
    }
    if (names(word, 'hide', 'hide') || (word === '' && !p.isHidden)) {
      await setPrefs($, v => ({ ...v, isHidden: true }))
      return { text: d.hidden }
    }
    if (names(word, 'show', 'show') || word === '') {
      await setPrefs($, v => ({ ...v, isHidden: false }))
      return { text: d.shown }
    }

    const f = await read($, face)
    const v = await read($, env)
    return {
      text: [
        d.statusLine(moodLabel(f.mood), f.line),
        d.contextLine(v.context >= 0 ? `${v.context}%` : t().panel.contextUnknown, v.agents, v.turnTools),
        d.prefsLine(p.hasSound, p.hasShield, p.hasAlert, p.isCompact),
        d.peersLine(levelOf(xpOf(v.history)).level, v.peers.length === 0 ? d.none : v.peers.map(x => x.label).join(', ')),
        d.commands,
      ].join('\n'),
    }
  })

  // Should the click region ever fail to load or draw, say so once instead of
  // leaving the gauges silently unclickable.
  let saidFault = false
  on('ui.fault', async ($, e, next) => {
    if (!saidFault) {
      saidFault = true
      $.ui.toast(`Mochi: ${t().note.clickFailed(e.reason)}`)
    }
    return next(e)
  })

  on('ui.message', async ($, e, next) => {
    const data = e.data
    if (e.element === 'hit' && typeof data === 'object' && data !== null && (data as { open?: unknown }).open === 'detail') {
      await openDetail($)
    }
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin === 'mochi' && (e.element === 'fold:level' || e.element === 'fold:wardrobe')) {
      const which = e.element === 'fold:level' ? 'level' : 'wardrobe'
      await setPrefs($, p => ({ ...p, open: { ...p.open, [which]: !p.open[which] } }))
    }
    if (e.plugin === 'mochi' && e.element.startsWith('wear:')) {
      const what = e.element.slice(5)
      if (what === 'auto') await setPrefs($, p => ({ ...p, pick: {} }))
      else if (what === 'none') await setPrefs($, p => ({ ...p, pick: { head: null, face: null, neck: null, held: null, ground: null } }))
      else if (isItem(what)) await toggleItem($, what)
      await sync($)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: DETAIL }, async ($, e) => {
    const v = { ...NO_ENV, ...(await read($, detail)) }
    const now = await $.clock.now()
    if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
      const { Box, Svg } = $.ui.resolve(e)
      const width = Math.round(Math.min(1400, Math.max(320, e.props.bodyColumns * 8.1 - 8)))
      const { Button, Text } = $.ui.resolve(e)
      const p = await read($, prefs)
      const dressed = outfitNow(p, v, (await read($, face)).mood, now)
      const ok = wearable(v.history, now, v.tz)
      const svg = detailSvg(v, now, width)
      const isAuto = SLOTS.every(slot => p.pick[slot] === undefined)
      // The wardrobe: every item with its picture; a press puts it on or takes it off.
      const cell = (item: Item) => {
        const isOn = dressed[SLOT[item]] === item
        const isOpen = ok.includes(item)
        return (
          <Box key={`cell:${item}`} flexDirection="column" alignItems="center" width={11} paddingTop={0.4} borderStyle="round" borderColor={isOn ? 'claude' : 'inactive'} borderDimColor={!isOn}>
            <Svg source={iconSvg(item, isOpen)} alt={itemName(item)} width={46} height={32} />
            {isOpen
              ? <Button key={`wear:${item}`} plain dimColor={!isOn} onPress={pressed}>{itemShort(item)}</Button>
              : <Text dimColor wrap="truncate">{hintFor(item)}</Text>}
          </Box>
        )
      }
      const worn = SLOTS.map(slot => dressed[slot]).filter((x): x is Item => x !== null).map(itemShort)
      const levelWidth = Math.max(280, width - 56)
      const level = p.open.level ? levelSvg(v, now, levelWidth) : ''
      // Two folding sections under the drawing, folded by default: a heading
      // with the gist, the rest only when opened. Which are open is kept.
      return (
        <Box flexDirection="column">
          <Svg source={svg} alt={t().detail.title} width={width} height={Math.round(detailHeight(svg))} />
          <Box flexDirection="column" paddingX={2} paddingBottom={2} gap={1}>
            <Box key="sec:level" flexDirection="column" borderStyle="round" borderColor="inactive" borderDimColor paddingX={1} gap={0.5}>
              <Box flexDirection="row" alignItems="center" gap={2}>
                <Text bold dimColor>{t().ui.levelTitle}</Text>
                <Text wrap="truncate">{levelSummary(v)}</Text>
                <Box flexGrow={1} />
                <Button key="fold:level" variant="secondary" onPress={pressed}>{p.open.level ? t().ui.close : t().ui.open}</Button>
              </Box>
              {p.open.level ? <Svg source={level} alt={t().ui.levelTitle} width={levelWidth} height={Math.round(detailHeight(level))} /> : null}
            </Box>
            <Box key="sec:wardrobe" flexDirection="column" borderStyle="round" borderColor="inactive" borderDimColor paddingX={1} gap={1}>
              <Box flexDirection="row" alignItems="center" gap={2}>
                <Text bold dimColor>{t().ui.wardrobeTitle}</Text>
                <Text wrap="truncate">{`${t().ui.unlockedOf(ok.length, ALL_ITEMS.length)} · ${t().ui.wearing(worn.length > 0 ? worn.join(', ') : t().ui.nothing)}`}</Text>
                <Box flexGrow={1} />
                {p.open.wardrobe ? <Button key="wear:auto" variant={isAuto ? 'primary' : 'secondary'} onPress={pressed}>{t().ui.auto}</Button> : null}
                {p.open.wardrobe ? <Button key="wear:none" variant="secondary" onPress={pressed}>{t().ui.takeAllOff}</Button> : null}
                <Button key="fold:wardrobe" variant="secondary" onPress={pressed}>{p.open.wardrobe ? t().ui.close : t().ui.open}</Button>
              </Box>
              {p.open.wardrobe ? SLOTS.map(slot => (
                <Box key={`slot:${slot}`} flexDirection="column" gap={0.5}>
                  <Text dimColor>{`${slotName(slot)} · ${dressed[slot] ? itemName(dressed[slot]) : t().ui.empty}${p.pick[slot] === undefined ? t().ui.autoMark : ''}`}</Text>
                  <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0.5}>
                    {SLOT_ITEMS[slot].map(cell)}
                  </Box>
                </Box>
              )) : null}
            </Box>
          </Box>
        </Box>
      )
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const p = await read($, prefs)
    const dressed = outfitNow(p, v, (await read($, face)).mood, now)
    const ok = wearable(v.history, now, v.tz)
    return (
      <Box flexDirection="column">
        {detailLines(v, now).map(line => <Text wrap="truncate">{line}</Text>)}
        <Box flexDirection="row" gap={1}>
          <Text bold>{levelSummary(v)}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text bold>{`${t().ui.wardrobe} · ${t().ui.unlockedOf(ok.length, ALL_ITEMS.length)}`}</Text>
          <Button key="fold:wardrobe" onPress={pressed}>{p.open.wardrobe ? t().ui.close : t().ui.open}</Button>
        </Box>
        {p.open.wardrobe ? SLOTS.map(slot => (
          <Box key={`slot:${slot}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Text dimColor>{`${slotName(slot)}:`}</Text>
            {SLOT_ITEMS[slot].filter(i => ok.includes(i)).map(item => (
              <Button key={`wear:${item}`} plain dimColor={dressed[slot] !== item} onPress={pressed}>{itemShort(item)}</Button>
            ))}
          </Box>
        )) : null}
        {p.open.wardrobe ? (
          <Box flexDirection="row" gap={1}>
            <Button key="wear:auto" onPress={pressed}>{t().ui.auto}</Button>
            <Button key="wear:none" onPress={pressed}>{t().ui.takeAllOff}</Button>
          </Box>
        ) : null}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    drawnOn = e.surface === 'terminal' ? 'terminal' : 'remote'
    const p = await read($, prefs)
    if (p.isHidden) return next(e)

    if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
      // The desktop rebuilds the whole band on every redraw, so this branch
      // reads the panel alone, which changes only when its drawing should; the
      // drawing resumes its animations mid-loop. An <img> (not interactive)
      // keeps the painted parts the interactive frame's scrub would strip.
      const { Box, Svg } = $.ui.resolve(e)
      const pane = await read($, panel)
      const now = await $.clock.now()
      const width = Math.round(Math.min(1600, Math.max(420, e.props.bodyColumns * 8.1 - 8)))
      const alt = `${pane.info.label}: ${pane.info.detail}`
      let drawn: ReturnType<typeof panelSvg>
      try {
        drawn = panelSvg({ panel: pane, now, width })
      } catch {
        // Never an empty band: the mascot alone if the panel cannot be drawn.
        return (
          <Box flexDirection="row" alignItems="center">
            <Svg source={svgFor(pane.shot, Math.max(0, now - pane.shot.at))} alt={alt} width={64} height={64} />
          </Box>
        )
      }
      // A clear region pulled back over the gauges: a click there opens the
      // detail pane. Columns are the band's own unit, about 8.1 pixels here;
      // 3.8 rows (lines) is the panel's height, so the band does not grow.
      const cardCols = Math.max(8, Math.round(drawn.card.w / 8.1))
      let hit: JSX.Element | null = null
      if (e.surface === 'desktop') {
        const { Client } = $.ui.resolve(e)
        hit = (
          <Box marginLeft={-cardCols} width={cardCols} height={3.8} flexShrink={0}>
            <Client key="hit" module="./hit.tsx" props={{ rows: 6 }} width="100%" height="100%" />
          </Box>
        )
      }
      return (
        <Box flexDirection="row" alignItems="stretch">
          <Svg source={drawn.svg} alt={alt} width={drawn.width} height={PANEL_H} />
          {hit}
        </Box>
      )
    }

    const f = await read($, face)
    const v = await read($, env)
    const look = LOOKS[f.mood]
    const elapsed = f.since > 0 ? (await read($, sec)) - Math.floor(f.since / 1000) : 0
    const status = elapsed >= 2 ? `${f.line} · ${duration(elapsed)}` : f.line
    const now = await $.clock.now()
    const full = forecasts(v, now).five_hour
    const others = peersLine(v.peers)
    const facts = [
      ...(v.context >= 0 ? [t().ctx.percent(v.context)] : []),
      ...(v.agents > 0 ? [t().st.agents(v.agents)] : []),
      ...(isBusy && v.turnTools > 0 ? [t().st.tools(v.turnTools)] : []),
      ...(full !== undefined ? [`${limitName('five_hour')} ${t().panel.fullAt(clockAt(full, now, v.tz))}`] : []),
      ...(others !== null ? [others] : []),
    ].join(' · ')
    const factsColor = v.context >= 80 ? 'warning' : undefined

    const { Box, Text } = $.ui.resolve(e)
    const n = await read($, frame)
    const room = Math.max(12, e.props.bodyColumns)

    if (p.isCompact || e.props.maxRows < 5) {
      const head = `${kaomoji(f.mood, n)} `
      const tail = facts === '' ? '' : `  ${facts}`
      return (
        <Box flexDirection="row" gap={1}>
          <Text wrap="truncate">
            <Text color={look.color}>{head}{cut(status, Math.max(8, room - width(head) - width(tail) - 12))}</Text>
            <Text dimColor color={factsColor}>{tail}</Text>
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="row" gap={1}>
        <Box flexDirection="column">
          {withHat(asciiRows(f.mood, n, n === f.frameAt), outfitNow(p, v, f.mood, now).head, LOOKS[f.mood].isShaking === true && n % 2 === 0).map(row => (
            <Text color={look.color} wrap="truncate">{row}</Text>
          ))}
        </Box>
        <Box flexDirection="column" flexShrink={1} justifyContent="center">
          <Text bold color={look.color} wrap="truncate">{cut(status, room - 12)}</Text>
          <Text dimColor color={factsColor} wrap="truncate">{facts === '' ? ' ' : facts}</Text>
        </Box>
      </Box>
    )
  })
}
