import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DayRec, Env, Face, Info, Item, Limit, MochiAnswer, MochiReaction, Mood, Outfit, Peer, Prefs, Recent, Scene, Slice } from '../types'
import { cheerOf, isKept, mayReact, reactionOf, signed } from './api'
import { exportOf, feedbackUrl, isCleared, isExported } from './data'
import type { Scope } from './data'
import { kaomoji, moodLabel } from './looks'
import { afterTool, beforeTool, isCommit, onPrompt, onTurnEnd, restLine, subject, waitsOnPerson } from './react'
import type { Reaction, SoundName } from './react'
import { addSample, ago, clockAt, contextWarning, dayKey, forecastFull, forecasts, lineCount, lineDelta, parseGit, parseNumstat, warnLevel, withLines } from './facts'
import { NEW_WATCH, danger, dangerKey, isShell, watchCall } from './guard'
import { DICTS, LANGS, pickLang, setLang, t } from './i18n'
import type { Dict, Lang } from './i18n'
import { EMPTY_DAY, SLOT, SLOTS, UNLOCKS, itemName, itemOf, itemShort, slotName, addDay, hintFor, levelOf, outfitNow, season, summarize, unlocked, wearable, xpOf } from './level'
import { peerLabel, peerNews, peerOf } from './live'
import { toolKind } from './panel'
import { band, detailPane } from './render'
import { paramsAt } from './rig'
import { clip } from './sound'
import { ALL_ITEMS, DEFAULT_PREFS, FIRST_SHOT, NO_ENV, NO_FACE, NO_INFO, NO_PANEL, chat, rest0, restorePrefs } from './state'
import { alertCommand, langCommand, removeCommand } from './system'
import type { Platform } from './system'

// Everything that acts through `$` lives in this file: the engine follows `$`
// only into functions declared beside the call, and reads the state a file
// uses from that file's own consts. What needs no `$` lives in the other
// modules, and the drawing hooks in render.tsx.

const face = atom({ plugin: 'mochi', key: 'face' } as const, NO_FACE)
const shot = atom({ plugin: 'mochi', key: 'shot' } as const, FIRST_SHOT)
const panel = atom({ plugin: 'mochi', key: 'panel' } as const, NO_PANEL)
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
/** While Mochi dozes, the timer does its rounds on one beat in this many. */
const DOZE_EVERY = 4
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

/** Turkish letters folded to ASCII, for matching what the person typed. */
const plain = (s: string) => s.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

type Dollar = EngineInterface

async function play($: Dollar, sound: SoundName | undefined) {
  if (sound === undefined || !(await read($, prefs)).hasSound) return
  void $.audio.play({ base64: clip(sound), mime: 'audio/wav' }).catch(() => undefined)
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
    isBusy: chat.isBusy,
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

/**
 * Redraws the desktop panel when the pose changed, or when its figures did and
 * the last redraw is old enough; a minute's turn redraws the reset countdowns.
 */
async function drawPanel($: Dollar) {
  if (chat.drawnOn !== 'remote') return
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
    if (at === null || chat.warnedLimits.includes(key)) continue
    const isSoon = l.kind === 'five_hour' ? at - now <= 45 * 60_000 : at - now <= 24 * 60 * 60_000
    if (!isSoon) continue
    chat.warnedLimits = [...chat.warnedLimits, key]
    const name = t().limit.long[l.kind] ?? l.kind
    const line = t().limit.pace(name, clockAt(at, now, v.tz), clockAt(l.resetsAt, now, v.tz))
    if (chat.isBusy) chat.pendingLimit = line
    else await show($, { mood: 'nervous', line, holdMs: 10_000, sound: 'alarm' })
    $.ui.toast(`Mochi: ${line}`, { timeoutMs: 8000 })
  }
}

async function refreshStatus($: Dollar) {
  const text = await statusText($)
  if (text === chat.lastStatus) return
  chat.lastStatus = text
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
  chat.faceToken += 1
  const token = chat.faceToken
  await putFace($, { mood: r.mood, line: r.line, until: r.holdMs > 0 ? now + r.holdMs : 0, since })
  await play($, r.sound)
  return token
}

async function rest($: Dollar) {
  chat.faceToken += 1
  await putFace($, chat.isBusy ? { mood: 'thinking', line: t().st.thinking, until: 0, since: 0 } : rest0())
}

/** The model's stream: thinking or writing its answer. Writes only on a change. */
async function noteStream($: Dollar, kind: 'thinking' | 'talking') {
  if (chat.stream === kind) return
  chat.stream = kind
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
    chat.faceToken += 1
    await putFace($, { mood: 'listening', line: t().st.listening, until: 0, since: 0 })
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
  if (level < chat.warned) {
    chat.warned = level
    chat.pendingWarn = 0
    return
  }
  if (level <= chat.warned) return
  chat.warned = level
  if (chat.isBusy) {
    chat.pendingWarn = level
    return
  }
  await show($, { mood: level >= 3 ? 'scared' : 'nervous', line: contextWarning(v, level), holdMs: 10_000, sound: 'alarm' })
}

