import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, type Monitor, availableMonitors, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import type { Badge, Ci, DayRec, History, Item, Mood } from '../../types'
import { badgeName, badgeSvg } from '../../hooks/badges'
import { citySvg } from '../../hooks/city'
import { dayKey, local } from '../../hooks/facts'
import { lang, pickLang, setLang } from '../../hooks/i18n'
import { type Choice, type Look, type Slot, addDay, choiceFrom, choiceText, dressAs, itemShort, levelOf, lookFrom, slotName, unlocked, xpOf } from '../../hooks/level'
import { bestOutfit, cardMarkdown, cardSvg } from '../../hooks/share'
import { PEER_INK, appLink, nameOf } from '../../hooks/live'
import { t } from '../../hooks/i18n'
import type { SoundName } from '../../hooks/react'
import { clip } from '../../hooks/sound'
import { type Request, type Sessions, agentPeers, dayFile, hookedOf, isNamedByPrompt, noted, requestOf, settles, stalledOf, tallyOf } from './engine'
import { type Growth, badgesNews, growthOf, historyOf, levelNews } from './growth'
import { type Usage, usageCard, usageLine, usageNews, usageOf, usageRings } from './limits'
import { type News, isMorePressing, newsOf, queued, stillHolds, withoutStalled } from './news'
import { type Area, type Body, type Point, areaOf, fit, isPushedDown, peekAt } from './place'
import { CHANGED, KEY, SIZES, type Settings, loadSettings, settingsFrom, talksAbout } from './settings'
import { COMMIT_STALE_MS, type FolderState, type Ran, ciNow, ciSaid, ciStep, nudgeOf, pushed } from './today'
import { chosen, lookNow, shelvesOf } from './wardrobe'
import { useRules, verdictOf } from './shield'
import { type AgentState, type Step, nextStep, tipNow } from './tour'
import { words } from './words'
import { ROOM, type View, badgeOf, gazeOf, peersOf, rowsOf, stillOf, viewOf } from './world'

/**
 * Mochi's window. It runs nothing on a clock: the app tells it when a hook
 * call came, when a chat's file changed, when a minute passed, and it draws
 * again then. Between two of those it costs nothing.
 */

const root = document.getElementById('root')!
const stage = document.getElementById('stage')!
const say = document.getElementById('say')!
const list = document.getElementById('list')!
const agentsButton = document.getElementById('agents') as HTMLButtonElement
const limitsButton = document.getElementById('limits') as HTMLButtonElement
const win = getCurrentWindow()

/** The gap kept to the screen's edge, in points. */
const EDGE = 12
/** With a limit used this much Mochi is tired while nothing else is going on. */
const TIRED_AT = 95
/** A bubble's answers take a press only this long after they came up. */
const ANSWER_AFTER_MS = 700
/** For how long a request for permission waits on the bubble before Claude Code's own dialog is all there is. */
const APPROVE_S = 30
/** An answer to a press stays up shorter than news. */
const ANSWER_MS = 4000

/** A window with no frame has no console a person can open: what fails is said on the app's own error output. */
const note = (what: unknown) => void invoke('note', { text: what instanceof Error ? `${what.message} ${what.stack ?? ''}` : String(what) }).catch(() => {})
addEventListener('error', e => note(e.error ?? e.message))
addEventListener('unhandledrejection', e => note(e.reason))

let settings: Settings = loadSettings()
let view: View | null = null
/** The chats another Mochi (the mod) writes, as the text of their files. */
let liveTexts: string[] = []
/** Codex and the like, and Claude Code without the mod: known from their hook calls, and written by the app. */
const sessions: Sessions = new Map()
/** The chats the mod writes itself: their hook calls are not the app's to count. */
let theirs = new Set<string>()
/** Where the window's bottom right corner sits (in the unit of `isMac` below): the window stands up and to the left of it. */
let corner: { x: number; y: number } | null = remembered()
/** Where this last put the window, and how large: a move to anywhere else is the person's own. */
let put = { x: 0, y: 0, w: 0, h: 0 }

/** The person's clock, in minutes from UTC, as the mod's records take it. */
const tz = () => -new Date().getTimezoneOffset()

/** The corner the person left the window at, from the last time the app ran; null the first time or when what was kept is not a place. */
function remembered(): { x: number; y: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem('corner') ?? 'null')
    return typeof v?.x === 'number' && typeof v?.y === 'number' ? { x: v.x, y: v.y } : null
  } catch {
    return null
  }
}

// ---------- the look ----------

/** The look the mod writes (look.json), the person's last choice in either Mochi (prefs.json), and what this Mochi wears by them. */
let modLook: Look | null = null
let prefs: Choice | null = null
let look: Look | null = null
function wear(text: string | null) {
  let value: unknown = null
  try {
    value = text === null ? null : JSON.parse(text)
  } catch {
    value = null
  }
  modLook = lookFrom(value)
  dress()
}

/** Dresses Mochi again by what it knows now; drawn afresh only if that changed what it wears. */
function dress() {
  const was = JSON.stringify(look)
  look = lookNow(history, modLook, prefs, tz())
  if (JSON.stringify(look) === was || !view) return
  view = null
  draw()
}

/** The person chose in the wardrobe: worn at once, and written for the mod's Mochi to wear too. */
function choose(slot: Slot, item: Item | null | undefined) {
  prefs = { at: Date.now(), pick: chosen(prefs?.pick ?? modLook?.pick ?? {}, slot, item) }
  dress()
  drawAgents()
  void invoke('write_shared', { name: 'prefs.json', text: choiceText(prefs) }).catch(note)
}

// ---------- where the window stands ----------

/**
 * Places are kept in the unit the system lays its screens out in: points on
 * macOS, where every screen shares them, and pixels on Windows, where a 2x
 * screen's points would overlap a 1x screen's.
 */
const isMac = /Mac/i.test(navigator.userAgent)

/** A screen's work area in that unit. */
function areaIn(m: Monitor): Area {
  const k = isMac ? m.scaleFactor : 1
  return { x: m.workArea.position.x / k, y: m.workArea.position.y / k, w: m.workArea.size.width / k, h: m.workArea.size.height / k }
}

