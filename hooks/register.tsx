import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Badge, Block, Ci, DayRec, Env, Face, FileDiff, Git, Info, Item, Limit, MochiAnswer, MochiReaction, Mood, Outfit, Peer, Prefs, Recent, Scene, Slice } from '../types'
import { cheerOf, isKept, mayReact, reactionOf, signed } from './api'
import { BADGES, TEAM_AT, badgeHint, badgeName, badgesOf, commandBadges, isEarly, langBit, provenBy, turnBadges } from './badges'
import { PR_FIELDS, RUN_FIELDS, ciLine, ciOf, ghTrouble, isPushing, prOf } from './ci'
import { exportOf, feedbackUrl, isCleared, isExported } from './data'
import type { Scope } from './data'
import { kaomoji, moodLabel } from './looks'
import { ULTRA, afterTool, beforeTool, duration, flowEnd, flowLine, isCommit, isTest, onPrompt, onTurnEnd, restLine, subject, waitsOnPerson } from './react'
import type { Reaction, SoundName } from './react'
import { boardLines, claimOf, isLinkedWorktree, isWaitLong, resetsPassed } from './chats'
import { MAX_SHOWN, TOUR_MOODS, countRules, freshTips, hasRule, isNewer, newsFor, newsLines, permKey, pickTip, projectKey, readLog, ruleAsWritten, rulesOf, settleRule, shownTip, stillPending, tipLines, turnTips, withRule } from './coach'
import type { TipId } from './coach'
import { detailHeight, detailSvg, relPath } from './detail'
import { addSample, keepSamples, age, ago, baseName, clockAt, contextWarning, dayKey, forecastFull, forecasts, freshDiff, lineCount, lineDelta, parseDiff, parseGit, parseNumstat, turnsLeft, warnLevel, withLines } from './facts'
import { BREAK_AFTER, birthdayName, dueGreeting, firstDayOf, greeting, isBreakDue, isLeet, parseBirthday, promptEgg, workFrom } from './fun'
import { NEW_WATCH, dangers, isShell, say, setRules, watchCall } from './guard'
import type { Danger } from './guard'
import { DICTS, LANGS, pickLang, setLang, t } from './i18n'
import type { Dict, Lang } from './i18n'
import { EMPTY_DAY, SLOT, SLOTS, UNLOCKS, itemName, itemOf, itemShort, slotName, addDay, hintFor, levelOf, outfitNow, season, summarize, unlocked, xpOf } from './level'
import { CREW_MAX, activityOf, appLink, appSessionOf, peerLabel, peerNews, peerOf } from './live'
import { floorOf, partyOf, spotAt } from './party'
import { PANEL_H, panelSvg, toolKind } from './panel'
import { band, detailPane } from './render'
import { addedFiles, allow, allowedOf, commitScan, diffAdds, editSecrets, gitAdds, isMild, leavesRepo, parseRules, repoKey, shellSecrets, shieldLines, weigh } from './shield'
import { paramsAt } from './rig'
import { SNAP_W, cardMarkdown, cardPath, cardSvg, framed, monthName, monthToOffer, periodTitle, wrappedOf, wrappedSvg } from './share'
import type { ChatDays } from './share'
import { clip } from './sound'
import { ALL_ITEMS, BLOCKS, DEFAULT_PREFS, FIRST_SHOT, NO_DIFF, NO_ENV, NO_FACE, NO_INFO, NO_PANEL, NO_SAID, SECTIONS, TABS, chat, reordered, rest0, restorePrefs, stepped } from './state'
import { alertCommands, langCodes, langCommand, openCommand, pngCommands, removeCommand } from './system'
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
const said = atom({ plugin: 'mochi', key: 'said' } as const, NO_SAID)
const diff = atom({ plugin: 'mochi', key: 'diff' } as const, NO_DIFF)
const party = atom({ plugin: 'mochi', key: 'party' } as const, { pick: '' })
const dirs = atom({ plugin: 'mochi', key: 'dirs' } as const, { open: [] as string[] })

const TICK_MS = 450
/** While Mochi dozes or is hidden, the timer does its rounds on one beat in this many, about every 2 seconds. */
const DOZE_EVERY = 5
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
/** How often Claude Code's files of running sessions are read again, for their names in the app. */
const APPS_EVERY_MS = 15_000
const LIVE_EVERY_MS = 15_000
const HISTORY_EVERY_MS = 10 * 60_000
const SAMPLES_EVERY_MS = 5 * 60_000

/** Moods that belong to a running tool, so a long run turns them into `waiting`. */
const TOOL_MOODS: ReadonlySet<Mood> = new Set(['reading', 'searching', 'writing', 'running', 'nervous', 'web', 'scared'])

/** Turkish letters folded to ASCII, for matching what the person typed. */
const plain = (s: string) => s.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

type Dollar = EngineInterface

/** Whether anyone can see this session: a plain `-p` run draws nowhere, so what is said once waits for one that does. */
async function isSeen($: Dollar): Promise<boolean> {
  return (await $.session.surfaces().catch(() => [])).length > 0
}

/** Whether a celebration may take the face: not over a question, a warning or a compaction; another party gives way. */
const mayCelebrate = (f: Face, now: number): boolean => f.mood === 'party' || !isKept(f, now)

/** A tool call as a permission question names it: the loop, the tool and what it acts on. */
const callKey = (agent: string | undefined, tool: string, about: string) => `${agent ?? ''}|${tool}|${about}`

async function play($: Dollar, sound: SoundName | undefined) {
  if (sound === undefined || !(await read($, prefs)).hasSound) return
  void $.audio.play({ base64: clip(sound), mime: 'audio/wav' }).catch(() => undefined)
}

/** Puts on an item, or takes it off when it is already on; the slot then stays empty. */
async function toggleItem($: Dollar, item: Item) {
  const now = await $.clock.now()
  const v = await read($, env)
  const p = await read($, prefs)
  if (!unlocked(v.history).includes(item)) return
  // As the wardrobe shows it: Mochi at rest, whatever the pose of the moment.
  const worn = outfitNow(p, v, 'idle', now)
  const slot = SLOT[item]
  await setPrefs($, x => ({ ...x, pick: { ...x.pick, [slot]: worn[slot] === item ? null : item } }))
  await sync($)
}

/**
 * What a press on one of the details pane's buttons does: a section folded
 * or opened, a setting turned, an item worn, or one of /mochi's actions run,
 * its answer kept for the pane to show.
 */
async function pressed($: Dollar, element: string, surface?: RenderSurface) {
  const fold = SECTIONS.find(s => `fold:${s}` === element)
  if (fold !== undefined) await setPrefs($, p => ({ ...p, open: { ...p.open, [fold]: !p.open[fold] } }))
  if (element.startsWith('shelf:')) {
    const shelf = SLOTS.find(slot => slot === element.slice(6))
    if (shelf !== undefined) await setPrefs($, p => ({ ...p, shelf }))
  }
  if (element.startsWith('set:')) await turn($, element.slice(4))
  if (element === 'shield:forget') $.ui.toast(`Mochi: ${await shieldNow($, 'reset')}`)
  if (element === 'size:big' || element === 'size:small') await resize($, element === 'size:small')
  if (element === 'visible') await setHidden($, !(await read($, prefs)).isHidden)
  if (element === 'bday:off') await birthday($, 'none')
  if (element.startsWith('do:')) await act($, element.slice(3))
  if (element.startsWith('diff:')) await pickDiff($, element.slice(5))
  if (element.startsWith('dir:')) await toggleDir($, element.slice(4))
  // The party: a Mochi pressed opens its chat in the desktop app; one the app cannot open (this chat, or one
  // in a terminal) shows its card under the floor, put away when pressed again.
  if (element.startsWith('crew:') && element !== 'crew:') {
    const id = element.slice(5)
    const link = id === chat.sessionId ? '' : appLink((await read($, env)).peers.find(p => p.id === id)?.app)
    if (link !== '') void $.process.run(openCommand(chat.platform, link), { timeoutMs: 10_000 }).catch(() => undefined)
    else await update($, party, v => ({ pick: id === 'close' || v.pick === id ? '' : id }))
  }
  // Arranging the pane: in and out, back to the default, a block moved a place or shown and hidden.
  if (element === 'arrange') await setPrefs($, p => ({ ...p, isArranging: !p.isArranging }))
  if (element === 'arrange:reset') await setPrefs($, p => ({ ...p, order: [...BLOCKS], hidden: [] }))
  const [verb, id, way] = element.split(':')
  const block = BLOCKS.find(b => b === id)
  if (block !== undefined && verb === 'move') await setPrefs($, p => ({ ...p, order: stepped(p.order, block, way === 'up' ? 'up' : 'down') }))
  const tab = TABS.find(x => `tab:${x}` === element)
  if (tab !== undefined) await setPrefs($, p => ({ ...p, tab }))
  if (block !== undefined && verb === 'hide') await hideBlock($, block)
  if (element === 'said:close') await update($, said, () => NO_SAID)
  if (element === 'said:open') await openIt($, (await read($, said)).open ?? '')
  if (element === 'said:copy') {
    const { copy } = await read($, said)
    if (copy !== '') await $.ui.copy({ text: copy, surface }).catch(() => undefined)
  }
  if (element.startsWith('wear:')) {
    const what = element.slice(5)
    const item = itemOf(what)
    if (what === 'auto') await setPrefs($, p => ({ ...p, pick: {} }))
    else if (what === 'none') await setPrefs($, p => ({ ...p, pick: { head: null, face: null, neck: null, held: null, ground: null } }))
    else if (item !== null) await toggleItem($, item)
    await sync($)
  }
}

async function hideBlock($: Dollar, block: Block) {
  await setPrefs($, p => ({ ...p, hidden: p.hidden.includes(block) ? p.hidden.filter(b => b !== block) : [...p.hidden, block] }))
}

/** What the arranging list (arrange.tsx) sends: the order its tab was dragged into, or a block to show or hide. */
async function arranged($: Dollar, data: unknown) {
  if (typeof data !== 'object' || data === null) return
  const { order, hide } = data as { order?: unknown; hide?: unknown }
  if (order !== undefined) await setPrefs($, p => ({ ...p, order: reordered(p.order, order) ?? p.order }))
  const block = BLOCKS.find(b => b === hide)
  if (block !== undefined) await hideBlock($, block)
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
  const left = turnsLeft(v)
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
    ...(left !== null ? { turnsLeft: left } : {}),
    tz: v.tz,
    peers: v.peers,
    ci: v.ci ?? null,
    pr: v.pr ?? null,
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
    const at = forecastFull(v.samples, l, now, v.tz)
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
  // Without the index lock, so Claude's own git add or commit never finds it taken; names as they are, not octal escapes.
  const status = await run(['git', '--no-optional-locks', '-c', 'core.quotePath=false', 'status', '--porcelain=v1', '-b', '-uall'])
  const log = status?.exitCode === 0 ? await run(['git', 'log', '-1', '--format=%ct']) : undefined
  const base = status?.exitCode === 0 ? parseGit(status.stdout, log?.exitCode === 0 ? log.stdout : '') : null
  if (base === null) {
    await setEnv($, v => (v.git === null ? v : { ...v, git: null }))
    return
  }
  const top = await run(['git', 'rev-parse', '--show-toplevel'])
  const root = top?.exitCode === 0 ? top.stdout.trim() : ''
  // Lines added and removed against the last commit, staged or not; before the first commit, what is staged.
  const numstat = await run(['git', '-c', 'core.quotePath=false', 'diff', ...(base.lastCommit > 0 ? ['HEAD'] : ['--cached']), '--numstat', '--no-renames'])
  // A new file not yet added counts as all added: its lines, for the first twenty (none for one that cannot be read).
  const fresh = root === '' ? [] : base.files.filter(f => f.code === '??' && !f.path.endsWith('/')).slice(0, 20)
  const counts: Record<string, number> = {}
  for (const f of fresh) {
    const text = await $.fs.read(`${root}/${f.path}`).catch(() => null)
    if (text !== null) counts[f.path] = lineCount(text)
  }
  const git = withLines(base, parseNumstat(numstat?.stdout ?? ''), counts, root)
  await setEnv($, v => (JSON.stringify(v.git) === JSON.stringify(git) ? v : { ...v, git }))
  // The file picked in Changes follows what it holds now, and is let go once it no longer differs.
  const picked = (await read($, diff)).path
  if (picked !== '') {
    const kept = await loadDiff($, git, picked)
    await update($, diff, d => (d.path !== picked || JSON.stringify(d) === JSON.stringify(kept) ? d : kept))
  }
}