/** Reads the repository: branch, ahead and behind, changed paths, the last commit. */
async function refreshGit($: Dollar) {
  chat.gitAt = await $.clock.now()
  chat.isGitWanted = false
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
  // A new file not yet added counts as all added: its lines, for the first twenty (none for one that cannot be read).
  const fresh = root === '' ? [] : base.files.filter(f => f.code === '??' && !f.path.endsWith('/')).slice(0, 20)
  const counts: Record<string, number> = {}
  for (const f of fresh) {
    const text = await $.fs.read(`${root}/${f.path}`).catch(() => null)
    if (text !== null) counts[f.path] = lineCount(text)
  }
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

/**
 * A system notification (and a toast) about this chat: a long turn ended, or it
 * waits on the person. macOS, Windows and Linux each show it their own way.
 */
async function notify($: Dollar, text: string) {
  if (!(await read($, prefs)).hasAlert) return
  $.ui.toast(`Mochi: ${text}`, { timeoutMs: 8000 })
  const alert = alertCommand(chat.platform, 'Mochi', chat.label, text)
  void $.process.run(alert.argv, { env: alert.env, timeoutMs: 10_000 }).catch(() => undefined)
}

/** Where this chat stands, for the other chats: working, asking, idle or failed. */
async function liveNow($: Dollar): Promise<Omit<Peer, 'at'>> {
  const f = await read($, face)
  // Waiting on the person is the asking face held open; a nudge or another chat's news holds it only a while.
  const isAsking = f.mood === 'asking' && f.until === 0
  const state: Peer['state'] = isAsking ? 'asking' : chat.isBusy ? 'busy' : chat.lastTurnFailed ? 'error' : 'idle'
  return { id: chat.sessionId, label: chat.label || t().word.chat, state, line: f.line, since: state === 'busy' ? chat.turn.startedAt : 0 }
}

/** Writes this chat's file when where it stands changed (at most every 1.5 s), and every 15 s so the others know it is alive. */
async function writeLive($: Dollar, isForced = false) {
  if (chat.dataDir === '' || chat.sessionId === '') return
  const now = await $.clock.now()
  const live = await liveNow($)
  const key = JSON.stringify(live)
  if (!isForced && (key === chat.liveKey ? now - chat.liveAt < LIVE_EVERY_MS : now - chat.liveAt < 1500)) return
  chat.liveKey = key
  chat.liveAt = now
  await $.fs.write(`${chat.dataDir}/live/${chat.sessionId}.json`, JSON.stringify({ ...live, at: now })).catch(() => undefined)
}

/** Reads the other chats' files that changed, and says what is worth saying about them. */
async function readPeers($: Dollar) {
  if (chat.dataDir === '') return
  const now = await $.clock.now()
  chat.peersAt = now
  const seen: Record<string, number> = {}
  for (const entry of await $.fs.list(`${chat.dataDir}/live`).catch(() => [])) {
    const path = `${chat.dataDir}/live/${entry.name}`
    if (!entry.name.endsWith('.json') || entry.name === `${chat.sessionId}.json` || now - entry.mtimeMs > 60_000) continue
    seen[path] = entry.mtimeMs
    if (chat.peerMtimes[path] === entry.mtimeMs && chat.peerCache[path]) continue
    const text = await $.fs.read(path).catch(() => '')
    try {
      const peer = peerOf(JSON.parse(text), now)
      if (peer) chat.peerCache[path] = peer
    } catch {
      // A file caught mid-write: read it next time.
    }
  }
  chat.peerMtimes = seen
  for (const path of Object.keys(chat.peerCache)) if (seen[path] === undefined) delete chat.peerCache[path]
  const peers = Object.values(chat.peerCache).filter(p => now - p.at <= 45_000).sort((a, b) => a.label.localeCompare(b.label))
  const before = (await read($, env)).peers
  if (JSON.stringify(before) === JSON.stringify(peers)) return
  await setEnv($, v => ({ ...v, peers }))
  const news = peerNews(before, peers, now)
  const first = news[0]
  if (first === undefined) return
  for (const n of news) $.ui.toast(`Mochi: ${n.line}`, { timeoutMs: 6000 })
  const f = await read($, face)
  if (!chat.isBusy && f.until === 0 && (f.mood === 'idle' || f.mood === 'sleepy' || f.mood === 'sleeping')) {
    await show($, { mood: first.kind === 'asking' ? 'asking' : first.kind === 'failed' ? 'nervous' : 'pleased', line: first.line, holdMs: 5000 })
  }
}

/** Every chat's days, read file by file, with this chat's own from memory. */
async function refreshHistory($: Dollar) {
  if (chat.dataDir === '') return
  chat.historyAt = await $.clock.now()
  const dir = `${chat.dataDir}/days`
  const others: Record<string, DayRec>[] = []
  for (const entry of await $.fs.list(dir).catch(() => [])) {
    if (!entry.name.endsWith('.json')) continue
    try {
      const file = JSON.parse(await $.fs.read(`${dir}/${entry.name}`)) as { id?: unknown; days?: unknown }
      if (typeof file.id !== 'string' || file.id === chat.sessionId || typeof file.days !== 'object' || file.days === null) continue
      others.push(file.days as Record<string, DayRec>)
    } catch {
      // A file caught mid-write counts next time.
    }
  }
  chat.otherDays = others
  await recount($)
}

/** The history from the other chats as last read and this one as it stands; a new level is celebrated. */
async function recount($: Dollar) {
  const now = await $.clock.now()
  const v = await read($, env)
  const history = summarize([...chat.otherDays, chat.myDays], dayKey(now, v.tz))
  await setEnv($, x => ({ ...x, history }))
  await checkLevel($)
}

async function saveDays($: Dollar) {
  if (chat.dataDir === '' || chat.sessionId === '') return
  await $.fs.write(`${chat.dataDir}/days/${chat.sessionId}.json`, `${JSON.stringify({ id: chat.sessionId, label: chat.label, days: chat.myDays })}\n`).then(() => { chat.isDaysSaved = true }, () => undefined)
}

async function addToday($: Dollar, rec: Partial<DayRec>) {
  await forgetIfReset($)
  const now = await $.clock.now()
  const key = dayKey(now, (await read($, env)).tz)
  chat.myDays = { ...chat.myDays, [key]: addDay(chat.myDays[key] ?? EMPTY_DAY, rec) }
}

/** A level or item earned since the last look is celebrated once, in whichever chat sees it first. */
async function checkLevel($: Dollar) {
  if (chat.dataDir === '') return
  const h = (await read($, env)).history
  if (h === null) return
  const level = levelOf(xpOf(h)).level
  const items = unlocked(h)
  const path = `${chat.dataDir}/level.json`
  let saved: { level?: number; items?: unknown } | null = null
  try {
    saved = JSON.parse(await $.fs.read(path)) as { level?: number; items?: unknown }
  } catch {
    saved = null
  }
  // An older version saved the items under their Turkish ids.
  const had = Array.isArray(saved?.items) ? saved.items.map(itemOf) : []
  const fresh = items.filter(i => !had.includes(i))
  if (saved !== null && (saved.level ?? 1) >= level && fresh.length === 0) return
  await $.fs.write(path, JSON.stringify({ level, items })).catch(() => undefined)
  if (saved === null) return
  const parts = [...((saved.level ?? 1) < level ? [t().st.level(level)] : []), ...(fresh.length > 0 ? [t().st.newItems(fresh.map(itemName).join(', '))] : [])]
  await show($, { mood: 'party', line: parts.join(' · '), holdMs: 8000, sound: 'party' })
  $.ui.toast(`Mochi: ${parts.join(' · ')}${fresh.length > 0 ? t().note.seeWardrobe : ''}`, { timeoutMs: 8000 })
}

/** The usage readings are the account's, so every chat shares one file of them. */
async function saveSamples($: Dollar) {
  if (chat.dataDir === '') return
  chat.samplesAt = await $.clock.now()
  const path = `${chat.dataDir}/usage.json`
  let theirs: Env['samples'] = []
  try {
    const parsed = JSON.parse(await $.fs.read(path)) as unknown
    if (Array.isArray(parsed)) theirs = parsed.filter((x): x is Env['samples'][number] => typeof x === 'object' && x !== null && typeof (x as { at?: unknown }).at === 'number')
  } catch {
    theirs = []
  }
  const now = chat.samplesAt
  const v = await update($, env, x => {
    const all = [...theirs, ...x.samples].filter(s => now - s.at < 48 * 60 * 60_000).sort((a, b) => a.at - b.at)
    const merged = all.filter((s, i) => i === 0 || s.at !== all[i - 1]?.at || s.kind !== all[i - 1]?.kind).slice(-400)
    return { ...x, samples: merged }
  })
  await $.fs.write(path, JSON.stringify(v.samples)).catch(() => undefined)
}

// ---------- the language ----------

/**
 * The language to speak when none is chosen: Claude Code's own `language`
 * setting, then the system's (macOS's preferred languages, Windows's display
 * language), then `LANG`; English when none of them is one Mochi speaks.
 */
async function detectLang($: Dollar): Promise<Lang> {
  const settings = await $.settings.read().catch(() => undefined)
  const fromSettings = pickLang(typeof settings?.language === 'string' ? settings.language : undefined)
  if (fromSettings) return fromSettings
  const ask = langCommand(chat.platform)
  const sys = ask === null ? undefined : await $.process.run(ask, { timeoutMs: 5000 }).catch(() => undefined)
  if (sys?.exitCode === 0) {
    for (const code of sys.stdout.match(/[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*/g) ?? []) {
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
  if (chat.autoLang === null) chat.autoLang = await detectLang($)
  setLang(chat.autoLang)
  return chat.autoLang
}

/** Which system this is: Windows says so in its environment, macOS through `uname`. */
async function findPlatform($: Dollar): Promise<Platform> {
  if ((await $.env.get('OS').catch(() => undefined)) === 'Windows_NT') return 'windows'
  const uname = await $.process.run(['uname', '-s'], { timeoutMs: 3000 }).catch(() => undefined)
  return uname?.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
}

/** Finds the shared folder, the clock's zone and this chat's name, and picks up where a resumed chat left off. */
async function startShared($: Dollar) {
  // Claude Code's own home: USERPROFILE on Windows, where a Unix shell may set HOME elsewhere.
  const home = chat.platform === 'windows' ? await $.env.get('USERPROFILE').catch(() => undefined) : await $.env.get('HOME').catch(() => undefined)
  chat.sessionId = await $.session.id().catch(() => '')
  chat.dataDir = home ? `${home}/.claude/mochi` : ''
  // The module's own Date keeps the machine's time zone.
  const tz = -new Date(await $.clock.now()).getTimezoneOffset()
  await update($, env, v => ({ ...v, tz }))
  chat.label = peerLabel(await $.session.root().catch(() => ''), '')
  chat.isLabelFromPrompt = chat.label === ''
  if (chat.isLabelFromPrompt) void firstPromptLabel($).catch(() => undefined)
  if (chat.dataDir === '' || chat.sessionId === '') return
  chat.myDays = {}
  try {
    const file = JSON.parse(await $.fs.read(`${chat.dataDir}/days/${chat.sessionId}.json`)) as { days?: Record<string, DayRec> }
    if (file.days) chat.myDays = file.days
    chat.isDaysSaved = true
  } catch {
    // A new chat has no file yet.
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
  if (first && chat.label === '') chat.label = peerLabel('', first.text)
}

/** Files of chats closed long ago (or that never said goodbye) are removed. */
async function cleanLive($: Dollar) {
  const now = await $.clock.now()
  const list = await $.fs.list(`${chat.dataDir}/live`).catch(() => [])
  await removeLive($, list.filter(f => f.name.endsWith('.json') && now - f.mtimeMs > 10 * 60_000).map(f => f.name))
}

/** Deletes chats' files from `live/` by name, with the system's own command ($.fs deletes nothing). */
async function removeLive($: Dollar, names: string[]) {
  const argv = removeCommand(chat.platform, names)
  if (argv !== null) await $.process.run(argv, { cwd: `${chat.dataDir}/live`, timeoutMs: 5000 }).catch(() => undefined)
}

async function openDetail($: Dollar) {
  await update($, detail, () => ({ ...NO_ENV, ...(chat.lastEnv ?? NO_ENV) }))
  chat.detailAt = await $.clock.now()
  const opened = await $.ui.open({ id: DETAIL, title: t().detail.title })
  if (!opened.isPlaced) $.ui.toast(t().note.detailFailed(opened.reason))
}

async function setPrefs($: Dollar, change: (p: Prefs) => Prefs) {
  const next = await update($, prefs, change)
  await $.store.set('prefs', next)
  await refreshStatus($)
  // Shown, the drawing catches up with what the timer left alone while hidden.
  if (!next.isHidden) {
    await sync($)
    await drawPanel($)
  }
  return next
}

async function tick($: Dollar) {
  const now = await $.clock.now()
  const p = await read($, prefs)
  const f = await read($, face)
  chat.beat += 1
  // Dozing, Mochi makes its rounds on fewer beats, its frame turning slower.
  const isDozing = !chat.isBusy && f.until === 0 && (f.mood === 'sleepy' || f.mood === 'sleeping')
  if (isDozing && chat.beat % DOZE_EVERY !== 0) return
  const s = Math.floor(now / 1000)
  if (f.since > 0 && (await read($, sec)) !== s) await update($, sec, () => s)
  // Hidden, the drawing waits until shown again; the face's timing runs on, for the status line.
  if (!p.isHidden) {
    await update($, frame, n => (n + 1) % 840)
    await sync($)
    await drawPanel($)
  }
  await refreshStatus($)
  const v = await read($, env)
  chat.lastEnv = v
  if ((chat.isGitWanted && now - chat.gitAt > 4000) || now - chat.gitAt > GIT_EVERY_MS) void refreshGit($).catch(() => undefined)
  void writeLive($).catch(() => undefined)
  if (now - chat.peersAt > PEERS_EVERY_MS) void readPeers($).catch(() => undefined)
  if (now - chat.historyAt > HISTORY_EVERY_MS) void refreshHistory($).catch(() => undefined)
  if (now - chat.samplesAt > SAMPLES_EVERY_MS) void saveSamples($).catch(() => undefined)
  if (now - chat.detailAt > 3000) {
    chat.detailAt = now
    const d = await read($, detail)
    if (JSON.stringify(d) !== JSON.stringify(v)) await update($, detail, () => v)
  }
  const git = v.git
  if (!chat.isBusy && git && git.changed > 0 && f.until === 0 && (f.mood === 'idle' || f.mood === 'sleepy') && now - chat.lastNudge > NUDGE_EVERY_MS
    && (git.lastCommit === 0 || now - git.lastCommit > COMMIT_STALE_MS) && now - chat.lastActivity > 20_000) {
    chat.lastNudge = now
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
  if (f.mood === 'listening' && now - chat.lastTypedAt > LISTEN_FOR) {
    await rest($)
    return
  }
  if (chat.isBusy) return
  const quiet = now - chat.lastActivity
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

async function wake($: Dollar): Promise<boolean> {
  const now = await $.clock.now()
  const quiet = now - chat.lastActivity
  chat.lastActivity = now
  const mood = (await read($, face)).mood
  return quiet > SLEEPY_AFTER || mood === 'sleeping' || mood === 'sleepy'
}

// ---------- the shield ----------

/**
 * A command that cannot be undone (`what` it would do) waits for the person's
 * word: what to tell the model when they stop it; null when it may run.
 */
async function shield($: Dollar, args: Record<string, unknown> & { tool: string }, cmd: string, what: string, startedAt: number): Promise<{ deny: string } | null> {
  if (!(await read($, prefs)).hasShield || (await $.session.surfaces()).length === 0) return null
  const line = `${t().st.awaitingApproval} · ${what}`
  await show($, { mood: 'scared', line, holdMs: 0, sound: 'alarm' })
  if (chat.isBusy && startedAt - chat.turn.startedAt >= ASKS_AFTER_MS) await notify($, line)
  const shown = cmd.length > 300 ? `${cmd.slice(0, 299)}…` : cmd
  const d = t().shield
  const answer = await $.ui.ask(d.question(what, shown), { header: 'Mochi', options: [d.run, d.stop] }).catch(() => d.stop)
  if (answer !== d.run) {
    await show($, { mood: 'denied', line: `${t().st.halted} · ${what}`, holdMs: 5000 })
    const key = dangerKey(cmd)
    // Said to the model, so always in English.
    return { deny: `The user stopped this command at Mochi's prompt (it ${key ? DICTS.en.danger[key] : 'cannot be undone'}). Do not retry it; ask the user how to proceed if it is needed.` }
  }
  await show($, { mood: 'nervous', line: `${t().st.approved} · ${subject(args)}`, holdMs: 0 }, startedAt)
  return null
}

// ---------- /mochi ----------

type Word = keyof Dict['cmd']['words'] | keyof Dict['data']['words']

/** Whether `value` names the command: its English words, or the words of the language in use. */
const names = (value: string, key: Word, ...english: string[]) => english.includes(value) || { ...t().cmd.words, ...t().data.words }[key].some(w => plain(w) === value)

/** A subcommand: the key of its words in each language, the English words it answers to, and what it does with the rest of the line. */
type Command = { name: Word; english: string[]; run: (arg: string) => Promise<string> }

/** The subcommands of /mochi, tried in this order. */
function commands($: Dollar, p: Prefs): Command[] {
  return [
    { name: 'small', english: ['small', 'compact'], run: () => resize($, true) },
    { name: 'big', english: ['big', 'full'], run: () => resize($, false) },
    { name: 'details', english: ['details', 'detail'], run: () => details($) },
    { name: 'shield', english: ['shield'], run: () => toggleShield($) },
    { name: 'alerts', english: ['alerts', 'alert', 'notifications'], run: () => toggleAlerts($) },
    { name: 'lang', english: ['lang', 'language'], run: arg => language($, arg) },
    { name: 'level', english: ['level', 'xp'], run: () => levelNow($) },
    { name: 'wear', english: ['wear', 'outfit', 'accessory', 'accessories'], run: arg => wear($, arg, p) },
    { name: 'sound', english: ['sound'], run: () => toggleSound($) },
    { name: 'hide', english: ['hide'], run: () => setHidden($, true) },
    { name: 'show', english: ['show'], run: () => setHidden($, false) },
    { name: 'export', english: ['export'], run: () => exportAll($) },
    { name: 'reset', english: ['reset'], run: arg => reset($, arg) },
    { name: 'feedback', english: ['feedback', 'bug'], run: () => feedback($) },
    { name: 'plugins', english: ['plugins'], run: () => togglePlugins($) },
  ]
}

async function resize($: Dollar, isCompact: boolean): Promise<string> {
  await setPrefs($, v => ({ ...v, isCompact, isHidden: false }))
  return isCompact ? t().cmd.small : t().cmd.big
}

async function details($: Dollar): Promise<string> {
  await openDetail($)
  return t().cmd.detailOpened
}

async function toggleShield($: Dollar): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasShield: !v.hasShield }))
  return next.hasShield ? t().cmd.shieldOn : t().cmd.shieldOff
}

async function toggleAlerts($: Dollar): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasAlert: !v.hasAlert }))
  return next.hasAlert ? t().cmd.alertsOn(LONG_TURN_S / 60) : t().cmd.alertsOff
}