/**
 * Puts the window's bottom right corner where the person left it, whole on that
 * screen. The window keeps one size whatever Mochi says or shows, so it never
 * jumps; the room around Mochi lets every press through (see `hot`).
 */
async function place() {
  const monitors = await availableMonitors()
  const areas = monitors.map(areaIn)
  let area = corner ? areaOf(corner, areas) : null
  let monitor = area ? monitors[areas.indexOf(area)] : null
  if (!area || !monitor) {
    // The first start, or the screen it was left on is gone: the bottom right of the screen the window is on.
    monitor = await currentMonitor()
    if (!monitor) return
    area = areaIn(monitor)
    const edge = isMac ? EDGE : EDGE * monitor.scaleFactor
    corner = { x: area.x + area.w - edge, y: area.y + area.h - edge }
  }
  // The window's size in points; in pixels on Windows, at the scale of the screen it goes to.
  const w = Math.ceil(root.offsetWidth)
  const h = Math.ceil(root.offsetHeight)
  const k = isMac ? 1 : monitor.scaleFactor
  const size = { w: Math.round(w * k), h: Math.round(h * k) }
  put = { ...(peek ?? fit(corner!, size.w, size.h, area)), ...size }
  if (isMac) {
    await win.setSize(new LogicalSize(w, h))
    await win.setPosition(new LogicalPosition(put.x, put.y))
  } else {
    await win.setSize(new PhysicalSize(size.w, size.h))
    await win.setPosition(new PhysicalPosition(Math.round(put.x), Math.round(put.y)))
  }
}

// ---------- the edge: pushed off the bottom of the screen, Mochi peeks ----------

/** Where the window stands while Mochi peeks, in the window's units; null while it stands whole on the screen. */
let peek: Point | null = null
/** Where the bottom of the screen is in the window while Mochi peeks (CSS pixels from its top): a press below it goes to what is there. */
let peekCut = Infinity
let dropTimer = 0

/** Mochi's body in the window, in the window's units (points on macOS, pixels at the screen's scale elsewhere). */
function bodyIn(k: number): Body {
  const s = stage.getBoundingClientRect()
  const unit = s.width / (100 + ROOM.left + ROOM.right)
  return { x: (s.left + (ROOM.left + 10) * unit) * k, y: (s.top + (ROOM.top + 14) * unit) * k, w: 80 * unit * k, h: 84 * unit * k }
}

/** After the person lets go of the window: pushed more than halfway off the bottom, Mochi peeks; pulled back up, it stands again. */
async function dropped() {
  const monitors = await availableMonitors()
  const areas = monitors.map(areaIn)
  const k = isMac ? 1 : (await currentMonitor())?.scaleFactor ?? 1
  const body = bodyIn(k)
  const at = { x: put.x, y: put.y }
  const area = areaOf({ x: at.x + body.x + body.w / 2, y: at.y + body.y }, areas)
  if (!area || !isPushedDown(at, body, area)) {
    if (peek) standUp(false)
    return
  }
  toggleAgents(false)
  peek = peekAt(at, body, area)
  peekCut = (area.y + area.h - peek.y) / k
  root.classList.add('peek')
  await place()
  hot()
}

/** Mochi comes back up from the edge, just above it, to be pressed or to speak. */
function standUp(isPlaced = true) {
  if (!peek) return
  corner = { x: peek.x + put.w, y: peek.y + peekCut * (isMac ? 1 : put.h / root.offsetHeight) - EDGE }
  peek = null
  peekCut = Infinity
  root.classList.remove('peek')
  if (isPlaced) void place().then(hot).catch(note)
}

/**
 * Tells the app where a press is Mochi's own: Mochi's body, and what it says
 * or shows. Everywhere else in the window a press goes to what is behind.
 */
function hot() {
  const rects: number[][] = []
  const s = stage.getBoundingClientRect()
  // Mochi's own square inside the drawing's room, and its body inside that square.
  const unit = s.width / (100 + ROOM.left + ROOM.right)
  // Peeking, only what shows above the bottom of the screen: below it is the Dock or the taskbar, and a press there is theirs.
  const top = s.top + (ROOM.top + 14) * unit
  rects.push([s.left + (ROOM.left + 10) * unit, top, 80 * unit, Math.max(0, Math.min(84 * unit, peekCut - top))])
  for (const el of [say, list, agentsButton, limitsButton]) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) rects.push([r.left, r.top, r.width, r.height])
  }
  void invoke('set_hot', { rects }).catch(note)
}

// ---------- what Mochi says ----------

/** The dot before what Mochi says, in the ink the band gives that news: waiting, done, failed; grey for an answer to a press. */
const NEWS_INK: Record<News['kind'], string> = { asking: PEER_INK.asking, done: '#4CC38A', failed: PEER_INK.error, limit: '#F2B84B', back: '#4CC38A', level: '#B794F6', nudge: '#F2B84B' }
const QUIET_INK = PEER_INK.idle

/** News waiting its turn, the most pressing first. */
let queue: News[] = []
/** The news in the bubble now; null with an answer to a press, or nothing, in it. */
let saying: News | null = null
let hushTimer = 0

/** The sound that goes with each kind of news: a bell for a chat that waits or finished, a sigh for one that failed, a ding-dong for a limit, a flourish when it is back. */
const NEWS_SOUND: Record<News['kind'], SoundName> = { asking: 'ding', done: 'ding', failed: 'oops', limit: 'alarm', back: 'party', level: 'party', nudge: 'ding' }

function chime(name: SoundName) {
  if (!settings.sound) return
  // A sound the system will not play (no press yet, no output) is one Mochi goes without.
  void new Audio(`data:audio/wav;base64,${clip(name)}`).play().catch(() => {})
}

// ---------- Mochi moves when something happens, and holds still the rest of the time ----------

