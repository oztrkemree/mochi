import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, type Monitor, availableMonitors, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import type { DayRec } from '../../types'
import { dayKey } from '../../hooks/facts'
import { pickLang, setLang } from '../../hooks/i18n'
import { type Look, addDay, lookFrom } from '../../hooks/level'
import { PEER_INK } from '../../hooks/live'
import { type Sessions, agentPeers, dayFile, hookedOf, isNamedByPrompt, noted, stalledOf, tallyOf } from './engine'
import { type News, isMorePressing, newsOf, queued, stillHolds, withoutStalled } from './news'
import { type Area, areaOf, fit } from './place'
import { CHANGED, KEY, SIZES, type Settings, loadSettings, settingsFrom, talksAbout } from './settings'
import { words } from './words'
import { ROOM, type View, badgeOf, peersOf, rowsOf, viewOf } from './world'

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
const win = getCurrentWindow()

/** The gap kept to the screen's edge, in points. */
const EDGE = 12
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

let look: Look | null = null
function wear(text: string | null) {
  let value: unknown = null
  try {
    value = text === null ? null : JSON.parse(text)
  } catch {
    value = null
  }
  look = lookFrom(value)
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
  put = { ...fit(corner!, size.w, size.h, area), ...size }
  if (isMac) {
    await win.setSize(new LogicalSize(w, h))
    await win.setPosition(new LogicalPosition(put.x, put.y))
  } else {
    await win.setSize(new PhysicalSize(size.w, size.h))
    await win.setPosition(new PhysicalPosition(Math.round(put.x), Math.round(put.y)))
  }
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
  rects.push([s.left + (ROOM.left + 10) * unit, s.top + (ROOM.top + 14) * unit, 80 * unit, 84 * unit])
  for (const el of [say, list, agentsButton]) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) rects.push([r.left, r.top, r.width, r.height])
  }
  void invoke('set_hot', { rects }).catch(note)
}

// ---------- what Mochi says ----------

/** The dot before what Mochi says, in the ink the band gives that news: waiting, done, failed; grey for an answer to a press. */
const NEWS_INK: Record<News['kind'], string> = { asking: PEER_INK.asking, done: '#4CC38A', failed: PEER_INK.error }
const QUIET_INK = PEER_INK.idle

/** News waiting its turn, the most pressing first. */
let queue: News[] = []
/** The news in the bubble now; null with an answer to a press, or nothing, in it. */
let saying: News | null = null
let hushTimer = 0

function speak(text: string, ms: number, ink: string, news: News | null) {
  saying = news
  say.style.setProperty('--ink', ink)
  say.textContent = text
  say.classList.toggle('link', (news?.link ?? '') !== '')
  say.classList.add('on')
  clearTimeout(hushTimer)
  hushTimer = window.setTimeout(sayNext, ms)
  hot()
}

/** The next news in the bubble, or the bubble away when all is said. */
function sayNext() {
  clearTimeout(hushTimer)
  const next = queue.shift()
  if (next) return speak(next.line, settings.talkSeconds * 1000, NEWS_INK[next.kind], next)
  saying = null
  say.classList.remove('on')
  hot()
}

/** Takes in what changed among the chats; what no longer holds is dropped, and more pressing news does not wait for lesser news to finish. */
function hear(fresh: News[], peers: View['peers']) {
  queue = queued(queue, fresh).filter(n => stillHolds(n, peers))
  if (saying && !stillHolds(saying, peers)) return sayNext()
  const first = queue[0]
  if (!first) return
  if (!say.classList.contains('on')) return sayNext()
  if (saying && isMorePressing(first, saying)) {
    queue = queued(queue, [saying])
    sayNext()
  }
}

// A press on what Mochi says opens the chat it is about, and brings the next news.
say.addEventListener('pointerdown', e => e.stopPropagation())
say.addEventListener('click', () => {
  if (saying?.link) void openUrl(saying.link)
  sayNext()
})

// ---------- the agents ----------

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
  }).catch(note)
}

/** A chat the mod writes is the mod's to follow and to count: the app lets go of it. */
function leave(id: string) {
  sessions.delete(id)
  earned.delete(id)
}

/** Takes in hook calls: where each chat stands now, and what the call earned. */
async function take(calls: string[]) {
  for (const call of calls) {
    const h = hookedOf(call)
    if (!h || theirs.has(h.id)) continue
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
  }
  // The chats as they stand now, for every other Mochi to read; the app is told which of them the mod writes itself.
  for (const id of await invoke<string[]>('own_live', { peers: agentPeers(sessions, Date.now()) }).catch(() => [])) leave(id)
  draw()
}

// ---------- the drawing ----------

function draw() {
  const now = Date.now()
  const others = peersOf(liveTexts, now)
  theirs = new Set(others.map(p => p.id))
  for (const id of theirs) leave(id)
  const next = viewOf([...others, ...agentPeers(sessions, now)], now, look)
  const before = view
  view = next
  // The drawing loops by itself: it is put on screen again only when it differs, so its motion never starts over for nothing.
  if (!before || next.svg !== before.svg) stage.innerHTML = next.svg
  stage.setAttribute('aria-label', next.line)
  drawAgents()
  if (before) {
    // A chat taken as stopped because it went silent is at rest, which is no news of a turn that finished.
    hear(withoutStalled(newsOf(before.peers, next.peers, now), stalledOf(sessions, now)).filter(n => talksAbout(settings, n.kind)), next.peers)
  }
  hot()
}

// ---------- settings ----------

async function apply(next: Settings) {
  settings = next
  setLang(settings.lang === 'auto' ? (pickLang(navigator.language) ?? 'en') : settings.lang)
  root.style.setProperty('--size', `${SIZES[settings.size]}px`)
  agentsButton.hidden = !settings.showAgents
  if (!settings.showAgents) list.classList.remove('on')
  await invoke('on_top', { on: settings.onTop }).catch(note)
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
// A press on Mochi opens the list of chats; with none open, Mochi says how it is.
stage.addEventListener('pointerup', () => {
  if (!pressed || !view) return
  pressed = null
  if (rowsOf(view.peers, Date.now(), settings.idleMinutes * 60_000).length > 0) toggleAgents()
  else speak(view.line, ANSWER_MS, QUIET_INK, null)
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
  // What only time changes: a chat silent too long is at rest or gone, and the file the app keeps of it must say so too.
  await listen('minute', () => void take([]).catch(note))
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
    try {
      localStorage.setItem('corner', JSON.stringify(corner))
    } catch {
      // Not kept: the place holds until the app quits.
    }
  })
  // The list closes when the person turns to another window.
  void win.onFocusChanged(({ payload }) => {
    if (!payload && list.classList.contains('on')) toggleAgents(false)
  })
}
void start()