async function language($: Dollar, arg: string): Promise<string> {
  const d = t().cmd
  const list = LANGS.map(l => `${l} (${DICTS[l].name})`).join(', ')
  if (arg === '') return d.langNow(t().name, list)
  if (names(arg, 'auto', 'auto')) {
    chat.autoLang = null
    const next = await setPrefs($, v => ({ ...v, lang: 'auto' }))
    await applyLang($, next)
    await rest($)
    return t().cmd.langAuto(t().name)
  }
  const chosen = pickLang(arg)
  if (chosen === null) return d.langUnknown(arg, list)
  const next = await setPrefs($, v => ({ ...v, lang: chosen }))
  await applyLang($, next)
  await rest($)
  return t().cmd.langSet(t().name)
}

async function levelNow($: Dollar): Promise<string> {
  const d = t().cmd
  const h = (await read($, env)).history
  const xp = xpOf(h)
  const l = levelOf(xp)
  const total = h?.total ?? EMPTY_DAY
  const open = unlocked(h)
  return [
    d.levelLine(l.level, xp, l.next - xp),
    d.statsLine(total.turns, total.edits, total.commits, h?.activeDays ?? 0, h?.streak ?? 0),
    d.unlocked(open.map(itemName).join(', ') || d.noneYet),
    d.locked(UNLOCKS.filter(u => !open.includes(u.item)).map(u => `${itemName(u.item)} (${hintFor(u.item)})`).join(', ') || d.none),
  ].join('\n')
}