/**
 * The drawing's own motion (breathing, typing, blinking) redraws all of Mochi
 * sixty times a second, which costs a fifth of a processor core for as long as
 * it runs. So it runs in short stretches: when the mood changes, when Mochi
 * speaks, when the pointer comes over it, a moment each minute, and now and
 * then while a chat works. In between Mochi is a drawing with no motion in it
 * (`stillOf`), which costs nothing.
 */
const MOVES_MS = 2400
/** While a chat works, Mochi moves again no sooner than this after it last did. */
const WORK_REST_MS = 20_000
/** While a chat works its Mochi changes what it does every few seconds: each change is eased in and held, not played out. */
const WORK_MOVES_MS = 900
let stillTimer = 0
let movedAt = 0
let isStill = false

/** Shows a drawing, the eyes where they were turned. */
function show(svg: string) {
  stage.innerHTML = svg
  gaze()
}

/** Lets Mochi move for a while: `svg` is what to show while it does (the pose itself when none is given), and then it holds still. */
/** The person asked their system for less motion: Mochi changes pose without playing its moves. */
const calm = matchMedia('(prefers-reduced-motion: reduce)')

function move(ms = MOVES_MS, svg: string | null = null) {
  if (!view) return
  if (calm.matches) return show(stillOf(svg ?? view.rest))
  movedAt = Date.now()
  if (svg !== null || isStill) show(svg ?? view.rest)
  isStill = false
  clearTimeout(stillTimer)
  stillTimer = window.setTimeout(() => {
    if (!view) return
    isStill = true
    show(stillOf(view.rest))
  }, ms)
}

/** A small hop, to catch the eye when Mochi has something to say. */
function hop() {
  move()
  stage.classList.remove('hop')
  // Read back so the same hop can start again while the last one is still going.
  void stage.offsetWidth
  stage.classList.add('hop')
}

// ---------- a mood held for a moment ----------

/** A mood Mochi keeps for a moment whatever the chats say: a pat, a limit that is back. */
let held: { mood: Mood; until: number } | null = null
let heldTimer = 0

function hold(mood: Mood, ms: number) {
  held = { mood, until: Date.now() + ms }
  clearTimeout(heldTimer)
  heldTimer = window.setTimeout(() => {
    held = null
    draw()
  }, ms)
  draw()
}

/** What a bubble holds besides its words: what a request is for, and the answers to press. */
type Extra = { what?: string; acts?: { label: string; isMain?: boolean; run: () => void }[] }

function speak(text: string, ms: number, ink: string, news: News | null, extra: Extra = {}) {
  saidAt = Date.now()
  if (news) {
    hop()
    chime(NEWS_SOUND[news.kind])
    if (news.kind === 'back' || news.kind === 'level') hold('party', 4000)
  }
  saying = news
  const drawnAt = Date.now()
  say.style.setProperty('--ink', ink)
  say.replaceChildren(text)
  if (extra.what) {
    const what = document.createElement('code')
    what.className = 'what'
    what.textContent = extra.what
    say.append(what)
  }
  if (extra.acts?.length) {
    const acts = document.createElement('div')
    acts.className = 'acts'
    for (const act of extra.acts) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = act.label
      if (act.isMain) button.className = 'main'
      button.addEventListener('click', e => {
        e.stopPropagation()
        // An answer counts only a moment after it came up: a second press meant for the bubble before never lands on this one unread.
        if (Date.now() - drawnAt >= ANSWER_AFTER_MS) act.run()
      })
      acts.append(button)
    }
    say.append(acts)
  }
  say.classList.toggle('link', (news?.link ?? '') !== '')
  say.classList.add('on')
  clearTimeout(hushTimer)
  hushTimer = window.setTimeout(sayNext, ms)
  hot()
}

// ---------- requests for permission, answered here ----------

/** The requests whose hooks wait on the bubble now, by the chat that asks. */
const requests = new Map<string, Request>()

/** Gives a request its answer, or lets its hook go with none ("none": the chat went on by itself, or the person looked away). */
function answer(request: Request, behavior: 'allow' | 'deny' | 'none') {
  if (requests.get(request.chat)?.id === request.id) requests.delete(request.chat)
  void invoke('answer', { id: request.id, behavior }).catch(note)
}

/** A chat's waiting request, if its hook still waits. */
function requestFor(chat: string, now: number): Request | null {
  const request = requests.get(chat)
  if (request && request.until <= now) requests.delete(chat)
  return request && request.until > now ? request : null
}

/** Says news; a chat that waits with a request the bubble may answer is said with what it asks for and the answers. */
function tell(news: News) {
  // News brings Mochi up from the edge to say it.
  standUp()
  const now = Date.now()
  const request = news.kind === 'asking' ? requestFor(news.id, now) : null
  if (!request) return speak(news.line, settings.talkSeconds * 1000, NEWS_INK[news.kind], news)
  const w = words()
  const done = (behavior: 'allow' | 'deny') => () => {
    answer(request, behavior)
    sayNext()
  }
  speak(`${news.line}\n${w.wantsTo(request.tool)}`, request.until - now, NEWS_INK.asking, news, {
    what: request.what,
    acts: [...(request.canAllow ? [{ label: w.allow, isMain: true, run: done('allow') }] : []), { label: w.deny, run: done('deny') }],
  })
}

/** The next news in the bubble, or the bubble away when all is said. */
function sayNext() {
  clearTimeout(hushTimer)
  const next = queue.shift()
  if (next) return tell(next)
  saying = null
  say.classList.remove('on')
  hot()
}

/** Takes in what changed among the chats; what no longer holds is dropped, and more pressing news does not wait for lesser news to finish. */
function hear(fresh: News[], peers: View['peers'], isRequest = false) {
  // A request's own news is said even if the chat's file does not say it waits yet: its hook waits, which is the same.
  queue = queued(queue, fresh).filter(n => stillHolds(n, peers) || requests.has(n.id))
  // The request in the bubble now is said again with its answers.
  if (isRequest && saying && fresh.some(n => n.id === saying!.id)) return sayNext()
  if (saying && !stillHolds(saying, peers) && !requests.has(saying.id)) return sayNext()
  const first = queue[0]
  if (!first) return
  // Nothing up, or only something Mochi says of itself (a step of the first meeting, a tip): the news goes first; a step comes back.
  if (!say.classList.contains('on') || saying === null) return sayNext()
  if (saying && isMorePressing(first, saying)) {
    queue = queued(queue, [saying])
    sayNext()
  }
}