/** A changed file's diff against the last commit (before the first, what is staged); a new file not yet added, all added. */
async function loadDiff($: Dollar, git: Git, path: string): Promise<FileDiff> {
  const f = git.files.find(x => x.path === path)
  if (f === undefined) return NO_DIFF
  const root = git.root ?? ''
  if (f.code === '??') return freshDiff(path, root === '' ? '' : await $.fs.read(`${root}/${path}`).catch(() => ''))
  const ran = await $.process.run(['git', ...(root === '' ? [] : ['-C', root]), '-c', 'core.quotePath=false', 'diff', '--no-color', '--no-ext-diff', git.lastCommit > 0 ? 'HEAD' : '--cached', '--', path], { timeoutMs: 5000 }).catch(() => undefined)
  return parseDiff(path, ran?.exitCode === 0 ? ran.stdout : '')
}

/**
 * A file pressed in Changes: its diff opened under its line, or put away when
 * it already shows there (the last edit too, until the next one).
 */
async function pickDiff($: Dollar, path: string) {
  const v = await read($, env)
  const git = v.git
  const shown = await read($, diff)
  const last = v.lastEdit
  const isLast = shown.path === '' && last !== null && shown.hidden !== last.at && relPath(git?.root ?? '', last.path) === path
  if (shown.path === path || isLast || git === null) {
    await update($, diff, () => (last === null ? NO_DIFF : { ...NO_DIFF, hidden: last.at }))
    return
  }
  const loaded = await loadDiff($, git, path)
  await update($, diff, () => loaded)
}

/** A folder pressed in Changes: its files listed under it, or folded back into its line. */
async function toggleDir($: Dollar, path: string) {
  await update($, dirs, d => ({ open: d.open.includes(path) ? d.open.filter(x => x !== path) : [...d.open, path] }))
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
  const alerts = alertCommands(chat.platform, 'Mochi', chat.label, text, { group: chat.sessionId, link: appLink(chat.apps[chat.sessionId]?.app) })
  void sendAlert($, alerts).catch(() => undefined)
}

/** The first of the notification's commands that runs; the ones after it are for a machine without it. */
async function sendAlert($: Dollar, alerts: ReturnType<typeof alertCommands>) {
  for (const alert of alerts) {
    const ran = await $.process.run(alert.argv, { env: alert.env, timeoutMs: 10_000 }).catch(() => null)
    if (ran?.exitCode === 0) return
  }
}

/** Where this chat stands, for the other chats: working, asking, idle or failed. */
async function liveNow($: Dollar): Promise<Omit<Peer, 'at'>> {
  const f = await read($, face)
  // Waiting on the person is the asking face held open, or the shield's question; a nudge or another chat's news holds it only a while.
  const isAsking = (f.mood === 'asking' && f.until === 0) || chat.isAsking
  const state: Peer['state'] = isAsking ? 'asking' : chat.isBusy ? 'busy' : chat.lastTurnFailed ? 'error' : 'idle'
  if (state !== chat.state) {
    chat.state = state
    chat.stateAt = await $.clock.now()
  }
  const now = await $.clock.now()
  // A subagent silent this long, with no call of its own open and no question waiting, was stopped: as for the helpers (flowTick).
  if (chat.flow.calls === 0 && chat.perm === null && !chat.isAsking) for (const [id, c] of chat.crew) if (now - c.at > FLOW_STALE_MS) chat.crew.delete(id)
  const v = await read($, env)
  const used = v.limits.find(l => l.percent >= 100)
  const app = chat.apps[chat.sessionId]
  return {
    id: chat.sessionId, label: chat.label || t().word.chat, title: chat.title || app?.name || '', state, line: f.line, since: state === 'busy' ? chat.turn.startedAt : 0,
    folder: chat.folder, branch: v.git?.branch ?? '', isWorktree: chat.isWorktree, stateAt: chat.stateAt,
    v: 2,
    activity: state === 'busy' ? activityOf(f.mood) : '',
    // Claude Code's permission question or the shield's own; else the tool on the face that waits on the person.
    waitingFor: state !== 'asking' ? '' : chat.perm !== null || chat.isAsking ? 'permission' : chat.waitTool === 'AskUserQuestion' ? 'question' : chat.waitTool === 'ExitPlanMode' ? 'plan' : '',
    lastTurn: chat.lastTurn,
    agents: [...chat.crew.values()].sort((a, b) => a.since - b.since).slice(0, CREW_MAX).map(({ id, type, task, activity, since }) => ({ id, type, task, activity, since })),
    // In steps, so that a token or a cent more does not rewrite the file.
    context: v.context < 0 ? -1 : Math.round(v.context / 5) * 5,
    cost: Math.round(v.cost * 100) / 100,
    limit: used === undefined ? null : { kind: used.kind, resetsAt: used.resetsAt },
    app: app?.app ?? '',
  }
}

/**
 * Claude Code's own files of the sessions running now: each one's name in the
 * app (what its list of chats shows) and its session in the desktop app, which
 * a link opens. A file it may change or drop: one that reads as nothing is left out.
 */
async function readApps($: Dollar) {
  if (chat.dataDir === '') return
  chat.appsAt = await $.clock.now()
  const dir = chat.dataDir.replace(/\/mochi$/, '/sessions')
  const apps: Record<string, { name: string; app: string }> = {}
  for (const entry of await $.fs.list(dir).catch(() => [])) {
    if (!entry.name.endsWith('.json')) continue
    try {
      const s = appSessionOf(JSON.parse(await $.fs.read(`${dir}/${entry.name}`)))
      if (s) apps[s.id] = { name: s.name, app: s.app }
    } catch {
      // Caught mid-write, or not one: read it next time.
    }
  }
  chat.apps = apps
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
  // A chat's name in the app and its desktop session, from Claude Code's files, where its own file (an older Mochi's) leaves them out.
  const peers = Object.values(chat.peerCache).filter(p => now - p.at <= 45_000).sort((a, b) => a.label.localeCompare(b.label))
    .map(p => (chat.apps[p.id] === undefined ? p : { ...p, title: p.title || chat.apps[p.id]?.name || '', app: p.app || chat.apps[p.id]?.app || '' }))
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
  const list = await $.fs.list(dir).catch(() => null)
  const names = (list ?? []).map(f => f.name).filter(n => n.endsWith('.json'))
  if (list !== null) {
    // This chat's file counted before and gone now: a history reset in some chat took its days too.
    const own = `${chat.sessionId}.json`
    if (chat.counted.includes(own) && !names.includes(own)) chat.myDays = {}
    chat.counted = names
  }
  const others: Record<string, DayRec>[] = []
  for (const name of names) {
    try {
      const file = JSON.parse(await $.fs.read(`${dir}/${name}`)) as { id?: unknown; days?: unknown }
      if (typeof file.id !== 'string' || file.id === chat.sessionId || typeof file.days !== 'object' || file.days === null) continue
      others.push(file.days as Record<string, DayRec>)
    } catch {
      // A file caught mid-write counts next time.
    }
  }
  chat.otherDays = others
  await recount($)
  await offerWrapped($)
}

/** The history from the other chats as last read and this one as it stands; a new level is celebrated. */
async function recount($: Dollar) {
  const now = await $.clock.now()
  const v = await read($, env)
  const history = summarize([...chat.otherDays, chat.myDays], dayKey(now, v.tz))
  await setEnv($, x => ({ ...x, history }))
  await checkLevel($)
  await keepFirstDay($)
  await award($, [])
}

async function saveDays($: Dollar) {
  if (chat.dataDir === '' || chat.sessionId === '') return
  await forgetIfReset($)
  const name = `${chat.sessionId}.json`
  await $.fs.write(`${chat.dataDir}/days/${name}`, `${JSON.stringify({ id: chat.sessionId, label: chat.label, isLabelFromPrompt: chat.isLabelFromPrompt, days: chat.myDays })}\n`)
    .then(() => { if (!chat.counted.includes(name)) chat.counted = [...chat.counted, name] }, () => undefined)
}

async function addToday($: Dollar, rec: Partial<DayRec>) {
  await forgetIfReset($)
  const now = await $.clock.now()
  const key = dayKey(now, (await read($, env)).tz)
  chat.myDays = { ...chat.myDays, [key]: addDay(chat.myDays[key] ?? EMPTY_DAY, rec) }
}

/** A level or item earned since the last look is celebrated once, in whichever chat sees it first; over a face that must stay, by a toast alone. */
async function checkLevel($: Dollar) {
  if (chat.dataDir === '' || !(await isSeen($))) return
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
  const parts = [...((saved.level ?? 1) < level ? [t().st.level(level)] : []), ...(fresh.length > 0 ? [t().st.newItems([...fresh.slice(0, 4).map(itemName), ...(fresh.length > 4 ? [`+${fresh.length - 4}`] : [])].join(', '))] : [])]
  if (mayCelebrate(await read($, face), await $.clock.now())) await show($, { mood: 'party', line: parts.join(' · '), holdMs: 8000, sound: 'party' })
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
    const all = [...theirs, ...x.samples].sort((a, b) => a.at - b.at)
    // Each reading once, however many times the chats' copies hold it.
    const seen = new Set<string>()
    const merged = keepSamples(all.filter(s => !seen.has(`${s.kind}@${s.at}`) && seen.add(`${s.kind}@${s.at}`)), now)
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
    for (const code of langCodes(sys.stdout)) {
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
  chat.counted = []
  try {
    const file = JSON.parse(await $.fs.read(`${chat.dataDir}/days/${chat.sessionId}.json`)) as { days?: Record<string, DayRec> }
    if (file.days) chat.myDays = file.days
    chat.counted = [`${chat.sessionId}.json`]
  } catch {
    // A new chat has no file yet.
  }
  void saveSamples($).catch(() => undefined)
  void refreshHistory($).catch(() => undefined)
  void cleanLive($).catch(() => undefined)
  void writeLive($, true).catch(() => undefined)
}

/** The title and transcript a classic hook's input carries, kept when there is one. */
function noteTitle(title: string | undefined, transcript: string | undefined) {
  if (typeof transcript === 'string' && transcript !== '') chat.transcript = transcript
  const clean = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : ''
  if (clean !== '') chat.title = clean
}

/** A transcript larger than this is not read for a title: a long chat has long had one from a prompt. */
const TITLE_READ_MAX = 8 * 1024 * 1024

/** The title the app last wrote in this chat's transcript, if it has written one. */
async function readTitle($: Dollar) {
  if (chat.transcript === '') return
  const st = await $.fs.stat(chat.transcript)
  if (st.size > TITLE_READ_MAX) return
  const text = await $.fs.read(chat.transcript)
  const found = [...text.matchAll(/"type":"custom-title","customTitle":("(?:[^"\\]|\\.)*")/g)].at(-1)?.[1]
  if (found === undefined) return
  noteTitle(JSON.parse(found) as string, undefined)
  if (chat.title !== '') await writeLive($, true)
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
  void refreshPr($).catch(() => undefined)
  void retireTip($, 'rings').catch(() => undefined)
  const opened = await $.ui.open({ id: DETAIL, title: t().detail.title })
  if (!opened.isPlaced) $.ui.toast(t().note.detailFailed(opened.reason))
}

async function setPrefs($: Dollar, change: (p: Prefs) => Prefs) {
  const before = await read($, prefs)
  const next = await update($, prefs, change)
  // The store is every chat's: only what this change altered goes in, over what the other chats saved since this one started.
  const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof Prefs])))
  const stored = (await $.store.get('prefs').catch(() => undefined)) as Partial<Prefs> | undefined
  await $.store.set('prefs', stored === undefined ? next : { ...stored, ...changed })
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
  // Dozing or hidden, Mochi makes its rounds on fewer beats, its frame turning slower.
  const isDozing = !chat.isBusy && f.until === 0 && (f.mood === 'sleepy' || f.mood === 'sleeping')
  if ((isDozing || p.isHidden) && chat.beat % DOZE_EVERY !== 0) return
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
  if (now - chat.appsAt > APPS_EVERY_MS) void readApps($).catch(() => undefined)
  if (now - chat.peersAt > PEERS_EVERY_MS) void readPeers($).catch(() => undefined)
  if (now - chat.historyAt > HISTORY_EVERY_MS) void refreshHistory($).catch(() => undefined)
  if (now - chat.samplesAt > SAMPLES_EVERY_MS) void saveSamples($).catch(() => undefined)
  if (now - chat.latestAt > 60 * 60_000) void noteLatest($, now).catch(() => undefined)
  void watchChats($, now).catch(() => undefined)
  if (chat.ciSha !== '' && !chat.isCiAsking && now - chat.ciAt > CI_EVERY_MS) void pollCi($).catch(() => undefined)
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
  if (await restMoments($, p, f, v.tz, now)) return
  void coach($, now, f).catch(() => undefined)
  if (await flowTick($, now, f)) return

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
  // Put to sleep by a good night, Mochi sleeps on rather than waking to doze.
  if (mood !== null && (f.mood === 'idle' || f.mood === 'sleepy' || f.mood === 'sleeping') && !(f.mood === 'sleeping' && mood === 'sleepy')) {
    const line = restLine(mood, quiet)
    if (f.mood !== mood || f.line !== line) await putFace($, { mood, line, until: 0, since: 0 })
  }
}

