import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, type Monitor, availableMonitors, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import { pickLang, setLang } from '../../hooks/i18n'
import { type Look, lookFrom } from '../../hooks/level'
import { PEER_INK } from '../../hooks/live'
import { type Sessions, agentPeers, hookedOf, noted } from './agents'
import { type Area, areaOf, fit } from './place'
import { CHANGED, KEY, SIZES, type Settings, loadSettings, settingsFrom, talksAbout } from './settings'
import { words } from './words'
import { type View, dotsOf, newsOf, peersOf, rowsOf, viewOf } from './world'

const root = document.getElementById('root')!
const stage = document.getElementById('stage')!
const say = document.getElementById('say')!
const list = document.getElementById('list')!
const agentsButton = document.getElementById('agents') as HTMLButtonElement
const win = getCurrentWindow()

/** The gap kept to the screen's edge, in points. */
const EDGE = 12
// shortcut: the chats' files are read once a second, upgrade to a file watch if that ever shows as load.
const READ_MS = 1000
/** An answer to a press stays up shorter than news. */
const ANSWER_MS = 4000

/** A window with no frame has no console a person can open: what fails is said on the app's own error output. */
const note = (what: unknown) => void invoke('note', { text: what instanceof Error ? `${what.message} ${what.stack ?? ''}` : String(what) }).catch(() => {})
addEventListener('error', e => note(e.error ?? e.message))
addEventListener('unhandledrejection', e => note(e.reason))

let settings: Settings = loadSettings()
let view: View | null = null
/** Codex and the like, known from their hook calls. */
const agents: Sessions = new Map()
/** When what Mochi says now comes down; 0 with nothing said. */
let saidUntil = 0
/** Where the window's bottom right corner sits (in the unit of `isMac` below): the window grows up and to the left of it. */
let corner: { x: number; y: number } | null = remembered()
/** Where this last put the window, and how large: a move to anywhere else is the person's own. */
let put = { x: 0, y: 0, w: 0, h: 0 }

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

/** The look the mod last wrote, kept by its text so it is read again only when it changes. */
let look: { text: string | null; value: Look | null } = { text: null, value: null }
function lookOf(text: string | null): Look | null {
  if (text !== look.text) {
    let value: unknown = null
    try {
      value = text === null ? null : JSON.parse(text)
    } catch {
      value = null
    }
    look = { text, value: lookFrom(value) }
  }
  return look.value
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

/** Sizes the window to what it shows, and keeps its bottom right corner where the person left it, whole on that screen. */
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
  // What is shown, in points; in pixels on Windows, at the scale of the screen it goes to.
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

// ---------- what Mochi says ----------

/** The dot before what Mochi says, in the ink the band gives that news: waiting, done, failed; grey for an answer to a press. */
const NEWS_INK: Record<'asking' | 'done' | 'failed', string> = { asking: PEER_INK.asking, done: '#4CC38A', failed: PEER_INK.error }
const QUIET_INK = PEER_INK.idle

async function speak(text: string, ms: number, ink = QUIET_INK) {
  say.style.setProperty('--ink', ink)
  say.textContent = text
  say.classList.add('on')
  saidUntil = Date.now() + ms
  await place()
}

async function hush() {
  say.classList.remove('on')
  saidUntil = 0
  await place()
}

// ---------- the agents ----------

/** Fills the list of agents from what was last read, and the dots at Mochi's feet. */
function drawAgents() {
  const rows = view ? rowsOf(view.peers, Date.now(), settings.idleMinutes * 60_000) : []
  const w = words()
  const { dots, more } = dotsOf(rows)
  const marks = dots.map(d => {
    const dot = document.createElement('span')
    dot.className = d.isAsking ? 'dot asking' : 'dot'
    dot.style.setProperty('--ink', d.ink)
    return dot
  })
  if (more > 0) {
    const plus = document.createElement('span')
    plus.className = 'more'
    plus.textContent = `+${more}`
    marks.push(plus)
  }
  agentsButton.replaceChildren(...marks)
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

async function toggleAgents(on = !list.classList.contains('on')) {
  list.classList.toggle('on', on)
  agentsButton.setAttribute('aria-expanded', String(on))
  drawAgents()
  await place()
}

agentsButton.addEventListener('pointerdown', e => e.stopPropagation())
agentsButton.addEventListener('click', () => void toggleAgents())
list.addEventListener('pointerdown', e => e.stopPropagation())
list.addEventListener('click', e => {
  const link = (e.target as HTMLElement).closest<HTMLElement>('.agent')?.dataset.link
  if (link) {
    void openUrl(link)
    void toggleAgents(false)
  }
})
addEventListener('keydown', e => {
  if (e.key === 'Escape' && list.classList.contains('on')) void toggleAgents(false)
})

// ---------- settings ----------

async function apply(next: Settings) {
  settings = next
  setLang(settings.lang === 'auto' ? (pickLang(navigator.language) ?? 'en') : settings.lang)
  root.style.setProperty('--size', `${SIZES[settings.size]}px`)
  agentsButton.hidden = !settings.showAgents
  if (!settings.showAgents) list.classList.remove('on')
  await invoke('on_top', { on: settings.onTop }).catch(note)
  if (view) {
    // A language or a size changes the drawing and the words: draw them again.
    view = null
    await read()
  }
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

// ---------- the beat ----------

async function read() {
  const now = Date.now()
  const texts = await invoke<string[]>('read_live').catch(() => [])
  for (const call of await invoke<string[]>('take_inbox').catch(() => [])) {
    const hooked = hookedOf(call)
    if (hooked) noted(agents, hooked)
  }
  const lookText = await invoke<string | null>('read_look').catch(() => null)
  const next = viewOf([...peersOf(texts, now), ...agentPeers(agents, now)], now, lookOf(lookText))
  const before = view
  view = next
  // The drawing loops by itself: it is put on screen again only when it differs, so its motion never starts over for nothing.
  if (!before || next.svg !== before.svg) stage.innerHTML = next.svg
  drawAgents()
  if (!before) {
    await place()
    return
  }
  const news = newsOf(before.peers, next.peers, now).filter(n => talksAbout(settings, n.kind))
  if (news.length > 0) await speak(news.slice(0, 3).map(n => n.line).join('\n'), settings.talkSeconds * 1000, NEWS_INK[news[0].kind])
  else if (saidUntil > 0 && now >= saidUntil) await hush()
}

// A press opens the chat Mochi stands for, or has it say how things stand; a pull moves the window; a right press opens the settings.
let pressed: { x: number; y: number } | null = null
stage.addEventListener('pointerdown', e => {
  if (e.button === 0) pressed = { x: e.screenX, y: e.screenY }
})
addEventListener('pointermove', e => {
  if (!pressed || Math.hypot(e.screenX - pressed.x, e.screenY - pressed.y) < 4) return
  pressed = null
  void win.startDragging()
})
stage.addEventListener('pointerup', () => {
  if (!pressed || !view) return
  pressed = null
  if (view.link) void openUrl(view.link)
  else void speak(view.line, ANSWER_MS)
})
addEventListener('contextmenu', e => {
  e.preventDefault()
  void invoke('open_settings')
})

// One read at a time: a slow one is not overtaken by the next.
let isReading = false
async function beat() {
  if (isReading) return
  isReading = true
  try {
    await read()
  } catch (e) {
    note(e)
  } finally {
    isReading = false
  }
}

async function start() {
  await apply(settings)
  await beat()
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
    if (!payload && list.classList.contains('on')) void toggleAgents(false)
  })
  setInterval(() => void beat(), READ_MS)
}
void start()