// A press on what Mochi says opens the chat it is about, and brings the next news.
say.addEventListener('pointerdown', e => e.stopPropagation())
say.addEventListener('click', () => {
  if (saying?.link) void openUrl(saying.link)
  // A request stays up while the person goes to look: it is answered there or here.
  if (!(saying && requests.has(saying.id))) sayNext()
})

// ---------- the agents ----------

// ---------- what the work has added up to ----------

/** The one history, counted from every chat's days, and the badges won; null until first counted. */
let history: History | null = null
let badges: Badge[] = []
let countedAt = 0

/**
 * Counts the history again from every chat's days, and keeps what it shows of the level and the badges.
 * A level or a badge that is new since it was last kept is said, once, by whichever Mochi saw it first.
 */
async function count() {
  const now = Date.now()
  countedAt = now
  history = historyOf(await invoke<string[]>('read_all_days'), dayKey(now, tz()))
  // undefined: the file is there but cannot be read now. Left for next time; read as none, it would be written over with less.
  const kept = (name: string) => invoke<string | null>('read_shared', { name }).catch(() => undefined)
  const keptLevel = await kept('level.json')
  const level = keptLevel === undefined ? { line: null, keep: null } : levelNews(keptLevel, history)
  if (level.keep) await invoke('write_shared', { name: 'level.json', text: level.keep })
  const keptBadges = await kept('badges.json')
  const won = keptBadges === undefined ? { line: null, keep: null } : badgesNews(keptBadges, history)
  if (won.keep) await invoke('write_shared', { name: 'badges.json', text: won.keep })
  if ('badges' in won && won.badges) badges = won.badges
  dress()
  // Said by one Mochi: the mod claims the same news under the same names and numbers. Claimed only by a Mochi on screen, which
  // says it: hidden, it leaves the news to the band.
  const h = history
  const canSay = view !== null && (await win.isVisible().catch(() => false))
  const said = (line: string | null, name: string, at: number) => (line === null || !canSay ? Promise.resolve(null) : invoke<boolean>('claim', { name, at }).then(ok => (ok ? line : null), () => null))
  const lines = (await Promise.all([
    said(level.line, 'said-level', levelOf(xpOf(h)).level * 1000 + unlocked(h).length),
    said(won.line, 'said-badges', badges.length),
  ])).filter((l): l is string => l !== null)
  if (lines.length > 0 && view) hear([{ id: 'level', kind: 'level', line: lines.join(' · '), link: '' }], view.peers)
  if (list.classList.contains('on')) drawAgents()
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

/** The pocket's Mochi side: the level and how far to the next, the streak and today, the badges, and the last weeks as a city. */
function drawGrowth(into: HTMLElement) {
  if (!history) return
  const g: Growth = growthOf(history)
  const d = t().detail
  const level = el('div', 'level')
  level.append(el('b', '', d.levelN(g.level)), el('span', '', d.toNext(String(g.toNext))))
  const bar = el('div', 'bar')
  const fill = el('i')
  fill.style.width = `${Math.round((g.into / Math.max(1, g.span)) * 100)}%`
  bar.append(fill)
  const facts = el('div', 'facts')
  for (const [value, label] of [[g.streak, d.streak], [g.today, d.today], [g.activeDays, t().share.activeDays]] as const) {
    const fact = el('div')
    fact.append(el('b', '', String(value)), el('span', '', label))
    facts.append(fact)
  }
  into.append(level, bar, facts)
  if (g.turns === 0) return void into.append(el('p', 'empty', words().noWork))
  if (badges.length > 0) {
    const medals = el('div', 'medals')
    for (const b of badges) {
      const medal = el('span')
      // The medal is the mod's own drawing.
      medal.innerHTML = badgeSvg(b, true)
      medal.title = badgeName(b)
      medals.append(medal)
    }
    into.append(medals)
  }
  if (look) into.append(drawWardrobe(look))
  into.append(drawShare())
  const now = Date.now()
  const city = el('div', 'city')
  // The city is the mod's own drawing too, held still like Mochi: whatever twinkles in it would redraw the window for as long as the pocket is open.
  city.innerHTML = stillOf(citySvg(history.days, dayKey(now, tz()), local(now, tz()).hour, 314).svg)
  into.append(city)
}

/** The card to share, as the mod makes it with /mochi card: saved, shown in the file manager, and the line for a GitHub profile copied. */
function drawShare(): HTMLElement {
  const b = el('button', 'share', words().card)
  b.type = 'button'
  b.addEventListener('click', () => void (async () => {
    const outfit = look ? dressAs(look, 'idle', Date.now()) : bestOutfit([])
    const path = await invoke<string | null>('save_share', { name: 'mochi-card.svg', svg: cardSvg(history, outfit) })
    if (path === null) return void speak(t().share.failed('~/.claude/mochi/share'), 6000, NEWS_INK.failed, null)
    await navigator.clipboard.writeText(cardMarkdown('mochi-card.svg')).catch(() => undefined)
    speak(`${t().share.cardSaved(path)} ${words().cardCopied}`, 9000, NEWS_INK.level, null)
  })().catch(note))
  return b
}

/** The wardrobe: each slot with something open, Mochi's own pick, nothing, or an item. What is worn now is pressed. */
function drawWardrobe(l: Look): HTMLElement {
  const box = el('div', 'wardrobe')
  box.append(el('h3', '', t().ui.wardrobe))
  for (const shelf of shelvesOf(l.items)) {
    const row = el('div', 'shelf')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', slotName(shelf.slot))
    row.append(el('span', '', slotName(shelf.slot)))
    const choices: [string, Item | null | undefined][] = [[t().ui.auto, undefined], [t().ui.nothing, null], ...shelf.items.map((i): [string, Item] => [itemShort(i), i])]
    for (const [label, item] of choices) {
      const b = el('button', '', label)
      b.type = 'button'
      b.setAttribute('aria-pressed', String(l.pick[shelf.slot] === item))
      b.addEventListener('click', () => choose(shelf.slot, item))
      row.append(b)
    }
    box.append(row)
  }
  return box
}

/** Which side of the pocket is open. */
let side: 'now' | 'mochi' = 'now'

/** Fills the list of agents from what was last read, and the count at Mochi's feet. */
function drawAgents() {
  const rows = view ? rowsOf(view.peers, Date.now(), settings.idleMinutes * 60_000) : []
  const w = words()
  const badge = badgeOf(rows)
  const dot = document.createElement('span')
  dot.className = badge?.isAsking ? 'dot asking' : 'dot'
  dot.style.setProperty('--ink', badge?.ink ?? QUIET_INK)
  const number = document.createElement('span')
  number.textContent = String(badge?.count ?? 0)
  agentsButton.replaceChildren(dot, number)
  agentsButton.classList.toggle('empty', rows.length === 0)
  agentsButton.title = `${w.agents} · ${rows.length}`
  agentsButton.setAttribute('aria-label', `${w.agents} · ${rows.length}`)
  if (!list.classList.contains('on')) return
  list.replaceChildren()
  const tabs = el('div')
  tabs.id = 'tabs'
  tabs.setAttribute('role', 'tablist')
  for (const name of ['now', 'mochi'] as const) {
    const tab = el('button', '', t().pane.tabs[name])
    tab.type = 'button'
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-selected', String(side === name))
    tab.addEventListener('click', () => {
      side = name
      // Counted again when it is looked at, if that was a while ago: other chats work too.
      if (name === 'mochi' && Date.now() - countedAt > 5 * 60_000) void count().catch(note)
      drawAgents()
      hot()
    })
    tabs.append(tab)
  }
  list.append(tabs)
  if (side === 'mochi') return drawGrowth(list)
  const use = document.createElement('div')
  use.id = 'use'
  for (const u of usage) {
    const card = usageCard(u, Date.now())
    const item = document.createElement('div')
    item.className = 'use'
    // The ring is the mod's own drawing; the words beside it are set as text.
    item.innerHTML = card.ring
    const words = document.createElement('div')
    const name = document.createElement('b')
    name.textContent = card.name
    const back = document.createElement('span')
    back.textContent = card.back
    words.append(name, back)
    item.append(words)
    use.append(item)
  }
  list.append(use)
  const title = document.createElement('h2')
  title.textContent = `${w.agents} · ${rows.length}`
  list.append(title)
  if (rows.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = w.noAgents
    list.append(empty)
  }
  for (const row of rows) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'agent'
    if (row.link) {
      item.dataset.link = row.link
      item.title = w.openHint
    } else {
      item.tabIndex = -1
      item.title = w.notHere(w.where[row.where as 'codex' | 'terminal'])
    }
    const dot = document.createElement('span')
    dot.className = 'dot'
    dot.style.background = row.ink
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = row.name
    const line = document.createElement('span')
    line.className = 'line'
    // Where a chat a press cannot open runs, beside how it stands.
    line.textContent = row.where === 'app' ? row.line : `${row.line} · ${w.where[row.where]}`
    item.append(dot, name, line)
    if (row.plan) item.append(el('span', 'plan', row.plan))
    for (const a of row.agents) {
      const sub = document.createElement('span')
      sub.className = 'sub'
      sub.textContent = a.task ? `${a.type} · ${a.task}` : a.type
      item.append(sub)
    }
    list.append(item)
  }
}