// ---------- ultracode ----------

/** A round's last agent has ended this long ago: the workflow is done, not between two stages. */
const FLOW_SETTLE_MS = 2500
/** Agents that report nothing for this long were stopped: let go of them. */
const FLOW_STALE_MS = 10 * 60_000

/** One of a workflow script's agents (or a background one) started or ended: the helpers beside Mochi follow, and three at once earn the badge. */
async function flowMove($: Dollar, id: string, isStart: boolean, isAnswer = true, isWorkflow = false) {
  const w = chat.flow
  if (isStart ? w.ids.has(id) : !w.ids.has(id)) return
  const now = await $.clock.now()
  chat.lastActivity = now
  w.at = now
  if (isStart) {
    if (w.total === 0) w.startedAt = now
    if (isWorkflow) w.isWorkflow = true
    w.ids.add(id)
    w.total += 1
    w.idleAt = 0
  } else {
    w.ids.delete(id)
    if (isAnswer) w.ok += 1
    if (w.ids.size === 0) w.idleAt = now
  }
  await setEnv($, v => ({ ...v, agents: Math.max(0, v.agents + (isStart ? 1 : -1)) }))
  if (isStart && (await read($, env)).agents >= TEAM_AT) void award($, ['team']).catch(() => undefined)
}

/**
 * While a workflow's agents run and nothing else holds the face, it says how
 * far they are; once the last has ended, a party. True when it drew.
 */
async function flowTick($: Dollar, now: number, f: Face): Promise<boolean> {
  const w = chat.flow
  // Not while a subagent's call runs or a question waits on the person: that is silence of another kind.
  if (w.ids.size > 0 && w.calls === 0 && chat.perm === null && !chat.isAsking && now - w.at > FLOW_STALE_MS) {
    const stopped = w.ids.size
    w.ids.clear()
    w.idleAt = now
    await setEnv($, v => ({ ...v, agents: Math.max(0, v.agents - stopped) }))
  }
  if (w.ids.size > 0) {
    const line = flowLine(w.ids.size, w.total, w.isWorkflow ? ULTRA : '')
    const isFree = !chat.isBusy && f.until === 0 && (f.mood === 'idle' || f.mood === 'sleepy' || f.mood === 'agent')
    if (!isFree || f.line === line) return false
    await show($, { mood: 'agent', line, holdMs: 0 }, w.startedAt)
    return true
  }
  if (w.total === 0 || w.idleAt === 0 || now - w.idleAt < FLOW_SETTLE_MS) return false
  const end = flowEnd(w.total, w.ok, Math.round((w.idleAt - w.startedAt) / 1000), w.isWorkflow ? ULTRA : '')
  w.total = 0
  w.isWorkflow = false
  w.ok = 0
  w.idleAt = 0
  // The reply to the workflow's notification is on its way: its end shows the party.
  if (chat.isBusy) {
    w.finale = end
    return false
  }
  if (!mayCelebrate(f, now)) {
    $.ui.toast(`Mochi: ${end.line}`, { timeoutMs: 9000 })
    return false
  }
  await show($, end)
  return true
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
 * A command that cannot be undone, or an edit that adds a secret (`cmd` ''),
 * waits for the person's word: run, stop, or always allow its kinds here.
 * What to tell the model when they stop it; null when it may run.
 */
async function shield($: Dollar, args: Record<string, unknown> & { tool: string }, cmd: string, v: Verdict, startedAt: number): Promise<{ deny: string } | null> {
  const first = v.ask[0]
  if (first === undefined || (await $.session.surfaces()).length === 0) return null
  const what = say(first)
  const line = `${t().st.awaitingApproval} · ${what}`
  // A force push onto the person's own branch asks with a nervous look, no alarm.
  await show($, isMild(v.ask) ? { mood: 'nervous', line, holdMs: 0 } : { mood: 'scared', line, holdMs: 0, sound: 'alarm' })
  if (chat.isBusy && startedAt - chat.turn.startedAt >= ASKS_AFTER_MS) await notify($, line)
  const shown = cmd.length > 300 ? `${cmd.slice(0, 299)}…` : cmd
  const d = t().shield
  const go = cmd === '' ? d.write : d.run
  // The question names every kind found, since "always allow here" remembers them all.
  const all = v.ask.map(x => say(x)).join(' · ')
  const question = cmd === '' ? d.editQuestion(all, subject(args)) : d.question(all, shown)
  chat.isAsking = true
  const answer = await $.ui.ask(question, { header: 'Mochi', options: v.root === '' ? [go, d.stop] : [go, d.stop, d.always] }).catch(() => d.stop)
  chat.isAsking = false
  if (answer === d.always) await allowHere($, v.root, v.ask.map(x => x.key))
  else if (answer !== go) {
    await show($, { mood: 'denied', line: `${t().st.halted} · ${what}`, holdMs: 5000 })
    // Said to the model, so always in English.
    return { deny: `The user stopped this ${cmd === '' ? 'edit' : 'command'} at Mochi's prompt (it ${say(first, DICTS.en)}). Do not retry it; ask the user how to proceed if it is needed.` }
  }
  await show($, { mood: 'nervous', line: `${t().st.approved} · ${subject(args)}`, holdMs: 0 }, startedAt)
  return null
}

// ---------- /mochi ----------

type Word = keyof Dict['cmd']['words'] | keyof Dict['data']['words'] | 'chats'
/** A subcommand's name: the key of its words in each language, or a name the same in every language. */
type Name = Word | 'ci' | 'update'

/** A command's words in the language in use: in `cmd.words`, or, for a newer command, in its own section; none for a name the same in every language. */
const wordsFor = (key: Name): string[] => (key === 'chats' ? t().chats.words.split(' ').filter(Boolean) : key === 'ci' ? [] : key === 'update' ? t().update.words.split(' ').filter(Boolean) : { ...t().cmd.words, ...t().data.words }[key])

/** Whether `value` names the command: its English words, or the words of the language in use. */
const names = (value: string, key: Name, ...english: string[]) => english.includes(value) || wordsFor(key).some(w => plain(w) === value)

/** A subcommand: its name, the English words it answers to, and what it does with the rest of the line (folded, and as typed). */
type Command = { name: Name; english: string[]; run: (arg: string, raw: string) => Promise<string> }

/** What a setting's command asks for: on or off by its word, or turned over when it names neither. */
const wanted = (arg: string, now: boolean): boolean => (names(arg, 'on', 'on') ? true : names(arg, 'off', 'off') ? false : !now)

/** The subcommands of /mochi, tried in this order. */
function commands($: Dollar, p: Prefs): Command[] {
  return [
    { name: 'small', english: ['small', 'compact'], run: () => resize($, true) },
    { name: 'big', english: ['big', 'full'], run: () => resize($, false) },
    { name: 'details', english: ['details', 'detail'], run: () => details($) },
    { name: 'shield', english: ['shield'], run: arg => shieldNow($, arg) },
    { name: 'alerts', english: ['alerts', 'alert', 'notifications'], run: arg => toggleAlerts($, arg) },
    { name: 'ci', english: ['ci'], run: arg => toggleCi($, arg) },
    { name: 'lang', english: ['lang', 'language'], run: (arg, raw) => language($, arg, raw) },
    { name: 'level', english: ['level', 'xp'], run: () => levelNow($) },
    { name: 'wear', english: ['wear', 'outfit', 'accessory', 'accessories'], run: arg => wear($, arg, p) },
    { name: 'sound', english: ['sound'], run: arg => toggleSound($, arg) },
    { name: 'hide', english: ['hide'], run: () => setHidden($, true) },
    { name: 'show', english: ['show'], run: () => setHidden($, false) },
    { name: 'chats', english: ['chats', 'board'], run: () => chatsNow($) },
    { name: 'card', english: ['card'], run: (_, raw) => card($, raw) },
    { name: 'wrapped', english: ['wrapped', 'wrap'], run: arg => wrapped($, arg) },
    { name: 'snap', english: ['snap', 'snapshot'], run: () => snap($) },
    { name: 'tips', english: ['tips', 'tip'], run: arg => toggleTips($, arg) },
    { name: 'tour', english: ['tour', 'welcome'], run: () => replayTour() },
    { name: 'news', english: ['news', 'new'], run: () => Promise.resolve(newsLines(chat.coach.version)) },
    { name: 'update', english: ['update', 'upgrade', 'version'], run: () => updateNow($) },
    { name: 'export', english: ['export'], run: () => exportAll($) },
    { name: 'reset', english: ['reset'], run: arg => reset($, arg) },
    { name: 'feedback', english: ['feedback', 'bug'], run: () => feedback($) },
    { name: 'plugins', english: ['plugins'], run: arg => togglePlugins($, arg) },
    { name: 'badges', english: ['badges', 'badge', 'achievements'], run: () => badgesNow($) },
    { name: 'breaks', english: ['breaks', 'break'], run: arg => toggleBreaks($, arg) },
    { name: 'birthday', english: ['birthday', 'bday'], run: arg => birthday($, arg) },
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

/**
 * Says whether the shield is on and what is always allowed where; `on` or
 * `off` turns it so first, and `reset` forgets what is always allowed. Alone
 * it changes nothing, so a look never turns the shield off.
 */
async function shieldNow($: Dollar, arg: string): Promise<string> {
  if (arg === 'reset' || arg === plain(t().guard.reset)) {
    await $.store.set('allowed', {})
    return t().guard.forgot
  }
  const isOn = names(arg, 'on', 'on') ? true : names(arg, 'off', 'off') ? false : null
  const next = isOn === null ? await read($, prefs) : await setPrefs($, v => ({ ...v, hasShield: isOn }))
  await loadRules($).catch(() => undefined)
  return [
    next.hasShield ? t().cmd.shieldOn : t().cmd.shieldOff,
    ...shieldLines(allowedOf(await $.store.get('allowed'))),
    ...(isOn === null ? [t().cmd.shieldHow(next.hasShield)] : []),
  ].join('\n')
}

async function toggleAlerts($: Dollar, arg: string): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasAlert: wanted(arg, v.hasAlert) }))
  return next.hasAlert ? t().cmd.alertsOn(LONG_TURN_S / 60) : t().cmd.alertsOff
}