async function wear($: Dollar, arg: string, p: Prefs): Promise<string> {
  const d = t().cmd
  const v = await read($, env)
  const now = await $.clock.now()
  const ok = wearable(v.history, now, v.tz)
  if (arg === '') {
    const worn = outfitNow(p, v, (await read($, face)).mood, now)
    return [
      ...SLOTS.map(slot => `${slotName(slot)}: ${worn[slot] ? itemName(worn[slot]) : t().ui.empty}${p.pick[slot] === undefined ? t().ui.autoMark : ''}`),
      d.wearList(ok.length, ALL_ITEMS.length, ok.map(itemShort).join(', ')),
      d.wearHow,
    ].join('\n')
  }
  if (names(arg, 'auto', 'auto')) {
    await setPrefs($, x => ({ ...x, pick: {} }))
    await sync($)
    return d.wearAuto
  }
  if (names(arg, 'none', 'none', 'off')) {
    await setPrefs($, x => ({ ...x, pick: { head: null, face: null, neck: null, held: null, ground: null } }))
    await sync($)
    return d.wearNone
  }
  // An item by its id (an older version's too), or its name in the language in use or in English.
  const byId = itemOf(arg)
  const item = ALL_ITEMS.find(i => i === byId || [itemName(i), itemShort(i), DICTS.en.item.name[i], DICTS.en.item.short[i]].some(n => plain(n) === arg || plain(n).startsWith(arg)))
  if (item === undefined) return d.noSuchItem(arg)
  if (!ok.includes(item)) return d.itemLocked(itemName(item), hintFor(item))
  await setPrefs($, x => ({ ...x, pick: { ...x.pick, [SLOT[item]]: item } }))
  await sync($)
  return d.itemOn(itemName(item))
}