function toggleAgents(on = !list.classList.contains('on')) {
  list.classList.toggle('on', on)
  agentsButton.setAttribute('aria-expanded', String(on))
  drawAgents()
  hot()
}

agentsButton.addEventListener('pointerdown', e => e.stopPropagation())
agentsButton.addEventListener('click', () => toggleAgents())
list.addEventListener('pointerdown', e => e.stopPropagation())
list.addEventListener('click', e => {
  const link = (e.target as HTMLElement).closest<HTMLElement>('.agent')?.dataset.link
  if (link) {
    void openUrl(link)
    toggleAgents(false)
  }
})
addEventListener('keydown', e => {
  if (e.key === 'Escape' && list.classList.contains('on')) toggleAgents(false)
})

// ---------- the limits ----------

/** The usage limits as last drawn. */
let usage: Usage[] = []

function drawLimits(next: Usage[], now: number) {
  usage = next
  const rings = usageRings(usage, now)
  if (limitsButton.innerHTML !== rings) limitsButton.innerHTML = rings
  const label = usage.map(u => usageLine(u, now)).join(' · ')
  limitsButton.title = label
  limitsButton.setAttribute('aria-label', label === '' ? words().limits : `${words().limits}: ${label}`)
}

// A press on the rings opens the list, where each limit stands in full.
limitsButton.addEventListener('pointerdown', e => e.stopPropagation())
limitsButton.addEventListener('click', () => toggleAgents())

// ---------- the chats the app follows itself ----------

/** What each chat earned since its days were last written, day by day, with the chat's name. */
const earned = new Map<string, { label: string; isLabelFromPrompt: boolean; days: Record<string, Partial<DayRec>> }>()

/** Writes one after another, so two turns ending together never both start from the same file. */
let writing: Promise<unknown> = Promise.resolve()

/** Adds what a chat earned to its days file, the file the mod keeps for a chat of its own. */
function keepDays(id: string) {
  const mine = earned.get(id)
  if (!mine) return
  earned.delete(id)
  writing = writing.then(async () => {
    let text = await invoke<string | null>('read_days', { id })
    for (const [day, rec] of Object.entries(mine.days)) text = dayFile(text, id, mine.label, mine.isLabelFromPrompt, day, rec)
    if (text !== null) await invoke('write_days', { id, text })
    // What was just earned may be a level or a badge.
    await count()
  }).catch(note)
}

/** A chat the mod writes is the mod's to follow and to count: the app lets go of it. */
function leave(id: string) {
  sessions.delete(id)
  earned.delete(id)
}

