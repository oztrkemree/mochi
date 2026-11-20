import { invoke } from '@tauri-apps/api/core'
import { LogicalPosition, LogicalSize, type Monitor, availableMonitors, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import { pickLang, setLang } from '../../hooks/i18n'
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
/** Codex and the like, known from their hook calls. */
const agents: Sessions = new Map()
/** When what Mochi says now comes down; 0 with nothing said. */
let saidUntil = 0
/** Where the window's bottom right corner sits, in screen points: the window grows up and to the left of it. */
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

/** A screen's work area in points. */
const areaIn = (m: Monitor): Area => ({ x: m.workArea.position.x / m.scaleFactor, y: m.workArea.position.y / m.scaleFactor, w: m.workArea.size.width / m.scaleFactor, h: m.workArea.size.height / m.scaleFactor })

/** Sizes the window to Mochi and what it says, and keeps its bottom right corner where the person left it, whole on that screen. */
async function place() {
  const areas = (await availableMonitors()).map(areaIn)
  let area = corner ? areaOf(corner, areas) : null
  if (!area) {
    // The first start, or the screen it was left on is gone: the bottom right of the screen the window is on.
    const monitor = await currentMonitor()
    if (!monitor) return
    area = areaIn(monitor)
    corner = { x: area.x + area.w - EDGE, y: area.y + area.h - EDGE }
  }
  const isSaying = say.classList.contains('on')
  const w = isSaying ? Math.max(SIZE, say.offsetWidth + 10) : SIZE
  const h = isSaying ? SIZE - 4 + say.offsetHeight : SIZE
  put = { ...fit(corner!, w, h, area), w, h }
  await win.setSize(new LogicalSize(w, h))
  await win.setPosition(new LogicalPosition(put.x, put.y))
}

async function speak(text: string, ms: number) {
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
  const next = viewOf([...peersOf(texts, now), ...agentPeers(agents, now)], now)
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
      // The scale of the screen the window is on now: a pull to another screen may change it.
      const k = await win.scaleFactor()
      const x = payload.x / k
      const y = payload.y / k
      if (Math.abs(x - put.x) <= 1 && Math.abs(y - put.y) <= 1) return
      corner = { x: x + put.w, y: y + put.h }
      localStorage.setItem('corner', JSON.stringify(corner))
    })
    return
  }
  const news = newsOf(before.peers, next.peers, now)
  if (news.length > 0) await speak(news.slice(0, 3).join('\n'), NEWS_MS)
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