async function toggleSound($: Dollar): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasSound: !v.hasSound }))
  if (next.hasSound) await play($, 'ding')
  return next.hasSound ? t().cmd.soundOn : t().cmd.soundOff
}

async function setHidden($: Dollar, isHidden: boolean): Promise<string> {
  await setPrefs($, v => ({ ...v, isHidden }))
  return isHidden ? t().cmd.hidden : t().cmd.shown
}

/** What /mochi says to a word none of the subcommands knows: where Mochi stands. */
async function statusLines($: Dollar, p: Prefs): Promise<string> {
  const d = t().cmd
  const f = await read($, face)
  const v = await read($, env)
  return [
    d.statusLine(moodLabel(f.mood), f.line),
    d.contextLine(v.context >= 0 ? `${v.context}%` : t().panel.contextUnknown, v.agents, v.turnTools),
    d.prefsLine(p.hasSound, p.hasShield, p.hasAlert, p.isCompact),
    d.peersLine(levelOf(xpOf(v.history)).level, v.peers.length === 0 ? d.none : v.peers.map(x => x.label).join(', ')),
    d.commands,
  ].join('\n')
}

// ---------- ecosystem & data ----------

/** A reaction another plugin asked for through `$.mochi`: shown unless turned off, malformed, too soon, or over a face that matters. */
async function reactFor($: Dollar, r: Required<MochiReaction> | null, plugin: string, sound?: SoundName): Promise<MochiAnswer> {
  if (!(await read($, prefs)).hasPlugins) return { isShown: false, reason: 'off' }
  if (r === null) return { isShown: false, reason: 'invalid' }
  const now = await $.clock.now()
  if (!mayReact(chat.reactedAt[plugin], now)) return { isShown: false, reason: 'often' }
  if (isKept(await read($, face), now)) return { isShown: false, reason: 'busy' }
  chat.reactedAt[plugin] = now
  await show($, { mood: r.mood, line: signed(r.line, plugin), holdMs: r.holdMs, sound })
  return { isShown: true }
}