/** Shows the language, or sets it: by code or name, as typed or folded (folding takes the marks off ї and splits Hangul). */
async function language($: Dollar, arg: string, raw: string): Promise<string> {
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
  const chosen = pickLang(arg) ?? pickLang(raw)
  if (chosen === null) return d.langUnknown(raw.trim(), list)
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
  const ok = unlocked(v.history)
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
  // An exact name wins over one that only starts with the word: "tea" is the tea glass, not the teardrop.
  const keys = (i: Item) => [itemName(i), itemShort(i), DICTS.en.item.name[i], DICTS.en.item.short[i]].map(plain)
  const item = ALL_ITEMS.find(i => i === byId) ?? ALL_ITEMS.find(i => keys(i).includes(arg)) ?? ALL_ITEMS.find(i => keys(i).some(n => n.startsWith(arg)))
  if (item === undefined) return d.noSuchItem(arg)
  if (!ok.includes(item)) return d.itemLocked(itemName(item), hintFor(item))
  await setPrefs($, x => ({ ...x, pick: { ...x.pick, [SLOT[item]]: item } }))
  await sync($)
  return d.itemOn(itemName(item))
}

async function toggleSound($: Dollar, arg: string): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasSound: wanted(arg, v.hasSound) }))
  if (next.hasSound) await play($, 'ding')
  return next.hasSound ? t().cmd.soundOn : t().cmd.soundOff
}

async function setHidden($: Dollar, isHidden: boolean): Promise<string> {
  await setPrefs($, v => ({ ...v, isHidden }))
  return isHidden ? t().cmd.hidden : t().cmd.shown
}

/** A setting turned over from the details pane, as its command does with no word after it; the shield's command alone only looks, so it is told which way. */
async function turn($: Dollar, key: string) {
  const p = await read($, prefs)
  if (key === 'shield') await shieldNow($, p.hasShield ? 'off' : 'on')
  if (key === 'alerts') await toggleAlerts($, '')
  if (key === 'sound') await toggleSound($, '')
  if (key === 'ci') await toggleCi($, '')
  if (key === 'tips') await toggleTips($, '')
  if (key === 'breaks') await toggleBreaks($, '')
  if (key === 'plugins') await togglePlugins($, '')
}

/** A line's path or link, from where it starts, so a folder with a space, or a label before a full-width colon, is not cut in; '' when none. */
const pathIn = (line: string): string => /(?:~[\\/]|[A-Za-z]:[\\/]|\/|https?:\/\/).*$/.exec(line.trim())?.[0] ?? ''

/** What is worth copying from an action's answer: the card's line for a profile, the bug report's link; '' when there is none. */
function copyOf(verb: string, text: string): string {
  const lines = text.split('\n')
  if (verb === 'card') return lines.length > 1 ? (lines.at(-1) ?? '') : ''
  return verb === 'feedback' ? pathIn(lines.at(-1) ?? '') : ''
}

/** What an action's answer opens: the card, the wrapped or the snapshot's band itself, the bug report's form; '' when nothing. */
function openOf(verb: string, text: string): string {
  const lines = text.split('\n')
  const first = pathIn(lines[0] ?? '')
  if (verb === 'card' || verb === 'wrapped' || verb === 'year' || verb === 'snap') return first
  return verb === 'feedback' ? pathIn(lines.at(-1) ?? '') : ''
}

/** Opens a file, a folder or a link with the app the system picks for it; a file that is not there is left alone. */
async function openIt($: Dollar, target: string) {
  if (!/^https?:\/\//.test(target) && !(await $.fs.exists(target.replaceAll('\\', '/')).catch(() => false))) return
  void $.process.run(openCommand(chat.platform, target), { timeoutMs: 10_000 }).catch(() => undefined)
}

/** One of /mochi's actions run from the details pane (`reset:history` and the like); its answer is kept for the pane to show. */
async function act($: Dollar, what: string) {
  const [verb = '', scope = ''] = what.split(':')
  const text = verb === 'card' ? await card($, '')
    : verb === 'wrapped' ? await wrapped($, '')
    : verb === 'year' ? await wrapped($, 'year')
    : verb === 'snap' ? await snap($)
    : verb === 'tour' ? await replayTour()
    : verb === 'news' ? newsLines(chat.coach.version)
    : verb === 'feedback' ? await feedback($)
    : verb === 'export' ? await exportAll($)
    : verb === 'reset' ? await reset($, scope)
    : ''
  if (text === '') return
  // What was made is shown at once, not only named.
  const open = openOf(verb, text)
  await update($, said, () => ({ text, copy: copyOf(verb, text), open }))
  if (open !== '') await openIt($, open)
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
    d.moreLine(p.hasTips, p.hasBreaks, p.hasPlugins),
    d.peersLine(levelOf(xpOf(v.history)).level, v.peers.length === 0 ? d.none : v.peers.map(x => x.label).join(', ')),
    t().ci.status(p.hasCi, p.hasCi && chat.ghTrouble !== null ? t().ci[chat.ghTrouble] : ''),
    d.commands,
  ].join('\n')
}

// ---------- chats & limits ----------

/** How long a claim waits before it is read back, so chats that claimed at once have all written. */
const CLAIM_SETTLE_MS = 1500

/** Where this chat works, for the board: its folder's name, and whether git keeps it as a linked worktree. */
async function findWhere($: Dollar) {
  chat.folder = baseName(await $.session.root().catch(() => ''))
  const out = await $.process.run(['git', 'rev-parse', '--git-dir', '--git-common-dir'], { timeoutMs: 5000 }).catch(() => undefined)
  chat.isWorktree = out?.exitCode === 0 && isLinkedWorktree(out.stdout)
}

/**
 * On each beat: this chat's row for the board, one more notification for a
 * wait on the person that went on, and a nearly used-up window that reset.
 */
async function watchChats($: Dollar, now: number) {
  // Taken before any wait, so beats that overlap never look at the same stretch twice.
  const seenAt = chat.resetsSeenAt
  chat.resetsSeenAt = now
  const me: Peer = { ...(await liveNow($)), at: 0 }
  const v = await read($, env)
  if (JSON.stringify(me) !== JSON.stringify(v.me)) await update($, env, x => ({ ...x, me }))
  if (isWaitLong(me, chat.waitTold, now)) {
    chat.waitTold = me.stateAt ?? 0
    await notify($, t().chats.waitingLong(me.label, age(now - chat.waitTold)))
  }
  // The readings are as old as the last response, so the reset comes from the time they gave.
  for (const l of resetsPassed(v.limits, seenAt, now)) await limitBack($, l)
}

/** A nearly used-up window has reset: every idle chat's Mochi shows it, and one chat on the machine tells the person. */
async function limitBack($: Dollar, l: Limit) {
  const line = t().limit.back(t().limit.long[l.kind] ?? l.kind)
  // A working chat keeps its face on the work.
  if (!chat.isBusy) await show($, { mood: 'party', line, holdMs: 10_000, sound: 'ding' })
  if (await claim($, `reset-${l.kind}`, l.resetsAt)) await notify($, line)
}

/**
 * Whether this chat is the one to tell of something every chat sees at once,
 * by a marker file under the shared folder: a claim already there stands;
 * chats that find none all write theirs, and the one read back a moment later wins.
 */
async function claim($: Dollar, name: string, at: number): Promise<boolean> {
  if (chat.dataDir === '' || chat.sessionId === '') return true
  const path = `${chat.dataDir}/${name}.json`
  const holder = async () => claimOf(await $.fs.read(path).catch(() => null), at, chat.sessionId)
  const found = await holder()
  if (found !== 'free') return found === 'mine'
  await $.fs.write(path, JSON.stringify({ at, id: chat.sessionId })).catch(() => undefined)
  await $.clock.sleep(CLAIM_SETTLE_MS)
  return (await holder()) === 'mine'
}

/** /mochi chats: every chat on the machine, this one first. */
async function chatsNow($: Dollar): Promise<string> {
  const now = await $.clock.now()
  return boardLines({ ...(await liveNow($)), at: now }, (await read($, env)).peers, now).join('\n')
}

// ---------- CI ----------

/** gh is asked about a push's runs this often, for half an hour at most; a push with no run two minutes on starts none. */
const CI_EVERY_MS = 30_000
const CI_FOR_MS = 30 * 60_000
const CI_NONE_MS = 2 * 60_000
/** GitHub takes a few seconds to start the runs: the first look comes this long after the push. */
const CI_FIRST_MS = 8000
/** gh with no prompt and no update check of its own, cut off after this long. */
const GH_ENV = { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' }
const GH_MS = 20_000

/** The person's own gh, in the session's folder; null when it cannot start or does not answer in time. */
async function gh($: Dollar, args: string[]) {
  return $.process.run(['gh', ...args], { env: GH_ENV, timeoutMs: GH_MS }).catch(() => null)
}

/** The branch's open pull request and its checks; on the way, whether gh answers here at all. */
async function refreshPr($: Dollar) {
  if (chat.isPrAsking) return
  chat.isPrAsking = true
  try {
    if (!(await read($, prefs)).hasCi) return
    const askedAt = await $.clock.now()
    const out = await gh($, ['pr', 'view', '--json', PR_FIELDS])
    // A gh that cannot start fails at once; one cut off at the time limit met a slow network, and what was known stays.
    if (out === null && (await $.clock.now()) - askedAt >= GH_MS) return
    chat.ghTrouble = out === null ? 'missing' : out.exitCode === 0 ? null : ghTrouble(out.exitCode, out.stderr)
    // Offline or a hiccup: what was known stays; turned off meanwhile, nothing is shown.
    if (out !== null && out.exitCode !== 0 && chat.ghTrouble === null && !/no pull requests found/i.test(out.stderr)) return
    if (!(await read($, prefs)).hasCi) return
    const pr = out?.exitCode === 0 ? prOf(out.stdout) : null
    await setEnv($, v => (JSON.stringify(v.pr ?? null) === JSON.stringify(pr) ? v : { ...v, pr }))
  } finally {
    chat.isPrAsking = false
  }
}

/** At the start: the branch's pull request, and the CI of a push a reload left half followed. */
async function resumeCi($: Dollar) {
  const ci = (await read($, env)).ci
  if (ci && (ci.state === 'waiting' || ci.state === 'running') && (await read($, prefs)).hasCi) {
    chat.ciSha = ci.sha
    chat.ciSince = ci.pushedAt
  }
  await refreshPr($)
}

/** After a push in this chat: when gh answers for this repository, the pushed commit's runs are followed. */
async function startCi($: Dollar) {
  if (!(await read($, prefs)).hasCi) return
  const head = await $.process.run(['git', 'rev-parse', 'HEAD'], { timeoutMs: 5000 }).catch(() => undefined)
  const sha = head?.exitCode === 0 ? head.stdout.trim() : ''
  await refreshPr($)
  // Turned off meanwhile, or pushed again while its runs go: nothing new to follow.
  if (!/^[0-9a-f]{40,64}$/.test(sha) || chat.ghTrouble !== null || sha === chat.ciSha || !(await read($, prefs)).hasCi) return
  const now = await $.clock.now()
  chat.ciSha = sha
  chat.ciSince = now
  chat.ciAt = now - CI_EVERY_MS + CI_FIRST_MS
  await setEnv($, v => ({ ...v, ci: ciOf('[]', sha, now) }))
}

/** Asks gh how the pushed commit's runs stand, from the timer, one call at a time; once all have ended, says how. */
async function pollCi($: Dollar) {
  chat.isCiAsking = true
  try {
    const sha = chat.ciSha
    chat.ciAt = await $.clock.now()
    const out = await gh($, ['run', 'list', '--commit', sha, '--json', RUN_FIELDS])
    const ci = out?.exitCode === 0 ? ciOf(out.stdout, sha, chat.ciSince) : null
    // A newer push, or /mochi ci, took over meanwhile.
    if (sha !== chat.ciSha) return
    if (ci !== null && ci.state !== 'waiting' && ci.state !== 'running') {
      chat.ciSha = ''
      await setEnv($, v => ({ ...v, ci }))
      await ciDone($, ci)
      return
    }
    const now = await $.clock.now()
    const isRunning = (ci ?? (await read($, env)).ci)?.state === 'running'
    const isOver = now - chat.ciSince > (isRunning ? CI_FOR_MS : CI_NONE_MS)
    if (isOver) chat.ciSha = ''
    if (isOver || ci !== null) await setEnv($, v => ({ ...v, ci: isOver ? null : ci }))
  } finally {
    chat.isCiAsking = false
  }
}

/** How the pushed commit's CI ended: a party, the failed workflow, or a plain line. */
async function ciDone($: Dollar, ci: Ci) {
  const line = ciLine(ci)
  const f = await read($, face)
  // A question held open, or the shield's, keeps its face: the news goes to a toast instead.
  const isAsking = (f.mood === 'asking' && f.until === 0) || chat.isAsking
  if (!isAsking) {
    await show($, ci.state === 'passed' ? { mood: 'party', line, holdMs: 8000, sound: 'party' }
      : ci.state === 'failed' ? { mood: 'error', line, holdMs: 10_000, sound: 'oops' }
      : { mood: 'idle', line, holdMs: 6000 })
  }
  // Mid-turn the face moves on with the work, so a toast keeps the news; a failure reaches someone away as a notification.
  if (ci.state === 'failed' && !chat.isBusy) await notify($, line)
  else if (chat.isBusy || isAsking) $.ui.toast(`Mochi: ${line}`, { timeoutMs: 8000 })
  void refreshPr($).catch(() => undefined)
}

async function toggleCi($: Dollar, arg: string): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasCi: wanted(arg, v.hasCi) }))
  // A push being followed is let go only when CI is turned off.
  if (next.hasCi) void refreshPr($).catch(() => undefined)
  else {
    chat.ciSha = ''
    await setEnv($, v => ({ ...v, ci: null, pr: null }))
  }
  return next.hasCi ? t().ci.on : t().ci.off
}