/** Takes in hook calls: where each chat stands now, and what the call earned. */
async function take(calls: string[]) {
  const asked: Request[] = []
  for (const call of calls) {
    const h = hookedOf(call)
    if (!h) continue
    // A shell command waiting on the shield: named now, while it waits, or let go at once.
    if (h.ask && h.name === 'PreToolUse') shield(h.id, h.ask.id, h.event)
    // A request waits on the bubble whoever follows its chat, the mod or the app.
    const request = requestOf(h)
    if (request && settings.approve) {
      requests.set(request.chat, request)
      asked.push(request)
    } else if (requests.has(h.id) && settles(h)) {
      // The chat went on: the request was answered in its own window. Its hook is let go.
      answer(requests.get(h.id)!, 'none')
    }
    if (theirs.has(h.id)) continue
    const cwd = typeof h.event.cwd === 'string' ? h.event.cwd : ''
    if (cwd !== '') {
      // The folder's repository, for the stand-up: noted once an hour, as the mod does.
      if ((repoSeen.get(cwd) ?? 0) < h.at - 3_600_000) {
        repoSeen.set(cwd, h.at)
        void invoke('see_repo', { cwd }).catch(note)
      }
      if (pushed(h.event)) watchCi(h.id, cwd, h.at)
    }
    const before = sessions.get(h.id)
    const rec = tallyOf(h, before, tz())
    noted(sessions, h)
    if (rec) {
      const mine = earned.get(h.id) ?? { label: '', isLabelFromPrompt: false, days: {} }
      const day = dayKey(h.at, tz())
      const chat = sessions.get(h.id) ?? before
      if (chat) {
        mine.label = chat.label
        mine.isLabelFromPrompt = isNamedByPrompt(chat)
      }
      mine.days[day] = addDay(mine.days[day] ?? {}, rec)
      earned.set(h.id, mine)
    }
    // What a turn earned is written when it ends, as the mod does; and when the chat closes, whatever is left.
    if (rec?.turns || h.name === 'SessionEnd') keepDays(h.id)
    if (rec?.turns && cwd !== '') void nudge(h.id, cwd).catch(note)
  }
  // The chats as they stand now, for every other Mochi to read; the app is told which of them the mod writes itself.
  for (const id of await invoke<string[]>('own_live', { peers: agentPeers(sessions, Date.now()) }).catch(() => [])) leave(id)
  draw()
  // Each request is said now, with its answers: the news of the chat starting to wait may have come before it, without them.
  if (asked.length > 0 && view) {
    const peers = view.peers
    hear(asked.map(r => {
      const chat = peers.find(p => p.id === r.chat)
      return { id: r.chat, kind: 'asking' as const, line: t().peer.waiting(chat ? nameOf(chat) : t().word.chat), link: appLink(chat?.app) }
    }), peers, true)
  }
}

// ---------- the first meeting, and a tip now and then ----------

/** When Mochi last said anything: a tip waits for it to have been quiet a while. */
let saidAt = Date.now()

const seenSteps = (): Set<string> => {
  try {
    const seen = new Set<string>(JSON.parse(localStorage.getItem('tour') ?? '[]') as string[])
    // Asked before there was a tour.
    if (localStorage.getItem('asked-approve') !== null) seen.add('approve')
    return seen
  } catch {
    return new Set()
  }
}

/** A newer version to tell of, once it can be said: when no news is up. */
let newer: [string, string] | null = null
function sayNewer() {
  if (!newer || isBusy()) return
  const [version, url] = newer
  newer = null
  if (localStorage.getItem('newer') === version) return
  localStorage.setItem('newer', version)
  const w = words()
  speak(w.newer(version), 30_000, NEWS_INK.level, null, { acts: [{ label: w.get, isMain: true, run: () => { void openUrl(url); sayNext() } }, { label: w.notNow, run: sayNext }] })
}

/** Whether Mochi is saying news, or has news waiting: what it says of itself waits for it. */
const isBusy = () => saying !== null || queue.length > 0

/** The next step of the first meeting, said with its answers; each answer takes the person to the step after. Said only
 * while no news is up or waiting; tried again each minute until it is. */
async function meet() {
  if (isBusy()) return
  const seen = seenSteps()
  const state = (agent: string) => invoke<AgentState>('agent_state', { agent }).catch((): AgentState => 'broken')
  const step = nextStep(seen, { claude: await state('claude'), codex: await state('codex') })
  if (step === null) return
  const w = words()
  const then = (run?: () => unknown) => () => {
    seen.add(step)
    localStorage.setItem('tour', JSON.stringify([...seen]))
    void Promise.resolve(run?.()).catch(note).finally(() => {
      sayNext()
      void meet().catch(note)
    })
  }
  const choose = (approve: boolean) => () => {
    localStorage.setItem('asked-approve', '1')
    const next = { ...settings, approve }
    localStorage.setItem(KEY, JSON.stringify(next))
    return apply(next)
  }
  const connect = (agent: 'claude' | 'codex') => () => invoke('set_agent', { agent, on: true })
  const later = { label: w.notNow, run: then() }
  const asks: Record<Step, [string, Extra['acts']]> = {
    hello: [w.tour.hello, [{ label: w.tour.next, isMain: true, run: then() }]],
    claude: [w.tour.claude, [{ label: w.connect, isMain: true, run: then(connect('claude')) }, later]],
    codex: [w.tour.codex, [{ label: w.connect, isMain: true, run: then(connect('codex')) }, later]],
    approve: [w.approveAsk, [{ label: w.yes, isMain: true, run: then(choose(true)) }, { label: w.notNow, run: then(choose(false)) }]],
    pocket: [w.tour.pocket, [{ label: w.tour.next, isMain: true, run: then() }]],
  }
  const [line, acts] = asks[step]
  if (isBusy()) return
  speak(line, 120_000, QUIET_INK, null, { acts })
}

