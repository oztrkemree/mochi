import { invoke } from '@tauri-apps/api/core'
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, type Monitor, availableMonitors, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import { pickLang, setLang } from '../../hooks/i18n'
import { type Look, lookFrom } from '../../hooks/level'
import { PEER_INK } from '../../hooks/live'
import { type Sessions, agentPeers, hookedOf, noted } from './agents'
import { type Area, areaOf, fit } from './place'
import { type View, newsOf, peersOf, viewOf } from './world'

const stage = document.getElementById('stage')!
const say = document.getElementById('say')!
const win = getCurrentWindow()

/** The side of the square Mochi stands in, in points; the same as #stage in index.html. */
const SIZE = 128
/** The gap kept to the screen's edge, in points. */
const EDGE = 16
// shortcut: the chats' files are read once a second, upgrade to a file watch if that ever shows as load.
const READ_MS = 1000
/** How long a thing Mochi says stays up: news long enough to be read on a glance over, an answer to a press shorter. */
const NEWS_MS = 9000
const ANSWER_MS = 4000

setLang(pickLang(navigator.language) ?? 'en')

/** A window with no frame has no console a person can open: what fails is said on the app's own error output. */
const note = (what: unknown) => void invoke('note', { text: what instanceof Error ? `${what.message} ${what.stack ?? ''}` : String(what) }).catch(() => {})
addEventListener('error', e => note(e.error ?? e.message))
addEventListener('unhandledrejection', e => note(e.reason))

let view: View | null = null
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

/** Sizes the window to Mochi and what it says, and keeps its bottom right corner where the person left it, whole on that screen. */
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
  const isSaying = say.classList.contains('on')
  // The window's size in points; in pixels on Windows, at the scale of the screen it goes to.
  const w = isSaying ? Math.max(SIZE, say.offsetWidth + 18) : SIZE
  const h = isSaying ? SIZE + 2 + say.offsetHeight : SIZE
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
  if (!before) {
    await place()
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
      localStorage.setItem('corner', JSON.stringify(corner))
    })
    return
  }
  const news = newsOf(before.peers, next.peers, now)
  if (news.length > 0) await speak(news.slice(0, 3).map(n => n.line).join('\n'), NEWS_MS, NEWS_INK[news[0].kind])
  else if (saidUntil > 0 && now >= saidUntil) await hush()
}

// A press opens the chat Mochi stands for, or has it say how things stand; a pull moves the window.
let pressed: { x: number; y: number } | null = null
addEventListener('pointerdown', e => {
  if (e.button === 0) pressed = { x: e.screenX, y: e.screenY }
})
addEventListener('pointermove', e => {
  if (!pressed || Math.hypot(e.screenX - pressed.x, e.screenY - pressed.y) < 4) return
  pressed = null
  void win.startDragging()
})
addEventListener('pointerup', () => {
  if (!pressed || !view) return
  pressed = null
  if (view.link) void openUrl(view.link)
  else void speak(view.line, ANSWER_MS)
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
void beat()
setInterval(() => void beat(), READ_MS)