// ---------- share ----------

/** Every chat's days with its folder's name, this chat's own from memory; a name taken from a prompt (or a file too old to say) stays out of a picture to share. */
async function readChats($: Dollar): Promise<ChatDays[]> {
  const out: ChatDays[] = [{ label: chat.isLabelFromPrompt ? '' : chat.label, days: chat.myDays }]
  if (chat.dataDir === '') return out
  const dir = `${chat.dataDir}/days`
  for (const entry of await $.fs.list(dir).catch(() => [])) {
    if (!entry.name.endsWith('.json')) continue
    try {
      const file = JSON.parse(await $.fs.read(`${dir}/${entry.name}`)) as { id?: unknown; label?: unknown; isLabelFromPrompt?: unknown; days?: unknown }
      if (typeof file.id !== 'string' || file.id === chat.sessionId || typeof file.days !== 'object' || file.days === null) continue
      out.push({ label: typeof file.label === 'string' && file.isLabelFromPrompt === false ? file.label : '', days: file.days as ChatDays['days'] })
    } catch {
      // A file caught mid-write counts next time.
    }
  }
  return out
}

/** Writes a drawing (to ~/.claude/mochi/share, unless the person named a place) and says where, as the system writes paths. */
async function saveShare($: Dollar, name: string, svg: string, path = ''): Promise<string> {
  const to = path !== '' ? path : chat.dataDir === '' ? '' : `${chat.dataDir}/share/${name}`
  if (to === '') throw new Error('~/.claude/mochi')
  await $.fs.write(to, svg)
  return chat.platform === 'windows' ? to.replaceAll('/', '\\') : to
}

const failed = (e: unknown) => t().share.failed(e instanceof Error ? e.message : String(e))

/** The card for a profile README, and the line that shows it there. */
async function card($: Dollar, raw: string): Promise<string> {
  const now = await $.clock.now()
  const v = await read($, env)
  const path = raw === '' ? '' : cardPath(raw, await $.session.cwd(), chat.dataDir.replace(/\/\.claude\/mochi$/, ''))
  try {
    const shown = await saveShare($, 'mochi-card.svg', cardSvg(v.history, outfitNow(await read($, prefs), v, 'idle', now)), path)
    return [t().share.cardSaved(shown), t().share.cardHow, cardMarkdown(baseName(shown))].join('\n')
  } catch (e) {
    return failed(e)
  }
}

/** The month (or the year) wrapped up from every chat's days. */
async function wrapped($: Dollar, arg: string): Promise<string> {
  const now = await $.clock.now()
  const v = await read($, env)
  const w = wrappedOf(await readChats($), names(arg, 'year', 'year') ? 'year' : 'month', dayKey(now, v.tz))
  const worn = outfitNow(await read($, prefs), v, w.activeDays > 0 ? 'party' : 'sleeping', now)
  try {
    return t().share.wrappedSaved(periodTitle(w.key), await saveShare($, `mochi-wrapped-${w.key}.svg`, wrappedSvg(w, worn)))
  } catch (e) {
    return failed(e)
  }
}

/**
 * The band as the desktop draws it and the details pane, as they stand now,
 * without the other chats (named after a prompt, some) or the last edit's
 * lines of code. A PNG beside each, for sites that take no SVG, where the
 * machine has a tool that draws one.
 */
async function snap($: Dollar): Promise<string> {
  const now = await $.clock.now()
  const band = panelSvg({ panel: { shot: await read($, shot), info: { ...(await infoNow($)), peers: [] }, infoFrom: null, infoAt: now }, now, width: SNAP_W })
  const details = detailSvg({ ...(await read($, env)), lastEdit: null, peers: [] }, now, SNAP_W)
  try {
    const a = await saveShare($, 'mochi-band.svg', framed(band.svg, band.width, PANEL_H))
    const b = await saveShare($, 'mochi-details.svg', framed(details, SNAP_W, detailHeight(details)))
    const [pa, pb] = [await toPng($, a), await toPng($, b)]
    return pa !== null && pb !== null ? t().share.snapSaved(pa, pb) : `${t().share.snapSaved(a, b)}\n${t().share.noPng}`
  } catch (e) {
    return failed(e)
  }
}

/** A PNG drawn beside an SVG by the first tool the machine has (rsvg-convert, ImageMagick); its path, or null when none could. */
async function toPng($: Dollar, svg: string): Promise<string | null> {
  const png = svg.replace(/\.svg$/, '.png')
  for (const argv of pngCommands(svg, png)) {
    const ran = await $.process.run(argv, { timeoutMs: 20_000 }).catch(() => null)
    if (ran?.exitCode === 0 && (await $.fs.exists(png).catch(() => false))) return png
  }
  return null
}

/** In a new month's first week, says once (in whichever chat looks first) that the month just ended can be wrapped; not while alerts are off. */
async function offerWrapped($: Dollar) {
  const v = await read($, env)
  if (v.history === null || !(await read($, prefs)).hasAlert) return
  const key = monthToOffer(dayKey(await $.clock.now(), v.tz), v.history.days, await $.store.get('wrapped'))
  if (key === null || !(await isSeen($))) return
  await $.store.set('wrapped', key)
  $.ui.toast(`Mochi: ${t().share.ready(monthName(key))}`, { timeoutMs: 10_000 })
}

// ---------- coach ----------

/** While idle, Mochi looks for the tour's next step, a question or a tip at most this often. */
const COACH_EVERY_MS = 3000
/** A first prompt this long would have been better planned first. */
const LONG_PROMPT = 1000

// ponytail: read, change, write with no lock; two chats writing in the same moment can lose one count. Fine for tips and counts.
const coachFile = () => `${chat.dataDir}/coach.json`

/** A tip a situation called for, shown once Mochi is idle and the limits allow. */
function wantTip(id: TipId, now: number, arg = '') {
  chat.coach.pending = { ...chat.coach.pending, [id]: { at: now, arg } }
}

/**
 * On the very first start ever (no preferences, no version seen, no day
 * recorded), the tour; on the first start of a newer version, a word on what
 * is new, once. Weighed at the start, said by onceSeen.
 */
async function welcome($: Dollar, hasPrefs: boolean) {
  const seen = await $.store.get('version')
  const version = await mochiVersion($)
  chat.coach.version = version
  if (seen === version) return
  // Someone who used an older version, preferences untouched, has days on record.
  const isFirst = !hasPrefs && seen === undefined && (await $.fs.list(`${chat.dataDir}/days`).catch(() => [])).length === 0
  chat.coach.welcome = isFirst ? 'tour' : newsFor(version) !== null && !(typeof seen === 'string' && !isNewer(version, seen)) ? 'news' : 'seen'
}

/**
 * What is said once, said when someone can see it: the day's greeting a start
 * that drew nowhere held back, then the tour or what is new, the version kept
 * as seen only then.
 */
async function onceSeen($: Dollar) {
  if (!(await isSeen($))) return
  if (chat.coach.greet) {
    chat.coach.greet = false
    const hello = await greetToday($, await read($, prefs))
    if (hello !== null) return void (await show($, hello))
  }
  const due = chat.coach.welcome
  if (due === '') return
  chat.coach.welcome = ''
  await $.store.set('version', chat.coach.version)
  const news = newsFor(chat.coach.version)
  if (due === 'tour') chat.coach.tour = 0
  else if (due === 'news' && news !== null && (await read($, prefs)).hasTips) $.ui.toast(t().coach.newsToast(chat.coach.version, news.headline), { timeoutMs: 12_000 })
}

/** A prompt: a long one opening a fresh chat may call for plan mode; a standing instruction the person typed counts for its project. */
async function notePrompt($: Dollar, text: string, isPerson: boolean) {
  if (isPerson && text.length >= LONG_PROMPT && (await $.session.turns()) <= 1) chat.coach.isLongFirst = true
  const rules = isPerson ? rulesOf(text) : []
  if (rules.length === 0 || chat.dataDir === '' || !(await read($, prefs)).hasTips) return
  const counted = countRules(readLog(await $.fs.read(coachFile()).catch(() => '')), projectKey(await $.session.root()), rules)
  await $.fs.write(coachFile(), JSON.stringify(counted.log))
  if (counted.ask !== null) {
    chat.coach.rule = counted.ask
    chat.coach.ruleText = ruleAsWritten(text, counted.ask)
  }
}

/** The same permission asked a third time this chat calls for /permissions. */
async function noteAsk($: Dollar, tool: string, input: Record<string, unknown>) {
  const what = permKey(tool, input)
  const n = (chat.coach.asks[what] ?? 0) + 1
  chat.coach.asks = { ...chat.coach.asks, [what]: n }
  if (n >= 3) wantTip('permissions', await $.clock.now(), what)
}