/** One thing more Mochi can do, said when it has been quiet a while, a day after the last. */
function tip() {
  let told: string[] = []
  try {
    told = JSON.parse(localStorage.getItem('tips') ?? '[]') as string[]
  } catch {
    told = []
  }
  const now = Date.now()
  const today = dayKey(now, tz())
  const next = tipNow(told, localStorage.getItem('tipDay') ?? '', today, saidAt, now, nextStep(seenSteps(), { claude: 'on', codex: 'on' }) === null)
  if (next === null || isBusy() || peek) return
  localStorage.setItem('tips', JSON.stringify([...told, next]))
  localStorage.setItem('tipDay', today)
  speak(words().tips[next], settings.talkSeconds * 1000 + 4000, QUIET_INK, null)
}

// ---------- the shield ----------

/** Answers a shell command waiting on the shield: Claude Code asks the person first, with what it would do, and Mochi says so too. */
function shield(chat: string, id: string, event: Record<string, unknown>) {
  const why = verdictOf(event)
  void invoke('answer', { id, behavior: why === null ? 'none' : 'ask', why }).catch(note)
  if (why === null || !view) return
  const peer = view.peers.find(p => p.id === chat)
  hear([{ id: `shield-${chat}`, kind: 'failed', line: words().careful(why), link: appLink(peer?.app) }], view.peers)
}

/** The person's own shield rules (shield.json), read again now and then: they write it by hand. */
let rulesAt = 0
function readRules() {
  rulesAt = Date.now()
  void invoke<string | null>('read_shield').then(useRules, note)
}

// ---------- said of a chat's folder: its CI, and changes left uncommitted ----------

const repoSeen = new Map<string, number>()
/** The pushes whose CI is watched, by folder: looked at every 20 seconds while it runs, for half an hour at most. */
const watching = new Map<string, number>()
const CI_EVERY_MS = 20_000

function watchCi(chat: string, cwd: string, pushedAt: number) {
  clearTimeout(watching.get(cwd))
  // The commit pushed, taken at the first look: a commit made after it is not the one to say of.
  let sha: string | null = null
  const look = async () => {
    const ran = await invoke<{ sha?: unknown; out?: Ran } | null>('ci', { cwd, sha }).catch(() => null)
    if (sha === null && typeof ran?.sha === 'string') sha = ran.sha
    const ci = ciNow(ran, pushedAt)
    const step = ciStep(ci, Date.now() - pushedAt)
    if (step !== 'again') {
      watching.delete(cwd)
      return step === 'say' && ci ? sayCi(chat, ci) : undefined
    }
    watching.set(cwd, window.setTimeout(() => void look().catch(note), CI_EVERY_MS))
  }
  watching.set(cwd, window.setTimeout(() => void look().catch(note), CI_EVERY_MS))
}

function sayCi(chat: string, ci: Ci) {
  const kind = ci.state === 'failed' ? 'failed' : 'done'
  if (!view || !talksAbout(settings, kind)) return
  const peer = view.peers.find(p => p.id === chat)
  hear([{ id: `ci-${chat}`, kind, line: `${peer ? nameOf(peer) : t().word.chat}: ${ciSaid(ci).line}`, link: appLink(peer?.app) }], view.peers)
}

/** The repositories last nudged to commit, so a nudge is said once in the time it waits for. */
const nudgedAt = new Map<string, number>()

async function nudge(chat: string, cwd: string) {
  const state = await invoke<FolderState | null>('git_state', { cwd }).catch(() => null)
  const now = Date.now()
  const line = nudgeOf(state, now)
  if (line === null || state === null || now - (nudgedAt.get(state.root) ?? 0) < COMMIT_STALE_MS || !view || !talksAbout(settings, 'nudge')) return
  nudgedAt.set(state.root, now)
  const peer = view.peers.find(p => p.id === chat)
  hear([{ id: `nudge-${state.root}`, kind: 'nudge', line, link: appLink(peer?.app) }], view.peers)
}

// ---------- the drawing ----------

function draw() {
  const now = Date.now()
  const others = peersOf(liveTexts, now)
  theirs = new Set(others.map(p => p.id))
  for (const id of theirs) leave(id)
  const peers = [...others, ...agentPeers(sessions, now)]
  const before = view
  const next = viewOf(peers, now, look, { was: before, held: held && held.until > now ? held.mood : null, isTired: usageOf(peers, now).some(u => u.p >= TIRED_AT) })
  view = next
  // A new pose comes to the screen eased in from the last; the same pose is left as it is.
  const isAtWork = peers.some(p => p.state === 'busy')
  if (!before || next.svg !== before.svg) {
    move(before && isAtWork && before.peers.some(p => p.state === 'busy') ? WORK_MOVES_MS : MOVES_MS, next.svg)
  } else if (isAtWork && now - movedAt >= WORK_REST_MS) {
    // A chat at work: Mochi works along for a moment, now and then.
    move(1300)
  }
  stage.setAttribute('aria-label', next.line)
  watch(next.mood)
  drawAgents()
  const usedBefore = usage
  drawLimits(usageOf(next.peers, now), now)
  if (before) {
    // A chat taken as stopped because it went silent is at rest, which is no news of a turn that finished.
    hear([...withoutStalled(newsOf(before.peers, next.peers, now), stalledOf(sessions, now)), ...usageNews(usedBefore, usage, now)].filter(n => talksAbout(settings, n.kind)), next.peers)
  }
  hot()
}

// ---------- the eyes ----------

/** The moods in which Mochi looks about: awake, and not busy with a face of its own. */
const LOOKS_ABOUT: readonly Mood[] = ['idle', 'listening', 'waiting', 'asking', 'proud', 'pleased', 'thinking', 'reading', 'searching', 'writing', 'running', 'web', 'agent', 'nervous']
/** Where the pointer was last said to be, in the window's points. */
let pointer: { x: number; y: number } | null = null
let isGazing: boolean | null = null

/** Turns the eyes toward the pointer. The eyes are the drawing's own group; only where they sit is moved. */
function gaze() {
  const eyes = stage.querySelector<SVGGElement>('g[transform="translate(0 -52)"]')
  if (!eyes) return
  const s = stage.getBoundingClientRect()
  const unit = s.width / (100 + ROOM.left + ROOM.right)
  const turn = pointer && isGazing ? gazeOf({ x: s.left + (ROOM.left + 50) * unit, y: s.top + (ROOM.top + 52) * unit }, pointer) : { dx: 0, dy: 0 }
  eyes.style.translate = `${turn.dx}px ${turn.dy}px`
}

