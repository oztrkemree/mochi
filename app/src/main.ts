import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, type Monitor, availableMonitors, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import type { Act, Badge, Ci, DayRec, History, Mood } from '../../types'
import { badgeLook, badgeName } from '../../hooks/badges'
import { dayKey } from '../../hooks/facts'
import { lang, pickLang, setLang } from '../../hooks/i18n'
import { type Choice, type Look, addDay, choiceFrom, levelOf, lookFrom, unlocked, xpOf } from '../../hooks/level'
import { PEER_INK, appLink, nameOf } from '../../hooks/live'
import { t } from '../../hooks/i18n'
import type { SoundName } from '../../hooks/react'
import { clip } from '../../hooks/sound'
import { type Request, type Sessions, agentPeers, dayFile, hookedOf, isNamedByPrompt, noted, requestOf, settles, stalledOf, tallyOf } from './engine'
import { type Growth, badgesNews, growthOf, historyOf, levelNews } from './growth'
import { type Usage, usageCard, usageLine, usageNews, usageOf, usageRings } from './limits'
import { type News, isMorePressing, newsOf, queued, stillHolds, withoutStalled } from './news'
import { type Area, type Body, type Edge, type Point, areaOf, fit, nearestEdge, peekAt, pushedPast, shownIn } from './place'
import { CHANGED, KEY, SIZES, type Settings, loadSettings, settingsFrom, talksAbout } from './settings'
import { COMMIT_STALE_MS, type FolderState, type Ran, ciNow, ciSaid, ciStep, nudgeOf, pushed } from './today'
import { ACT_MS, type Beat, actOf, fidgetOf, isCodex, louder, patOf, pokesOf } from './acts'
import { BADGE_PLACE, featsOf } from './feats'
import { medalSvg } from './medal'
import { lookNow, skinNow } from './wardrobe'
import { animationOf, tracksIn } from './play'
import { TRANSITION_MS } from '../../hooks/rig'
import { useRules, verdictOf } from './shield'
import { type AgentState, type Step, nextStep, tipNow } from './tour'
import { words } from './words'
import { ROOM, type Row, type View, badgeOf, gazeOf, jobsOf, peersOf, rowsOf, stillOf, viewOf } from './world'

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
const jobsBox = document.getElementById('jobs')!
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
/** Mochi's colour, chosen in the room while its level opens it. */
let skin: string | undefined
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
  const was = JSON.stringify([look, skin])
  look = lookNow(history, modLook, prefs, tz())
  skin = skinNow(prefs, history)
  if (JSON.stringify([look, skin]) === was || !view) return
  view = null
  draw()
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
async function place(isLeap = false) {
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
  const from = { x: put.x, y: put.y }
  put = { ...(peek ?? awayAt ?? fit(corner!, size.w, size.h, area)), ...size }
  if (isLeap && !calm.matches && (from.x !== 0 || from.y !== 0)) await leap(from, { x: put.x, y: put.y }, size)
  if (isMac) {
    await win.setSize(new LogicalSize(w, h))
    await win.setPosition(new LogicalPosition(put.x, put.y))
  } else {
    await win.setSize(new PhysicalSize(size.w, size.h))
    await win.setPosition(new PhysicalPosition(Math.round(put.x), Math.round(put.y)))
  }
}

/**
 * Carries the window from `from` to `to` in a hop, as Mochi leaps: up in an
 * arc and down, arms up on the way and a squash where it lands. Each step is
 * noted as where this put the window, so none of it is taken for the person's own move.
 */
async function leap(from: Point, to: Point, size: { w: number; h: number }) {
  const STEPS = 18
  const arc = Math.min(90, 30 + Math.hypot(to.x - from.x, to.y - from.y) * 0.25)
  hold('whee', 1200)
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const x = from.x + (to.x - from.x) * e
    const y = from.y + (to.y - from.y) * e - arc * Math.sin(Math.PI * t)
    put = { x, y, ...size }
    await (isMac ? win.setPosition(new LogicalPosition(x, y)) : win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y))))
    await new Promise(r => setTimeout(r, 30))
  }
  hold('land')
}

// ---------- the edge: Mochi peeks over the bottom of the screen or a side ----------

/** Where the window stands while Mochi peeks, in the window's units; null while it stands whole on the screen. */
let peek: Point | null = null
/** The edge Mochi peeks over: on a side it lies on its side, its head toward the screen. */
let peekEdge: Edge = 'bottom'
/** What of the window shows on the screen while Mochi peeks (CSS pixels from its top left): a press beyond it goes to what is there. */
let peekShown: { left: number; top: number; right: number; bottom: number } | null = null
/** Where Mochi stood before it leapt to an edge by itself, with nothing going on: it leaps back there when there is. */
let home: Point | null = null
let dropTimer = 0