/** The end of a turn: the tips it calls for take the place of those the last one called for. */
async function noteTurn($: Dollar, reason: string, errorRun: number) {
  const now = await $.clock.now()
  const hasPick = Object.keys((await read($, prefs)).pick).length > 0
  const ids = turnTips(await read($, env), { reason, errorRun, isLongFirst: chat.coach.isLongFirst, hasPlanned: chat.coach.hasPlanned, hasPick, canClick: chat.canClick }, now)
  const asked = chat.coach.pending.permissions
  chat.coach.isLongFirst = false
  chat.coach.pending = asked ? { permissions: asked } : {}
  for (const id of ids) wantTip(id, now)
}

/** While Mochi is idle: the tour's next step, the question about an instruction given again and again, or one tip. */
async function coach($: Dollar, now: number, f: Face) {
  if (chat.isBusy || f.until > 0 || f.mood !== 'idle' || now - chat.coach.at < COACH_EVERY_MS) return
  chat.coach.at = now
  if (chat.coach.greet || chat.coach.welcome !== '') return await onceSeen($)
  if (chat.coach.tour >= 0) return await tourStep($)
  const p = await read($, prefs)
  if (chat.dataDir === '' || p.isHidden || !p.hasTips) return
  if (chat.coach.rule !== '') return await askRule($)
  const v = await read($, env)
  chat.coach.pending = stillPending(chat.coach.pending, v, now)
  if (freshTips(chat.coach.pending, now).length === 0) return
  const log = readLog(await $.fs.read(coachFile()).catch(() => ''))
  const id = pickTip(log, chat.coach.pending, now, v.tz)
  if (id === null) {
    // The limits hold every tip back: look again in a minute, not on every beat.
    chat.coach.at = now + 60_000
    return
  }
  const tip = tipLines(id, id === 'commit' ? String(v.git?.changed ?? 0) : (chat.coach.pending[id]?.arg ?? ''))
  const { [id]: _shown, ...rest } = chat.coach.pending
  chat.coach.pending = rest
  await $.fs.write(coachFile(), JSON.stringify(shownTip(log, id, now, v.tz)))
  // The commit tip says what the commit nudge would: it counts as one.
  if (id === 'commit') chat.lastNudge = now
  await show($, { mood: 'pleased', line: `${t().coach.tip} · ${tip.line}`, holdMs: 10_000 })
  $.ui.toast(`Mochi: ${tip.text} (${t().coach.off})`, { timeoutMs: 12_000 })
}

/** The tour's next step, on the face and in a toast in Mochi's own voice. */
async function tourStep($: Dollar) {
  const at = chat.coach.tour
  const steps = t().coach.tour
  chat.coach.tour = at + 1 < steps.length ? at + 1 : -1
  // Where there are no rings to click, the step about them points to /mochi details.
  const step = at === 1 && !chat.canClick ? t().coach.tourDetails : steps[at]
  if (step === undefined) return
  await show($, { mood: TOUR_MOODS[at] ?? 'pleased', line: step.line, holdMs: 8000 })
  $.ui.toast(step.text, { timeoutMs: 10_000 })
}

/**
 * Asks whether to add an instruction given a third time to the project's
 * CLAUDE.md, and adds it only on a yes. A CLAUDE.md that cannot be read is
 * never written over: the question is dropped.
 */
async function askRule($: Dollar) {
  const rule = chat.coach.rule
  const written = chat.coach.ruleText || rule
  chat.coach.rule = ''
  if ((await $.session.surfaces()).length === 0) return
  // Nothing else is said while the question is open, nor for a minute after.
  chat.coach.at = Number.POSITIVE_INFINITY
  try {
    const root = await $.session.root()
    const path = `${root}/CLAUDE.md`
    const readMd = async () => ((await $.fs.exists(path)) ? await $.fs.read(path) : '')
    const d = t().coach.rule
    // Already there, it counts as settled.
    const answer = hasRule(await readMd(), rule) ? d.never : await $.ui.ask(d.question(written), { header: 'Mochi', options: [d.add, d.later, d.never] }).catch(() => d.later)
    if (answer === d.add) {
      await $.fs.write(path, withRule(await readMd(), written))
      await show($, { mood: 'proud', line: d.added, holdMs: 5000 })
    }
    const log = readLog(await $.fs.read(coachFile()).catch(() => ''))
    await $.fs.write(coachFile(), JSON.stringify(settleRule(log, projectKey(root), rule, answer === d.add || answer === d.never)))
  } finally {
    chat.coach.at = (await $.clock.now()) + 60_000
  }
}

/** A tip whose feature the person found on their own never shows. */
async function retireTip($: Dollar, id: TipId) {
  if (chat.dataDir === '' || chat.coach.retired.includes(id)) return
  chat.coach.retired = [...chat.coach.retired, id]
  const log = readLog(await $.fs.read(coachFile()).catch(() => ''))
  if ((log.shown[id] ?? 0) < MAX_SHOWN) await $.fs.write(coachFile(), JSON.stringify({ ...log, shown: { ...log.shown, [id]: MAX_SHOWN } }))
}

async function toggleTips($: Dollar, arg: string): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasTips: wanted(arg, v.hasTips) }))
  return next.hasTips ? t().coach.tipsOn : t().coach.tipsOff
}

async function replayTour(): Promise<string> {
  chat.coach.tour = 0
  chat.coach.at = 0
  return t().coach.tourStarts
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

async function togglePlugins($: Dollar, arg: string): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasPlugins: wanted(arg, v.hasPlugins) }))
  return next.hasPlugins ? t().data.pluginsOn : t().data.pluginsOff
}