/** The app says where the pointer is only while Mochi looks about, and never to someone who asked for less motion. */
function watch(mood: Mood) {
  const on = LOOKS_ABOUT.includes(mood) && !matchMedia('(prefers-reduced-motion: reduce)').matches
  if (on !== isGazing) void invoke('gaze', { on }).catch(note)
  isGazing = on
  gaze()
}

// ---------- settings ----------

async function apply(next: Settings) {
  settings = next
  setLang(settings.lang === 'auto' ? (pickLang(navigator.language) ?? 'en') : settings.lang)
  // Read aloud in its language, and Arabic right to left.
  document.documentElement.lang = lang()
  document.documentElement.dir = lang() === 'ar' ? 'rtl' : 'ltr'
  root.style.setProperty('--size', `${SIZES[settings.size]}px`)
  agentsButton.hidden = !settings.showAgents
  if (!settings.showAgents) list.classList.remove('on')
  await invoke('on_top', { on: settings.onTop }).catch(note)
  await invoke('set_approve', { seconds: settings.approve ? APPROVE_S : 0 }).catch(note)
  await invoke('set_shield', { on: settings.shield }).catch(note)
  if (!settings.approve) for (const request of [...requests.values()]) answer(request, 'none')
  // A language or a size changes the drawing and the words: draw them again, and stand where the new size fits.
  view = null
  draw()
  await place()
  hot()
}

void listen(CHANGED, e => void apply(settingsFrom(JSON.stringify(e.payload))))
void listen('reset-place', () => {
  corner = null
  try {
    localStorage.removeItem('corner')
  } catch {
    // Not kept: it is forgotten when the app quits all the same.
  }
  void place()
})
// Changed in another window of the app while this one did not hear it: read it again.
addEventListener('storage', e => {
  if (e.key === KEY) void apply(loadSettings())
})

// ---------- presses ----------

// A pull moves the window; a right press opens the settings.
let pressed: { x: number; y: number } | null = null
stage.addEventListener('pointerdown', e => {
  if (e.button === 0) pressed = { x: e.screenX, y: e.screenY }
})
addEventListener('pointermove', e => {
  if (!pressed || Math.hypot(e.screenX - pressed.x, e.screenY - pressed.y) < 4) return
  pressed = null
  void win.startDragging()
})
// A press on Mochi opens the list of chats; with none open, Mochi says how it is. Enter or Space does the same.
function pressMochi() {
  if (!view) return
  if (peek) return standUp()
  if (rowsOf(view.peers, Date.now(), settings.idleMinutes * 60_000).length > 0 || usage.length > 0) toggleAgents()
  else speak(view.line, ANSWER_MS, QUIET_INK, null)
}
stage.addEventListener('pointerup', () => {
  if (!pressed) return
  pressed = null
  pressMochi()
})
stage.addEventListener('keydown', e => {
  if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return
  e.preventDefault()
  pressMochi()
})
// The pointer comes over Mochi: it stirs.
stage.addEventListener('pointerenter', () => move())
// A pat: two quick presses, and Mochi is pleased for a moment.
stage.addEventListener('dblclick', () => {
  toggleAgents(false)
  hold('love', 2600)
  chime('ding')
})
addEventListener('contextmenu', e => {
  e.preventDefault()
  void invoke('open_settings')
})

async function start() {
  await apply(settings)
  await listen<string[]>('calls', e => void take(e.payload).catch(note))
  await listen<string[]>('live', e => {
    liveTexts = e.payload
    draw()
  })
  await listen<string | null>('look', e => {
    wear(e.payload)
    view = null
    draw()
  })
  await listen<string | null>('prefs', e => {
    prefs = choiceFrom(e.payload)
    dress()
    if (side === 'mochi') drawAgents()
  })
  // What only time changes: a chat silent too long is at rest or gone, and the file the app keeps of it must say so too.
  await listen<[number, number]>('pointer', e => {
    pointer = { x: e.payload[0], y: e.payload[1] }
    gaze()
  })
  readRules()
  // Told once for each version: a newer Mochi, and where to get it.
  await listen<[string, string]>('newer', e => {
    newer = e.payload
    sayNewer()
  })
  await listen('minute', () => {
    if (Date.now() - rulesAt > 5 * 60_000) readRules()
    if (!isBusy() && !say.classList.contains('on')) {
      void meet().catch(note)
      sayNewer()
    }
    tip()
    // A breath a minute, so a Mochi with nothing to do is still alive.
    move(1500)
    void take([]).catch(note)
  })
  // Everything is told from the start now that someone listens.
  await invoke('ready')
  await win.show()
  await invoke('shown')
  // From here on a move is the person's: where they leave the window is where its corner stays. Before it, the system's own first placing is not.
  void win.onMoved(async ({ payload }) => {
    // On macOS, in points at the scale of the screen the window is on now: a pull to another screen may change it.
    const k = isMac ? await win.scaleFactor() : 1
    const x = payload.x / k
    const y = payload.y / k
    if (Math.abs(x - put.x) <= 1 && Math.abs(y - put.y) <= 1) return
    corner = { x: x + put.w, y: y + put.h }
    put = { ...put, x, y }
    // Looked at once the person lets go: a move a moment ago is still the drag.
    clearTimeout(dropTimer)
    dropTimer = window.setTimeout(() => void dropped().catch(note), 400)
    try {
      localStorage.setItem('corner', JSON.stringify(corner))
    } catch {
      // Not kept: the place holds until the app quits.
    }
  })
  void count().catch(note)
  // The first meeting, once: what Mochi does, the agents to listen to, the bubble's answers, the pocket.
  void meet().catch(note)
  // The list closes when the person turns to another window.
  void win.onFocusChanged(({ payload }) => {
    if (!payload && list.classList.contains('on')) toggleAgents(false)
  })
}
void start()