/** Mochi's body in the window in CSS pixels, as laid out: a turn on a side is not counted, the turn is about its middle. */
function bodyBox(): Body {
  const row = document.getElementById('row')!.getBoundingClientRect()
  const unit = stage.offsetWidth / (100 + ROOM.left + ROOM.right)
  return { x: row.left + stage.offsetLeft + (ROOM.left + 10) * unit, y: row.top + stage.offsetTop + (ROOM.top + 14) * unit, w: 80 * unit, h: 84 * unit }
}

/** Mochi's body in the window, in the window's units (points on macOS, pixels at the screen's scale elsewhere). */
function bodyIn(k: number): Body {
  const b = bodyBox()
  return { x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }
}

/** The screens, the scale of the one the window is on, Mochi's body, and the screen it stands on (the nearest one when it is past an edge). */
async function where() {
  const areas = (await availableMonitors()).map(areaIn)
  const k = isMac ? 1 : (await currentMonitor())?.scaleFactor ?? 1
  const body = bodyIn(k)
  const at = { x: put.x, y: put.y }
  const mid = { x: at.x + body.x + body.w / 2, y: at.y + body.y }
  const area = areaOf(mid, areas) ?? (corner ? areaOf(corner, areas) : null) ?? areas[0] ?? null
  return { k, body, at, area }
}

/** Takes Mochi to peek over an edge (the nearest one when none is given): put there by the person, or leaping there by itself. */
async function toEdge(edge: Edge | null, isLeap: boolean) {
  const { k, body, at, area } = await where()
  if (!area) return
  const e = edge ?? nearestEdge(at, body, area)
  toggleAgents(false)
  peek = peekAt(at, body, area, e)
  peekEdge = e
  const shown = shownIn(peek, put.w, put.h, area)
  peekShown = { left: shown.left / k, top: shown.top / k, right: shown.right / k, bottom: shown.bottom / k }
  root.classList.remove('peek-bottom', 'peek-left', 'peek-right')
  root.classList.add('peek', `peek-${e}`)
  await place(isLeap)
  hot()
}

/** After the person lets go of the window: pushed more than halfway past the bottom or a side, Mochi peeks there; pulled back, it stands again. */
async function dropped() {
  // Set down after being carried: a squash and a puff of dust.
  if (isCarried) {
    isCarried = false
    hold('land')
  }
  const { body, at, area } = await where()
  const edge = area ? pushedPast(at, body, area) : null
  // Put where it is by the person: that is where it stays, not where it stood before.
  home = null
  if (edge === null) {
    if (peek) standUp(false)
    return
  }
  await toEdge(edge, false)
}

/**
 * Mochi comes back from the edge, to be pressed or to speak: leaping back to
 * where it stood if it went there by itself, else just inside the edge.
 */
function standUp(isPlaced = true) {
  if (away) return comeBack()
  if (!peek) return
  const isLeap = home !== null
  const shown = peekShown?.bottom ?? put.h
  corner = home ?? (peekEdge === 'bottom' ? { x: peek.x + put.w, y: peek.y + shown * (isMac ? 1 : put.h / root.offsetHeight) - EDGE } : { x: peek.x + put.w, y: peek.y + put.h })
  home = null
  peek = null
  peekShown = null
  root.classList.remove('peek', 'peek-bottom', 'peek-left', 'peek-right')
  if (isPlaced) void place(isLeap).then(hot).catch(note)
}

// ---------- with nothing going on, Mochi leaves the screen ----------

/** The edge Mochi went out of the screen by; null while it is here. */
let away: Edge | null = null
/** Whether Mochi is all the way out: nothing is drawn and nothing plays then, so it costs nothing. */
let isGone = false
/** Where the window stands while Mochi is away: flush against that edge, so the window's edge is the screen's. */
let awayAt: Point | null = null
/** How long the way out and the way back in take (see the stage's style). */
const OUT_MS = 950
const IN_MS = 650

/**
 * Mochi leaves by the nearest edge of the screen: the window leaps flush
 * against it, then Mochi crouches, hops and goes out through it, its antenna's
 * tip left showing. A system will not move a window past the bottom of the
 * screen, so it is Mochi that goes, inside its window.
 */