async function togglePlugins($: Dollar): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasPlugins: !v.hasPlugins }))
  return next.hasPlugins ? t().data.pluginsOn : t().data.pluginsOff
}

/** A history reset in any chat took this chat's file too: what this chat remembered goes with it. */
async function forgetIfReset($: Dollar) {
  if (!chat.isDaysSaved || (await $.fs.exists(`${chat.dataDir}/days/${chat.sessionId}.json`).catch(() => true))) return
  chat.myDays = {}
  chat.isDaysSaved = false
}

/** Mochi's version, from its manifest; '' when it cannot be read. */
async function mochiVersion($: Dollar): Promise<string> {
  try {
    const v = (JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: unknown }).version
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/** The files `takes` picks in Mochi's folder and the folders in it (links never followed), by folder. */
async function keptFiles($: Dollar, takes: (dir: string, name: string) => boolean): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const entry of await $.fs.list(chat.dataDir).catch(() => [])) {
    if (entry.kind === 'file' && takes('', entry.name)) out[''] = [...(out[''] ?? []), entry.name]
    if (entry.kind !== 'dir') continue
    const picked = (await $.fs.list(`${chat.dataDir}/${entry.name}`).catch(() => [])).filter(f => f.kind === 'file' && takes(entry.name, f.name)).map(f => f.name)
    if (picked.length > 0) out[entry.name] = picked
  }
  return out
}

/** Everything Mochi keeps, in one file beside it; the answer names where. */
async function exportAll($: Dollar): Promise<string> {
  const d = t().data
  if (chat.dataDir === '') return d.exportFailed('HOME')
  await saveDays($)
  await saveSamples($).catch(() => undefined)
  const store: Record<string, unknown> = {}
  for (const key of await $.store.keys()) store[key] = await $.store.get(key)
  const files: Record<string, string> = {}
  for (const [dir, list] of Object.entries(await keptFiles($, isExported))) {
    for (const name of list) {
      const path = dir === '' ? name : `${dir}/${name}`
      const text = await $.fs.read(`${chat.dataDir}/${path}`).catch(() => null)
      if (text !== null) files[path] = text
    }
  }
  const now = await $.clock.now()
  const name = `export-${dayKey(now, (await read($, env)).tz)}.json`
  try {
    await $.fs.write(`${chat.dataDir}/${name}`, `${JSON.stringify(exportOf(now, await mochiVersion($), store, files), null, 2)}\n`)
  } catch (err) {
    return d.exportFailed(err instanceof Error ? err.message : String(err))
  }
  return d.exported(`~/.claude/mochi/${name}`)
}