/** A days file this chat counted is gone, so a history reset in some chat: every chat's days are read again before this one counts or writes its own. */
async function forgetIfReset($: Dollar) {
  if (chat.counted.length === 0) return
  const list = await $.fs.list(`${chat.dataDir}/days`).catch(() => null)
  if (list !== null && chat.counted.some(n => !list.some(f => f.name === n))) await refreshHistory($)
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

// ---------- a newer Mochi ----------

/** Where the newest Mochi's manifest is read, and how long a reading is trusted. */
const LATEST_URL = 'https://raw.githubusercontent.com/oztrkemree/mochi/main/.claude-plugin/plugin.json'
const LATEST_EVERY_MS = 12 * 60 * 60_000
/** What updates Mochi from a terminal: the marketplace's copy first, then the plugin. The same in every language. */
const UPDATE_STEPS = ['claude plugin marketplace update mochi', 'claude plugin update mochi@mochi']

/**
 * The newest version on GitHub; every chat shares the reading, taken again
 * after twelve hours (or at once, `isFresh`). The last one known when the
 * network does not answer, '' when none ever did; nothing is asked while
 * non-essential traffic is turned off.
 */
async function latestVersion($: Dollar, now: number, isFresh = false): Promise<string> {
  const kept = (await $.store.get('latest').catch(() => undefined)) as { at?: unknown; version?: unknown } | undefined
  const known = typeof kept?.version === 'string' ? kept.version : ''
  if (!isFresh && typeof kept?.at === 'number' && now - kept.at < LATEST_EVERY_MS) return known
  if (await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC').catch(() => undefined)) return known
  let version = ''
  try {
    const r = await $.http.fetch(LATEST_URL)
    const v = r.ok ? (JSON.parse(r.text) as { version?: unknown }).version : undefined
    if (typeof v === 'string' && /^\d+(\.\d+)*$/.test(v)) version = v
  } catch {
    version = ''
  }
  await $.store.set('latest', { at: now, version: version || known })
  return version || known
}

/** Once for each newer version, said when someone can see it: a toast, and Mochi's line when it is not busy. */
async function noteLatest($: Dollar, now: number) {
  const mine = chat.coach.version
  if (mine === '') return
  chat.latestAt = now
  const latest = await latestVersion($, now)
  if (latest === '' || !isNewer(latest, mine) || (await $.store.get('latestTold')) === latest || !(await isSeen($))) return
  await $.store.set('latestTold', latest)
  $.ui.toast(`Mochi: ${t().update.toast(latest, mine)}`, { timeoutMs: 12_000 })
  if (!chat.isBusy) await show($, { mood: 'wave', line: t().update.line(latest), holdMs: 8000 })
}

/** /mochi update: whether a newer Mochi is out, read afresh, and the commands that update it. */
async function updateNow($: Dollar): Promise<string> {
  const mine = chat.coach.version
  const latest = await latestVersion($, await $.clock.now(), true)
  if (latest === '') return t().update.unknown(mine)
  if (mine !== '' && !isNewer(latest, mine)) return t().update.current(mine)
  return [t().update.available(latest, mine), ...UPDATE_STEPS.map(s => `  ${s}`), t().update.restart].join('\n')
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
    await refreshHistory($)
  }
  return left.length > 0 ? t().data.notCleared(left.join(', ')) : t().data.cleared[scope]
}

/** A link to a new bug report, its form filled with the versions, the system, the surface and the language alone. */
async function feedback($: Dollar): Promise<string> {
  // The link waits two seconds at most for what it carries, so the button never hangs the pane.
  const late = <T,>(fallback: T) => $.clock.sleep(2000).then(() => fallback)
  const claude = await Promise.race([$.session.version().then(v => v.version, () => ''), late('')])
  const surfaces = await Promise.race([$.session.surfaces().catch(() => []), late([] as string[])])
  return t().data.feedback(feedbackUrl({ mochi: await mochiVersion($), claude, platform: chat.platform, surface: surfaces[0] ?? '', lang: t().name }))
}

// ---------- shield ----------

/** What the shield asks about in a call; `face` shows what it lets by (low risk, or always allowed here); `root` is where "always" holds. */
type Verdict = { ask: Danger[]; face: Reaction | null; root: string }

/** Runs git in the session's folder: what it prints, '' when it fails. */
async function git($: Dollar, args: string[]): Promise<string> {
  const ran = await $.process.run(['git', ...args], { timeoutMs: 5000 }).catch(() => undefined)
  return ran?.exitCode === 0 ? ran.stdout : ''
}

/**
 * Reads the person's own rules (~/.claude/mochi/shield.json) at start and
 * whenever the file changes; what cannot be used is said once, and a change
 * after the start is said too, so no change to the shield goes unseen.
 */
async function loadRules($: Dollar) {
  if (chat.dataDir === '') return
  const path = `${chat.dataDir}/shield.json`
  const at = (await $.fs.stat(path).catch(() => undefined))?.mtimeMs ?? 0
  if (at === chat.rulesAt) return
  const isChange = chat.rulesAt !== -1
  chat.rulesAt = at
  const rules = parseRules(at === 0 ? '' : await $.fs.read(path).catch(() => ''))
  setRules(rules)
  if (rules.bad.length > 0) $.ui.toast(`Mochi: ${t().guard.badRules(rules.bad.join(', '))}`, { timeoutMs: 8000 })
  else if (isChange) $.ui.toast(`Mochi: ${t().guard.rules(rules.mine.length, rules.off.length)}`, { timeoutMs: 8000 })
}

/** Where "always allow here" holds: the repository's top folder, else the session's. */
async function repoRoot($: Dollar): Promise<string> {
  const top = (await git($, ['rev-parse', '--show-toplevel'])).trim()
  return repoKey(top !== '' ? top : await $.session.root().catch(() => ''))
}

/** Remembers these kinds as always allowed in the repository at `root`. */
async function allowHere($: Dollar, root: string, keys: string[]) {
  await $.store.set('allowed', allow(allowedOf(await $.store.get('allowed')), root, keys))
}

/** What a command's `git add` or `git commit` would put into git that looks secret. */
async function gitSecrets($: Dollar, cmd: string): Promise<Danger[]> {
  const specs = gitAdds(cmd)
  const scan = commitScan(cmd)
  if (specs === null && scan === null) return []
  const fresh = specs === null ? [] : (await git($, ['ls-files', '-z', '--others', '--exclude-standard'])).split('\0').filter(f => f !== '')
  const taken = addedFiles(specs ?? [], fresh)
  const files = scan === null ? [] : diffAdds(await git($, ['diff', scan === 'all' ? 'HEAD' : '--cached', '--unified=0', '--no-color', '--no-ext-diff', '--no-textconv']))
  // New files added and committed at once are in no diff yet: their text, for the first twenty under a megabyte.
  if (scan === 'all') {
    for (const path of fresh.filter(f => taken.includes(f)).slice(0, 20)) {
      if (((await $.fs.stat(path).catch(() => undefined))?.size ?? Infinity) > 1_000_000) continue
      const text = await $.fs.read(path).catch(() => null)
      if (text !== null) files.push({ path, added: text })
    }
  }
  return shellSecrets(taken, files)
}

/**
 * Weighs a call before it runs: commands that cannot be undone (a force push
 * by the branch it rewrites), secrets about to be written or put into git,
 * less what is always allowed here. Null while the shield is off or when
 * nothing is found.
 */
async function judge($: Dollar, args: Record<string, unknown> & { tool: string }, cmd: string): Promise<Verdict | null> {
  const path = /^(Write|Edit|MultiEdit)$/.test(args.tool) && typeof args.file_path === 'string' ? args.file_path : ''
  if ((cmd === '' && path === '') || !(await read($, prefs)).hasShield) return null
  await loadRules($)
  let found: Danger[]
  let isCalm = false
  if (cmd === '') {
    found = editSecrets(args, args.tool === 'Write' ? await $.fs.read(path).catch(() => null) : '')
  } else {
    found = dangers(cmd)
    if (found.some(x => x.key === 'forcePush')) {
      const head = (await git($, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).trim().replace(/^origin\//, '')
      const weighed = weigh(found, cmd, (await git($, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim(), head)
      isCalm = !weighed.some(x => x.key.startsWith('forcePush'))
      found = weighed
    }
    found = [...found, ...(await gitSecrets($, cmd))]
  }
  const careful = (words: string): Reaction => ({ mood: 'nervous', line: `${words} · ${subject(args)}`, holdMs: 0 })
  if (found.length === 0) return isCalm ? { ask: [], face: careful(t().st.careful), root: '' } : null
  const root = await repoRoot($)
  // "Always allow here" holds in the repository: a call that reaches outside it asks, and offers no "always".
  if (leavesRepo(cmd, path, root)) return { ask: found, face: null, root: '' }
  const allowed = allowedOf(await $.store.get('allowed'))[root] ?? []
  const ask = found.filter(x => !allowed.includes(x.key))
  return { ask, face: ask.length === 0 ? careful(t().guard.allowed) : null, root }
}

// ---------- delight ----------

/** The first start on a special day greets it, once for each occasion; null when there is nothing to greet. */
async function greetToday($: Dollar, p: Prefs): Promise<Reaction | null> {
  const today = dayKey(await $.clock.now(), (await read($, env)).tz)
  const saved = await $.store.get('greeted').catch(() => undefined)
  const greeted = Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []
  const due = dueGreeting(today, p, greeted)
  if (due === null) return null
  await $.store.set('greeted', [...greeted, ...due.keys.filter(k => !greeted.includes(k))].slice(-40)).catch(() => undefined)
  return greeting(due.name, today, p)
}

/** Keeps the first day Mochi ran here, for its anniversary: today, or an earlier day a chat's file knows. */
async function keepFirstDay($: Dollar) {
  const p = await read($, prefs)
  const first = firstDayOf(p.firstDay, dayKey(await $.clock.now(), (await read($, env)).tz), [...chat.otherDays, chat.myDays])
  if (first !== p.firstDay) await setPrefs($, x => ({ ...x, firstDay: first }))
}

/** Awards one after another: two at once (three agents starting together, say) would both celebrate. */
function award($: Dollar, fresh: Badge[]): Promise<void> {
  const done = chat.awards.then(() => awardNow($, fresh))
  chat.awards = done.catch(() => undefined)
  return done
}

/**
 * Badges earned since the last look (`fresh` from what just happened, the
 * rest proven by the history) are kept and celebrated once, in whichever chat
 * sees them first, over a face that must stay by a toast alone. The very
 * first look records quietly what the history already proves.
 */
async function awardNow($: Dollar, fresh: Badge[]) {
  if (chat.dataDir === '' || !(await isSeen($))) return
  const v = await read($, env)
  if (fresh.length > 0 && fresh.every(b => v.badges.includes(b))) return
  const path = `${chat.dataDir}/badges.json`
  const text = await $.fs.read(path).catch(() => null)
  // There but unread (locked a moment): never overwritten with less.
  if (text === null && (await $.fs.exists(path).catch(() => true))) return
  let saved: Badge[] | null = null
  if (text !== null) {
    try {
      saved = badgesOf(JSON.parse(text)) ?? []
    } catch {
      // A file caught mid-write counts next time.
      return
    }
  }
  const had = saved ?? []
  const news = [...new Set([...fresh, ...provenBy(v.history)])].filter(b => !had.includes(b))
  const all = [...had, ...news]
  if (JSON.stringify(all) !== JSON.stringify(v.badges)) await setEnv($, x => ({ ...x, badges: all }))
  if (saved !== null && news.length === 0) return
  await $.fs.write(path, JSON.stringify(all)).catch(() => undefined)
  const told = saved === null ? news.filter(b => fresh.includes(b)) : news
  if (told.length === 0) return
  const line = t().fun.newBadge(told.map(badgeName).join(', '))
  if (mayCelebrate(await read($, face), await $.clock.now())) await show($, { mood: 'party', line, holdMs: 8000, sound: 'party' })
  $.ui.toast(`Mochi: ${line}${t().fun.seeBadges}`, { timeoutMs: 8000 })
}

/** A finished shell command: a failing test run marks the turn red; a passing one, or a push, may earn a badge. */
async function noteCommand($: Dollar, cmd: string, isError: boolean) {
  const won = commandBadges(cmd, !isError, chat.isTestRed)
  if (isError && isTest(cmd)) chat.isTestRed = true
  if (won.length > 0) await award($, won)
}

/** After a turn: an early one counted for the day, the turns in a row without an error, and what the turn earned. */
async function awardTurn($: Dollar, reason: string, seconds: number, now: number) {
  if (isEarly(now, (await read($, env)).tz)) await addToday($, { early: 1 })
  const turned = turnBadges(reason, seconds, chat.turn.errors, chat.calm)
  chat.calm = turned.calm
  chat.isTestRed = false
  if (turned.badges.length > 0) await award($, turned.badges)
}

/**
 * On the timer, while Mochi rests: a stretch after two hours of work without
 * a break (at most every two hours), and a wink at 13:37 once a day. True
 * when one of them took the face.
 */
async function restMoments($: Dollar, p: Prefs, f: Face, tz: number, now: number): Promise<boolean> {
  chat.workFrom = workFrom(chat.workFrom, chat.lastActivity, now)
  if (chat.isBusy || f.until !== 0 || f.mood !== 'idle' || now - chat.lastActivity < 20_000) return false
  if (p.hasBreaks && isBreakDue(chat.workFrom, chat.lastStretch, now)) {
    chat.lastStretch = now
    // One suggestion for all the chats on this machine.
    const last = await $.store.get('stretchAt').catch(() => undefined)
    if (typeof last === 'number' && now - last < BREAK_AFTER) {
      chat.lastStretch = last
    } else {
      await $.store.set('stretchAt', now).catch(() => undefined)
      await show($, { mood: 'stretch', line: t().fun.breakLine(duration((now - chat.workFrom) / 1000)), holdMs: 10_000 })
      return true
    }
  }
  if (!isLeet(now, tz) || chat.winkDay === dayKey(now, tz)) return false
  chat.winkDay = dayKey(now, tz)
  await show($, { mood: 'wink', line: t().fun.leet, holdMs: 2500 })
  return true
}

async function badgesNow($: Dollar): Promise<string> {
  const f = t().fun
  const have = (await read($, env)).badges
  return [
    f.badgesList(have.length, BADGES.length, have.map(badgeName).join(', ') || t().cmd.noneYet),
    f.badgesLocked(BADGES.filter(b => !have.includes(b)).map(b => `${badgeName(b)} (${badgeHint(b)})`).join(', ') || t().cmd.none),
  ].join('\n')
}

async function toggleBreaks($: Dollar, arg: string): Promise<string> {
  const next = await setPrefs($, v => ({ ...v, hasBreaks: wanted(arg, v.hasBreaks) }))
  return next.hasBreaks ? t().fun.breaksOn : t().fun.breaksOff
}

/** Shows, sets or removes the person's birthday, kept with the preferences; set on the day itself, it is greeted at once. */
async function birthday($: Dollar, arg: string): Promise<string> {
  const f = t().fun
  if (arg === '') {
    const day = (await read($, prefs)).birthday
    return day === '' ? f.birthdayNone : f.birthdayNow(birthdayName(day))
  }
  if (names(arg, 'none', 'none', 'off')) {
    await setPrefs($, v => ({ ...v, birthday: '' }))
    return f.birthdayOff
  }
  const day = parseBirthday(arg)
  if (day === null) return f.birthdayBad(arg)
  const next = await setPrefs($, v => ({ ...v, birthday: day }))
  const hello = await greetToday($, next)
  if (hello !== null) await show($, hello)
  return f.birthdaySet(birthdayName(day))
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
    // No agent outlives a reload, so a count it left is dropped.
    await update($, env, v => ({ ...NO_ENV, ...v, agents: 0 }))
    await update($, face, f => ({ ...rest0(), ...f, frameAt: f.frameAt ?? -1 }))
    await update($, shot, v => ({ ...FIRST_SHOT, ...v, scene: { ...FIRST_SHOT.scene, ...v.scene } }))
    await update($, panel, v => ({ shot: { ...FIRST_SHOT, ...v.shot }, info: { ...NO_INFO, ...v.info }, infoFrom: null, infoAt: v.infoAt ?? 0 }))
    chat.lastActivity = await $.clock.now()
    await startShared($).catch(() => undefined)
    void findWhere($).catch(() => undefined)
    await loadRules($).catch(() => undefined)
    await measure($)
    chat.lastNudge = await $.clock.now()
    void refreshGit($).catch(() => undefined)
    void resumeCi($).catch(() => undefined)
    // A start that draws nowhere yet keeps the day's greeting for when someone can see it.
    chat.coach.greet = !(await isSeen($))
    await show($, (chat.coach.greet ? null : await greetToday($, p)) ?? { mood: 'wave', line: t().st.ready, holdMs: 3000 })
    void welcome($, saved !== undefined).catch(() => undefined)
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
    void notePrompt($, text, ['composer', 'bridge', 'sdk'].includes(e.origin?.kind)).catch(() => undefined)
    const wasAsleep = await wake($)
    const now = await $.clock.now()
    chat.stream = null
    // A background task's notification (a finished workflow's) is no one speaking: nothing in it is thanks or frustration.
    const isNote = e.origin?.kind === 'task-notification'
    const egg = isNote ? null : promptEgg(text)
    // A good night (the egg's stretch) puts Mochi to sleep once the reply is done.
    chat.isGoodNight = egg?.mood === 'stretch'
    await show($, isNote ? { mood: 'thinking', line: t().st.thinking, holdMs: 0 } : egg ?? onPrompt(text, wasAsleep), now)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    // Since 2.1.299 subagents' and teammates' turns start here too; only the main loop's begins a turn of the chat.
    if ((e as { agentId?: string }).agentId !== undefined) return next(e)
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

  // The agents a workflow script starts (ultracode), and those the Agent tool sends to the background, whose call
  // returns at once: counted from their start to their turn's end. A foreground one counts while its call runs (tool.call).
  // A teammate goes idle between turns, so its turn's end is no ending: it is left out.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    const isWorkflow = e.workflow !== undefined
    if ((isWorkflow || (e.background && e.isTeammate !== true)) && started.agentId !== undefined) await flowMove($, started.agentId, true, true, isWorkflow)
    if (started.agentId !== undefined && e.isTeammate !== true) {
      const now = await $.clock.now()
      const spawn = e as unknown as { description?: unknown; subagentType?: unknown }
      chat.crew.set(started.agentId, {
        id: started.agentId, type: typeof spawn.subagentType === 'string' ? spawn.subagentType : '', task: typeof spawn.description === 'string' ? spawn.description : '',
        activity: 'thinking', since: now, at: now, isBackground: isWorkflow || e.background === true,
      })
    }
    return started
  })

  on('tool.call', async ($, e, next) => {
    const args = e as unknown as Record<string, unknown> & { tool: string }
    const isSub = e.agentId !== undefined
    const isAgent = e.tool === 'Agent' || String(e.tool) === 'Task'
    const startedAt = await $.clock.now()
    chat.lastActivity = startedAt
    if (isSub) chat.flow.at = startedAt
    if (e.tool === 'ExitPlanMode') chat.coach.hasPlanned = true

    // The shield: a command that cannot be undone, or a secret on its way out, waits for the person's word.
    const cmd = isShell(e.tool) && typeof args.command === 'string' ? args.command : ''
    const verdict = await judge($, args, cmd)
    const stop = verdict === null ? null : await shield($, args, cmd, verdict, startedAt)
    if (stop !== null) return stop
    // The face an approved question left: a subagent's call does not take it down again, so its end does.
    const approvedToken = verdict !== null && verdict.ask.length > 0 ? chat.faceToken : -1
    // While a workflow's count has the face (nothing else busy), a subagent's call does not rewrite its line.
    const countHasFace = !chat.isBusy && chat.flow.ids.size > 0

    let token = -1
    if (isSub && e.agentId !== undefined) {
      // A subagent first seen by its call (one started before this load) is listed from then on, its type and task unknown.
      const was = chat.crew.get(e.agentId)
      chat.crew.set(e.agentId, { ...(was ?? { id: e.agentId, type: '', task: '', since: startedAt, isBackground: false }), activity: activityOf(beforeTool(args).mood) || 'thinking', at: startedAt })
    }
    if (isSub) {
      const f = await read($, face)
      if (f.mood === 'agent' && !countHasFace) await update($, face, v => ({ ...v, line: `${t().st.agent} · ${beforeTool(args).line}` }))
    } else if (verdict === null || verdict.ask.length === 0) {
      chat.stream = null
      token = await show($, verdict?.face ?? beforeTool(args), waitsOnPerson(e.tool) ? 0 : startedAt)
      if (waitsOnPerson(e.tool) && chat.isBusy && startedAt - chat.turn.startedAt >= ASKS_AFTER_MS) await notify($, beforeTool(args).line)
    }
    if (isAgent) await setEnv($, v => ({ ...v, agents: v.agents + 1 }))
    if (isAgent && (await read($, env)).agents >= TEAM_AT) void award($, ['team']).catch(() => undefined)
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
    if (isSub) chat.flow.calls += 1
    if (!isSub && waitsOnPerson(e.tool)) chat.waitTool = e.tool
    try {
      ran = await next(e)
    } finally {
      if (!isSub && chat.waitTool === e.tool) chat.waitTool = ''
      if (isSub) {
        chat.flow.calls = Math.max(0, chat.flow.calls - 1)
        chat.flow.at = await $.clock.now()
      }
      if (isAgent) await setEnv($, v => ({ ...v, agents: Math.max(0, v.agents - 1) }))
    }

    // A permission this call asked for was answered once the call is over: the face it covered comes back, its own again.
    // Questions asked together share what the first covered: it comes back when the last of their calls is over.
    const perm = chat.perm
    const asked = perm === null ? -1 : perm.keys.indexOf(callKey(e.agentId, e.tool, subject(args)))
    if (perm !== null && perm.token === chat.faceToken && asked >= 0) {
      perm.keys.splice(asked, 1)
      if (perm.keys.length === 0) {
        chat.perm = null
        chat.faceToken = perm.was
        await putFace($, isSub && perm.face.mood === 'agent' && !countHasFace ? { ...perm.face, line: `${t().st.agent} · ${beforeTool(args).line}` } : perm.face)
      }
    }
    if (isSub && approvedToken === chat.faceToken) await rest($)

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
    if (cmd !== '' && isPushing(cmd) && !isError && !isDenied) void startCi($).catch(() => undefined)
    if (delta !== null && !isError && !isDenied) {
      const at = await $.clock.now()
      await setEnv($, v => ({
        ...v,
        files: v.files.map(f => (f.path === path ? { ...f, add: (f.add ?? 0) + delta.add, del: (f.del ?? 0) + delta.del } : f)),
        lastEdit: delta.add + delta.del > 0 ? { path, at, ...delta } : v.lastEdit,
      }))
      await addToday($, { add: delta.add, del: delta.del, langs: langBit(path) })
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
    if (cmd !== '' && !isDenied) await noteCommand($, cmd, isError)

    return ran
  }).catch(($, e, next) => next(e))

  // The chat's title, for the board of chats: Claude Code gives it at the start and with each prompt.
  // A new chat is named after its first prompt, once that prompt has gone: the turn's end reads it from the transcript.
  on('classic.SessionStart', async ($, e, next) => {
    noteTitle(e.session_title, e.transcript_path)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.UserPromptSubmit', async ($, e, next) => {
    noteTitle(e.session_title, e.transcript_path)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.PermissionRequest', async ($, e, next) => {
    const input = typeof e.tool_input === 'object' && e.tool_input !== null ? (e.tool_input as Record<string, unknown>) : {}
    const about = subject({ ...input, tool: e.tool_name })
    const line = `${t().st.awaitingApproval} · ${about}`
    // Mochi cannot see the answer: the call's end tells it (tool.call), and the face it covers comes back then.
    // A question asked while another is still on the face covers what the first covered, not that question.
    const open = chat.perm !== null && chat.perm.token === chat.faceToken ? chat.perm : null
    const { frameAt: _at, ...seen } = await read($, face)
    const covered = open?.face ?? seen
    const was = open?.was ?? chat.faceToken
    const keys = [...(open?.keys ?? []), callKey(e.agent_id, e.tool_name, about)]
    chat.perm = { token: await show($, { mood: 'asking', line, holdMs: 0 }), was, face: covered, keys }
    void noteAsk($, e.tool_name, input).catch(() => undefined)
    if (chat.isBusy && (await $.clock.now()) - chat.turn.startedAt >= ASKS_AFTER_MS) await notify($, line)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) {
      chat.crew.delete(e.agentId)
      await flowMove($, e.agentId, false, e.reason === 'answer')
      return done
    }
    chat.isBusy = false
    chat.stream = null
    const now = await $.clock.now()
    chat.lastActivity = now
    // A turn whose start this chat never saw (Mochi loaded mid-turn) has no length, not one since 1970.
    const turnSecs = chat.turn.startedAt === 0 ? 0 : Math.round((now - chat.turn.startedAt) / 1000)
    chat.lastTurn = { at: now, reason: e.reason, seconds: turnSecs }
    // A foreground subagent's call is over once its turn is: only the background ones run on.
    for (const [id, c] of chat.crew) if (!c.isBackground) chat.crew.delete(id)
    void measure($).catch(() => undefined)
    if (chat.title === '') void readTitle($).catch(() => undefined)
    const ended = onTurnEnd({
      reason: e.reason,
      seconds: turnSecs,
      tools: chat.turn.tools,
      edits: chat.turn.edits,
      errors: chat.turn.errors,
    })
    const before = await read($, env)
    const spent = Math.max(0, before.cost - chat.costAtStart)
    const rec = { at: now, seconds: turnSecs, tools: chat.turn.tools, edits: chat.turn.edits, errors: chat.turn.errors, cost: spent, ctx: before.tokens }
    // The panel's last turn is the line without its "done".
    const head = `${t().st.done} · `
    const last = ended.line.startsWith(head) ? ended.line.slice(head.length) : ended.line
    const after = await update($, env, v => ({ ...v, last, turns: [...v.turns, rec].slice(-40) }))
    chat.isGitWanted = true
    chat.lastTurnFailed = e.reason === 'error'
    void noteTurn($, e.reason, chat.errorRun).catch(() => undefined)
    let finale = chat.flow.finale
    chat.flow.finale = null
    if (chat.pendingWarn > 0) {
      const level = chat.pendingWarn
      chat.pendingWarn = 0
      await show($, { mood: level >= 3 ? 'scared' : 'nervous', line: contextWarning(after, level), holdMs: 12_000, sound: 'alarm' })
    } else if (chat.pendingLimit !== '') {
      await show($, { mood: 'nervous', line: chat.pendingLimit, holdMs: 10_000, sound: 'alarm' })
    } else if (chat.isGoodNight && !['aborted', 'error', 'refusal'].includes(e.reason)) {
      await show($, { mood: 'sleeping', line: t().fun.goodNight, holdMs: 0 })
    } else if (finale !== null && e.reason === 'answer') {
      await show($, finale)
      finale = null
    } else {
      await show($, ended)
    }
    // A workflow's end that no face could show reaches the person as a toast.
    if (finale !== null) $.ui.toast(`Mochi: ${finale.line}`, { timeoutMs: 9000 })
    chat.pendingLimit = ''
    chat.isGoodNight = false
    if (rec.seconds >= LONG_TURN_S && e.reason !== 'aborted') await notify($, ended.line)

    // The day's tally, for the history and the level.
    await addToday($, { turns: 1, tools: chat.turn.tools, edits: chat.turn.edits, errors: chat.turn.errors, cost: spent, secs: rec.seconds, night: season(now, after.tz).isNight ? 1 : 0 })
    await awardTurn($, e.reason, rec.seconds, now)
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
    // A summary made ahead of time, or a subagent's own transcript, leaves this conversation as it is.
    if (e.trigger === 'precompute' || e.agentId !== undefined) return next(e)
    const now = await $.clock.now()
    await show($, { mood: 'squeezed', line: t().st.compacting, holdMs: 0 }, now)
    const done = await next(e).catch(async (err: unknown) => {
      await rest($)
      throw err
    })
    if (done.skip !== undefined) {
      await rest($)
      return done
    }
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
    return { text: command ? await command.run(arg, more.join(' ')) : await statusLines($, p) }
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
    // A wardrobe card or tab is clickable all over: a clear region on it, keyed `tap:` and the button's own key.
    if (e.element.startsWith('tap:')) await pressed($, e.element.slice(4))
    if (e.element === 'arrange') await arranged($, data)
    // A press on the party's floor: how far across it landed, turned into the chat standing there, as the pane drew it.
    if (e.element === 'party' && typeof data === 'object' && data !== null && typeof (data as { fx?: unknown }).fx === 'number') {
      const v = await read($, detail)
      const now = await $.clock.now()
      const key = v.me ? spotAt(floorOf(partyOf({ ...v.me, at: now }, v.peers ?? [], now), now), (data as { fx: number }).fx) : ''
      if (key !== '') await pressed($, `crew:${key}`)
    }
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin === 'mochi') await pressed($, e.element, e.surface)
    return next(e)
  })

  // The details pane's language picker and birthday field.
  on('ui.select', async ($, e, next) => {
    if (e.plugin === 'mochi' && e.element === 'lang') $.ui.toast(`Mochi: ${await language($, plain(e.value), e.value)}`)
    return next(e)
  })

  on('ui.input', async ($, e, next) => {
    if (e.plugin === 'mochi' && e.element === 'bday' && e.kind === 'submit') $.ui.toast(`Mochi: ${await birthday($, plain(e.value) === '' ? 'none' : plain(e.value))}`)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: DETAIL }, detailPane)
  on('ui.render', { component: 'AbovePrompt' }, band)
}