async function goAway() {
  const { body, at, area } = await where()
  if (!area || away || peek) return
  const edge = nearestEdge(at, body, area)
  toggleAgents(false)
  home = corner
  awayAt = edge === 'bottom' ? { x: put.x, y: area.y + area.h - put.h } : edge === 'right' ? { x: area.x + area.w - put.w, y: put.y } : { x: area.x, y: put.y }
  await place(true)
  away = edge
  hold('whee', OUT_MS)
  root.classList.add('away', `away-${edge}`)
  hot()
  // Out of sight: nothing drawn, nothing played, until it comes back.
  window.setTimeout(() => {
    if (away !== edge) return
    isGone = true
    clearTimeout(stillTimer)
    stage.replaceChildren()
  }, OUT_MS)
}

/** Mochi comes back in by the edge it left by: it pops up, lands, and leaps back to where it stood. */
function comeBack() {
  if (!away) return
  const edge = away
  away = null
  isGone = false
  root.classList.remove('away', `away-${edge}`)
  root.classList.add(`back-${edge}`)
  // Drawn afresh: nothing was while it was out.
  view = null
  hold('whee', IN_MS)
  window.setTimeout(() => {
    root.classList.remove(`back-${edge}`)
    awayAt = null
    if (home) corner = home
    home = null
    void place(true).then(hot).catch(note)
  }, IN_MS)
}

/** With nothing going on this long, Mochi leaves the screen by its nearest edge, and waits there: the person's to set; 0, never. */
const tuckAfterMs = () => settings.leaveSeconds * 1000
let restSince = Date.now()
let tuckTimer = 0

/**
 * Keeps the time since anything went on: a chat working, waiting or failed,
 * something said, the list open, a moment played. When there is work again and
 * Mochi went to the edge by itself, it leaps back; after a while of nothing, it goes.
 */
function rest(peers: readonly { state: string }[]) {
  const isWork = peers.some(p => p.state === 'busy' || p.state === 'asking' || p.state === 'error')
  if (isWork && (away || (peek && home))) return standUp()
  if (isWork || held || isBusy() || say.classList.contains('on') || list.classList.contains('on')) restSince = Date.now()
  clearTimeout(tuckTimer)
  // Set to stay: out of the screen, it comes back.
  if (tuckAfterMs() === 0 && away) return standUp()
  if (peek || away || tuckAfterMs() === 0) return
  tuckTimer = window.setTimeout(() => {
    if (peek || away || held || isBusy() || say.classList.contains('on') || list.classList.contains('on') || Date.now() - restSince < tuckAfterMs() - 100) return
    void goAway().catch(note)
  }, Math.max(1000, tuckAfterMs() - (Date.now() - restSince)))
}

/**
 * Tells the app where a press is Mochi's own: Mochi's body, and what it says
 * or shows. Everywhere else in the window a press goes to what is behind.
 */
function hot() {
  const rects: number[][] = []
  // Mochi's body, on its side turned a quarter about its middle; none while it is out of the screen.
  const b = bodyBox()
  if (!away) hotBody(rects, b)
  // Each chat's bubble on its own: the room between and beside them lets a press through.
  for (const el of [say, list, ...jobsBox.querySelectorAll<HTMLElement>('.job'), agentsButton, limitsButton]) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) rects.push([r.left, r.top, r.width, r.height])
  }
  void invoke('set_hot', { rects }).catch(note)
}