/** Clears what the person names once they say yes: files through the system's own delete, inside Mochi's folder alone. */
async function reset($: Dollar, arg: string): Promise<string> {
  const d = t().data
  const scope: Scope | null = names(arg, 'level', 'level') ? 'level' : names(arg, 'history', 'history') ? 'history' : names(arg, 'all', 'all', 'everything') ? 'all' : null
  if (scope === null) return d.resetHow
  const answer = await $.ui.ask(d.resetAsk[scope], { header: 'Mochi', options: [d.clear, d.keep] }).catch(() => d.keep)
  if (answer !== d.clear) return d.kept
  const takes = (dir: string, name: string) => isCleared(scope, dir, name)
  for (const [dir, list] of Object.entries(chat.dataDir === '' ? {} : await keptFiles($, takes))) {
    // A hundred names at a time keeps the command line short enough for Windows.
    for (let i = 0; i < list.length; i += 100) {
      const argv = removeCommand(chat.platform, list.slice(i, i + 100))
      if (argv !== null) await $.process.run(argv, { cwd: dir === '' ? chat.dataDir : `${chat.dataDir}/${dir}`, timeoutMs: 10_000 }).catch(() => undefined)
    }
  }
  // The other chats rewrite their presence files at once: those are not counted.
  const left = chat.dataDir === '' ? [] : Object.values(await keptFiles($, (dir, name) => dir !== 'live' && takes(dir, name))).flat()
  if (scope === 'all') {
    await setPrefs($, () => restorePrefs(undefined))
    for (const key of await $.store.keys()) await $.store.delete(key)
    await update($, env, v => ({ ...v, samples: [] }))
    await applyLang($, await read($, prefs))
    await rest($)
  }
  if (scope !== 'level') {
    chat.myDays = {}
    chat.otherDays = []
    chat.isDaysSaved = false
    await recount($)
  }
  return left.length > 0 ? t().data.notCleared(left.join(', ')) : t().data.cleared[scope]
}

/** A link to a new bug report, its form filled with the versions, the system, the surface and the language alone. */
async function feedback($: Dollar): Promise<string> {
  const claude = await $.session.version().then(v => v.version, () => '')
  const surfaces = await $.session.surfaces().catch(() => [])
  return t().data.feedback(feedbackUrl({ mochi: await mochiVersion($), claude, platform: chat.platform, surface: surfaces[0] ?? '', lang: t().name }))
}

export const register: Register = on => {
  // `$.mochi` for the plugins that depend on Mochi (docs/API.md): the hooks
  // below answer each call; the noun's own methods answer only if they fail.
  on('engine.create', async ($, e, next) => ({ ...(await next(e)), mochi: { react: async () => ({ isShown: false }), celebrate: async () => ({ isShown: false }) } }))
  on('mochi.react', async ($, e, next) => ({ value: await reactFor($, reactionOf(e), next.origin.plugin) }))
  on('mochi.celebrate', async ($, e, next) => ({ value: await reactFor($, cheerOf(e), next.origin.plugin, 'party') }))

  on('session.start', async ($, e, next) => {
    // The system, then the language: everything after speaks it.
    chat.platform = await findPlatform($)
    const saved = (await $.store.get('prefs')) as (Partial<Prefs> & { wear?: unknown }) | undefined
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
    chat.lastActivity = await $.clock.now()
    await startShared($).catch(() => undefined)
    await measure($)
    chat.lastNudge = await $.clock.now()
    void refreshGit($).catch(() => undefined)
    await show($, { mood: 'wave', line: t().st.ready, holdMs: 3000 })
    if (p.isHidden) await refreshStatus($)
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const ran = await next(e)
    if (chat.isBusy) return ran
    chat.lastTypedAt = await $.clock.now()
    chat.lastActivity = chat.lastTypedAt
    await noteTyping($, ran.text.trim() === '')

    return ran
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    if (text.startsWith('/')) return next(e)
    if (chat.isLabelFromPrompt && chat.label === '') chat.label = peerLabel('', text)
    chat.lastTurnFailed = false
    const wasAsleep = await wake($)
    const now = await $.clock.now()
    chat.stream = null
    await show($, onPrompt(text, wasAsleep), now)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    chat.isBusy = true
    chat.stream = null
    chat.errorRun = 0
    chat.watch = NEW_WATCH
    chat.lastTurnFailed = false
    chat.turn = { startedAt: await $.clock.now(), tools: 0, edits: 0, errors: 0 }
    chat.costAtStart = (await read($, env)).cost
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
    chat.lastActivity = startedAt

    // The shield: a command that cannot be undone waits for the person's word.
    const cmd = isShell(e.tool) && typeof args.command === 'string' ? args.command : ''
    const what = cmd === '' ? null : danger(cmd)
    const stop = what === null ? null : await shield($, args, cmd, what, startedAt)
    if (stop !== null) return stop

    let token = -1
    if (isSub) {
      const f = await read($, face)
      if (f.mood === 'agent') await update($, face, v => ({ ...v, line: `${t().st.agent} · ${beforeTool(args).line}` }))
    } else if (what === null || !(await read($, prefs)).hasShield) {
      chat.stream = null
      token = await show($, beforeTool(args), waitsOnPerson(e.tool) ? 0 : startedAt)
      if (waitsOnPerson(e.tool) && chat.isBusy && startedAt - chat.turn.startedAt >= ASKS_AFTER_MS) await notify($, beforeTool(args).line)
    }
    if (isAgent) await setEnv($, v => ({ ...v, agents: v.agents + 1 }))
    chat.callId += 1
    const id = chat.callId
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
      if (isWrite || isShell(e.tool)) chat.isGitWanted = true
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
    const looked = watchCall(chat.watch, isSub ? { ...args, tool: `${e.agentId}:${e.tool}` } : args, isError, typeof ran.text === 'string' ? ran.text : '')
    chat.watch = looked.watch
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
    chat.errorRun = isError || isDenied ? chat.errorRun + 1 : 0
    chat.turn.tools += 1
    if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(e.tool) && !isError && !isDenied) chat.turn.edits += 1
    if (isError) chat.turn.errors += 1
    await update($, env, v => ({ ...v, turnTools: chat.turn.tools }))

    const outcome = {
      ...(isDenied ? { deny: ran.deny } : {}),
      ...(isError ? { isError: true as const } : {}),
      ...(typeof ran.text === 'string' ? { text: ran.text } : {}),
    }
    const now = await $.clock.now()
    const after = afterTool(args, outcome, chat.errorRun, (now - startedAt) / 1000)
    if (looked.alarm !== null) {
      // The loop's alarm stays on the face.
    } else if (after !== null) {
      await show($, after)
    } else if (token === chat.faceToken) {
      await update($, face, f => ({ ...f, until: now + AFTER_TOOL_MS }))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('classic.PermissionRequest', async ($, e, next) => {
    const input = typeof e.tool_input === 'object' && e.tool_input !== null ? (e.tool_input as Record<string, unknown>) : {}
    const line = `${t().st.awaitingApproval} · ${subject({ ...input, tool: e.tool_name })}`
    await show($, { mood: 'asking', line, holdMs: 0 })
    if (chat.isBusy && (await $.clock.now()) - chat.turn.startedAt >= ASKS_AFTER_MS) await notify($, line)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    chat.isBusy = false
    chat.stream = null
    const now = await $.clock.now()
    chat.lastActivity = now
    void measure($).catch(() => undefined)
    const ended = onTurnEnd({
      reason: e.reason,
      seconds: Math.round((now - chat.turn.startedAt) / 1000),
      tools: chat.turn.tools,
      edits: chat.turn.edits,
      errors: chat.turn.errors,
    })
    const spent = Math.max(0, (await read($, env)).cost - chat.costAtStart)
    const rec = { at: now, seconds: Math.round((now - chat.turn.startedAt) / 1000), tools: chat.turn.tools, edits: chat.turn.edits, errors: chat.turn.errors, cost: spent }
    // The panel's last turn is the line without its "done".
    const head = `${t().st.done} · `
    const last = ended.line.startsWith(head) ? ended.line.slice(head.length) : ended.line
    const after = await update($, env, v => ({ ...v, last, turns: [...v.turns, rec].slice(-40) }))
    chat.isGitWanted = true
    chat.lastTurnFailed = e.reason === 'error'
    if (chat.pendingWarn > 0) {
      const level = chat.pendingWarn
      chat.pendingWarn = 0
      await show($, { mood: level >= 3 ? 'scared' : 'nervous', line: contextWarning(after, level), holdMs: 12_000, sound: 'alarm' })
    } else if (chat.pendingLimit !== '') {
      await show($, { mood: 'nervous', line: chat.pendingLimit, holdMs: 10_000, sound: 'alarm' })
    } else {
      await show($, ended)
    }
    chat.pendingLimit = ''
    if (rec.seconds >= LONG_TURN_S && e.reason !== 'aborted') await notify($, ended.line)

    // The day's tally, for the history and the level.
    await addToday($, { turns: 1, tools: chat.turn.tools, edits: chat.turn.edits, errors: chat.turn.errors, cost: spent, secs: rec.seconds, night: season(now, after.tz).isNight ? 1 : 0 })
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
    if (chat.dataDir !== '' && chat.sessionId !== '') {
      await saveDays($)
      await removeLive($, [`${chat.sessionId}.json`])
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const now = await $.clock.now()
    await show($, { mood: 'squeezed', line: t().st.compacting, holdMs: 0 }, now)
    const done = await next(e)
    chat.warned = 0
    chat.pendingWarn = 0
    await show($, { mood: 'success', line: t().st.compacted, holdMs: 4000 })
    void measure($).catch(() => undefined)

    return done
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'mochi' }, async ($, e) => {
    const [first = '', ...more] = e.args.trim().split(/\s+/)
    const word = plain(first)
    const arg = plain(more.join(' '))
    const p = await read($, prefs)
    const list = commands($, p)
    // Alone, /mochi hides Mochi or brings it back; a word no subcommand knows shows the status.
    const command = word === '' ? list.find(c => c.name === (p.isHidden ? 'show' : 'hide')) : list.find(c => names(word, c.name, ...c.english))
    return { text: command ? await command.run(arg) : await statusLines($, p) }
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
      const item = itemOf(what)
      if (what === 'auto') await setPrefs($, p => ({ ...p, pick: {} }))
      else if (what === 'none') await setPrefs($, p => ({ ...p, pick: { head: null, face: null, neck: null, held: null, ground: null } }))
      else if (item !== null) await toggleItem($, item)
      await sync($)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: DETAIL }, detailPane)
  on('ui.render', { component: 'AbovePrompt' }, band)
}