/** Mochi's body as a press may land on it: on its side turned, and peeking only what shows on the screen. */
function hotBody(rects: number[][], b: Body) {
  const box = peek && peekEdge !== 'bottom' ? { x: b.x + b.w / 2 - b.h / 2, y: b.y + b.h / 2 - b.w / 2, w: b.h, h: b.w } : b
  // Peeking, only what shows on the screen: past its edge is the Dock, the taskbar or another window, and a press there is theirs.
  const cut = peekShown ?? { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity }
  const left = Math.max(box.x, cut.left)
  const top = Math.max(box.y, cut.top)
  rects.push([left, top, Math.max(0, Math.min(box.x + box.w, cut.right) - left), Math.max(0, Math.min(box.y + box.h, cut.bottom) - top)])
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

// ---------- Mochi never stands still, and costs little ----------

/**
 * A change of pose, and a moment, is the drawing's own SMIL motion, which draws
 * all of Mochi again sixty times a second: it plays for a short stretch. The
 * rest of the time Mochi is its pose in layers the app plays at a clay
 * figure's frame rate (`liven`): breathing, swaying, typing, looking about,
 * blinking, never frozen. Measured in the app, in a minute with chats open:
 * about 6% of a core, against 31% for SMIL that never stops.
 */
const MOVES_MS = 2400
/** While a chat works its Mochi changes what it does every few seconds: each change is eased in and held, not played out. */
const WORK_MOVES_MS = 900
let stillTimer = 0
let isStill = false

/** Shows a drawing, the eyes where they were turned; between moves, its layers are played (see `liven`). Nothing while Mochi is out. */
function show(svg: string) {
  if (isGone) return
  stage.innerHTML = svg
  gaze()
  liven()
}

/**
 * Plays the layers of the drawing on screen, if it has them, on the
 * compositor: Mochi never stands frozen between moves, and costs little. Each
 * loop runs on the pose's own clock, the one its SMIL drawing and `paramsAt`
 * keep, so a change of pose starts from where the arms were and the layers
 * take over where the SMIL left off. Not for someone who asked for less motion.
 */
function liven() {
  const tracks = tracksIn(stage)
  if (tracks.length === 0 || calm.matches || !view) return
  const playedFor = Date.now() - view.at - TRANSITION_MS
  for (const t of tracks) {
    const { keyframes, options } = animationOf(t)
    t.el.animate(keyframes, options).currentTime = playedFor
  }
}

/** Lets Mochi move for a while: `svg` is what to show while it does (the pose itself when none is given), and then it holds still. */
/** The person asked their system for less motion: Mochi changes pose without playing its moves. */
const calm = matchMedia('(prefers-reduced-motion: reduce)')

function move(ms = MOVES_MS, svg: string | null = null) {
  if (!view) return
  if (calm.matches) return show(stillOf(svg ?? view.rest))
  // Already living between moves: nothing more to play.
  if (svg === null && isStill) return
  const wasStill = isStill
  isStill = false
  if (svg !== null || wasStill) show(svg ?? view.rest)
  clearTimeout(stillTimer)
  stillTimer = window.setTimeout(() => {
    if (!view) return
    isStill = true
    // Between moves Mochi is its pose in layers that keep moving by themselves, played by the compositor at next to no cost.
    show(view.alive)
  }, ms)
}

// ---------- now and then a stir ----------

/** The moods in which Mochi is at ease, with nothing to do: these stir now and then by themselves. */
const AT_EASE: readonly (Mood | Act)[] = ['idle', 'proud', 'pleased']

/**
 * Every twenty to forty seconds, Mochi at ease now and then does something by
 * itself. Never while it says something or a moment plays.
 */
function stirSoon() {
  window.setTimeout(() => {
    if (view && isStill && !held && !peek && !isBusy() && !say.classList.contains('on') && !document.hidden && AT_EASE.includes(view.mood)) {
      const fidget = Math.random() < 0.35 ? fidgetOf(view.mood as Mood, 0, Math.random()) : null
      if (fidget) hold(fidget)
    }
    stirSoon()
  }, 20_000 + Math.random() * 20_000)
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

/** A mood or a moment Mochi keeps a while whatever the chats say: a pat, a limit that is back, a chat's turn done. */
let held: { mood: Mood | Act; until: number } | null = null
let heldTimer = 0
/** What a chat did while another moment played: played when that one is over. */
let pending: Beat | null = null
/** Whether the chats open at the window's start have been read: those are not each new to react to. */
let hasHeard = false
/** Whether the person carries the window now: only their pull is a flight. */
let isCarried = false

function hold(mood: Mood | Act, ms = ACT_MS[mood] ?? MOVES_MS) {
  const isAgain = held?.mood === mood
  held = { mood, until: Date.now() + ms }
  clearTimeout(heldTimer)
  heldTimer = window.setTimeout(() => {
    held = null
    const next = pending
    pending = null
    if (next) hold(next)
    else draw()
  }, ms)
  draw()
  // Held longer (a pull that goes on): the same drawing keeps moving that much longer.
  if (isAgain) move(ms + 200)
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
  // A milestone reached (the badges are said above): said once by this app, the first count only noting what is done already.
  const reached = featsOf(h, badges).filter(f => f.done && !f.badge).map(f => f.id)
  let known: string[] | null = null
  try {
    known = JSON.parse(localStorage.getItem('feats') ?? 'null') as string[] | null
  } catch {
    known = null
  }
  // Hidden, nothing is noted: what is reached meanwhile is said when Mochi is back.
  if (known === null || canSay) localStorage.setItem('feats', JSON.stringify(reached))
  if (known !== null && canSay) {
    const before = new Set(known)
    const fresh = reached.filter(id => !before.has(id))
    if (fresh.length > 0) lines.push(words().feats.won(fresh.slice(0, 3).map(id => words().feats.name[id] ?? id).join(', ')))
  }
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
      const look = badgeLook(b)
      medal.innerHTML = medalSvg(look.ink, look.sign, BADGE_PLACE[b].tier, true)
      medal.title = badgeName(b)
      medals.append(medal)
    }
    into.append(medals)
  }
  // The wardrobe, every badge and the city are in Mochi's room, a window of its own.
  const room = el('button', 'room', words().room)
  room.type = 'button'
  room.addEventListener('click', () => void invoke('open_room').catch(note))
  into.append(room)
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
  drawJobs(rows)
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

/** A bubble over Mochi for each chat at work, saying as much as the person chose; the chats past the last bubble are counted over them. */
function drawJobs(rows: readonly Row[]) {
  const w = words()
  const { jobs, left } = jobsOf(rows, settings.jobs)
  const items: HTMLElement[] = left > 0 ? [el('span', 'left', w.jobsLeft(left))] : []
  for (const job of jobs) {
    const item = el('button', 'job card')
    item.type = 'button'
    // A press opens the chat where a link reaches it, else the list of agents.
    if (job.link) {
      item.dataset.link = job.link
      item.title = w.openHint
    }
    const dot = el('span', 'dot')
    dot.style.background = job.ink
    const what = el('span', 'what')
    what.append(el('b', '', job.name), ` ${job.line}`)
    item.append(dot, what, ...job.more.map(m => el('span', 'more', m)))
    items.push(item)
  }
  jobsBox.replaceChildren(...items)
  jobsBox.classList.toggle('on', jobs.length > 0)
}

jobsBox.addEventListener('pointerdown', e => e.stopPropagation())
jobsBox.addEventListener('click', e => {
  const job = (e.target as HTMLElement).closest<HTMLElement>('.job')
  if (!job) return
  if (job.dataset.link) void openUrl(job.dataset.link)
  else if (settings.showAgents) toggleAgents(true)
})

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
const earned = new Map<string, { label: string; isLabelFromPrompt: boolean; folder: string; days: Record<string, Partial<DayRec>> }>()

/** Writes one after another, so two turns ending together never both start from the same file. */
let writing: Promise<unknown> = Promise.resolve()

/** Adds what a chat earned to its days file, the file the mod keeps for a chat of its own. */
function keepDays(id: string) {
  const mine = earned.get(id)
  if (!mine) return
  earned.delete(id)
  writing = writing.then(async () => {
    let text = await invoke<string | null>('read_days', { id })
    for (const [day, rec] of Object.entries(mine.days)) text = dayFile(text, id, mine.label, mine.isLabelFromPrompt, day, rec, mine.folder)
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
      const mine = earned.get(h.id) ?? { label: '', isLabelFromPrompt: false, folder: '', days: {} }
      const day = dayKey(h.at, tz())
      const chat = sessions.get(h.id) ?? before
      if (chat) {
        mine.label = chat.label
        mine.isLabelFromPrompt = isNamedByPrompt(chat)
        mine.folder = chat.folder ?? ''
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
  // With no mod writing chats there may be no word of them but this.
  hasHeard = true
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
  const next = viewOf(peers, now, look, { was: before, held: held && held.until > now ? held.mood : null, isTired: usageOf(peers, now).some(u => u.p >= TIRED_AT), skin })
  view = next
  // A new pose comes to the screen eased in from the last; the same pose is left as it is.
  const isAtWork = peers.some(p => p.state === 'busy')
  // A moment plays through for as long as it is held; a change of what the chats do is eased in and held.
  const heldFor = held && held.until > now ? held.until - now + 200 : 0
  if (!before || next.svg !== before.svg) {
    move(heldFor || (before && isAtWork && before.peers.some(p => p.state === 'busy') ? WORK_MOVES_MS : MOVES_MS), next.svg)
  }
  stage.setAttribute('aria-label', next.line)
  // Thinking, Mochi's dots lead up to a cloud, in the ink of whoever thinks: Claude Code's clay, Codex's blue.
  const think = document.getElementById('think')
  think?.classList.toggle('on', next.mood === 'thinking')
  think?.classList.toggle('codex', peers.some(p => p.state === 'busy' && isCodex(p)) && !peers.some(p => p.state === 'busy' && !isCodex(p)))
  watch(next.mood)
  drawAgents()
  const usedBefore = usage
  drawLimits(usageOf(next.peers, now), now)
  rest(next.peers)
  if (before) {
    // A chat taken as stopped because it went silent is at rest, which is no news of a turn that finished.
    hear([...withoutStalled(newsOf(before.peers, next.peers, now), stalledOf(sessions, now)), ...usageNews(usedBefore, usage, now)].filter(n => talksAbout(settings, n.kind)), next.peers)
  }
  hot()
  // What a chat just did, played as a moment, or after the one playing now; never over a chat that waits on the person or failed,
  // which is Mochi's face then.
  const beat = before && hasHeard ? actOf(before.peers, next.peers, stalledOf(sessions, now)) : null
  if (beat && !(['asking', 'error', 'denied'] as (Mood | Act)[]).includes(next.mood)) {
    if (held) pending = louder(pending, beat)
    else hold(beat)
  }
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
function watch(mood: Mood | Act) {
  const on = LOOKS_ABOUT.includes(mood as Mood) && !matchMedia('(prefers-reduced-motion: reduce)').matches
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
  // Away, a pull on its antenna's tip brings it back instead.
  if (away) return standUp()
  // Carried off: arms up and away while the window moves (see `onMoved`), and set down after (see `dropped`).
  isCarried = true
  hold('whee')
  void win.startDragging()
})
// A press on Mochi opens the list of chats; with none open, Mochi says how it is. Enter or Space does the same.
function pressMochi() {
  if (!view) return
  if (peek || away) return standUp()
  if (rowsOf(view.peers, Date.now(), settings.idleMinutes * 60_000).length > 0 || usage.length > 0) toggleAgents()
  else speak(view.line, ANSWER_MS, QUIET_INK, null)
}
/** When Mochi was last pressed, for presses close together. */
let pokes: number[] = []
stage.addEventListener('pointerup', () => {
  if (!pressed) return
  pressed = null
  const now = Date.now()
  pokes = [...pokes.filter(t => now - t <= 1200), now]
  // Pressed again and again: it giggles, and then its head spins; the list stays shut.
  const poked = pokesOf(pokes, now)
  if (poked) {
    toggleAgents(false)
    if (held?.mood !== poked) hold(poked)
    return
  }
  pressMochi()
})
// The ring around Mochi shows only for someone moving by the keyboard; a press of the mouse takes it away.
addEventListener('keydown', e => {
  if (e.key === 'Tab') document.body.classList.add('keys')
})
addEventListener('pointerdown', () => document.body.classList.remove('keys'))
stage.addEventListener('keydown', e => {
  if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return
  e.preventDefault()
  pressMochi()
})
/** When Mochi last noticed the pointer: once in a while, so passing by is not a show each time. */
let perkedAt = 0
const PERK_REST_MS = 25_000
// The pointer comes over Mochi: it stirs, and now and then it notices with a little hop; asleep, it stretches awake.
stage.addEventListener('pointerenter', () => {
  const now = Date.now()
  if (held || !view || peek || now - perkedAt < PERK_REST_MS || !['idle', 'proud', 'pleased', 'sleeping', 'sleepy'].includes(view.mood)) return move()
  perkedAt = now
  hold(view.mood === 'sleeping' || view.mood === 'sleepy' ? 'stretch' : 'perk')
})
// A pat: two quick presses, and Mochi is glad of it: mostly love, sometimes bashful, sometimes a twirl.
stage.addEventListener('dblclick', () => {
  toggleAgents(false)
  hold(patOf(Math.random()))
  chime('ding')
})
addEventListener('contextmenu', e => {
  e.preventDefault()
  // A right click opens Mochi's room, where its settings are too.
  void invoke('open_room')
})

async function start() {
  await apply(settings)
  await listen<string[]>('calls', e => void take(e.payload).catch(note))
  await listen<string[]>('live', e => {
    liveTexts = e.payload
    draw()
    hasHeard = true
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
    // Now and then something Mochi does by itself.
    const fidget = view && !held && !peek && !isBusy() && !say.classList.contains('on') ? fidgetOf(view.mood as Mood, Math.random(), Math.random()) : null
    if (fidget) hold(fidget)
    void take([]).catch(note)
  })
  stirSoon()
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
    // Carried: whee for as long as the window keeps moving; it stops by itself a moment after it does not. A move the system
    // made (a screen gone) is no flight.
    if (isCarried && (held?.mood !== 'whee' || held.until - Date.now() < 2000)) hold('whee')
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
