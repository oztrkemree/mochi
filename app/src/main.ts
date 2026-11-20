import { invoke } from '@tauri-apps/api/core'
import { LogicalPosition, LogicalSize, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

import { pickLang, setLang } from '../../hooks/i18n'
import { type View, linkAt, peersOf, viewOf } from './world'

const stage = document.getElementById('stage')!
const win = getCurrentWindow()

/** The gap kept to the screen's edge, in points. */
const EDGE = 16
// shortcut: the chats' files are read once a second, upgrade to a file watch if that ever shows as load.
const READ_MS = 1000

setLang(pickLang(navigator.language) ?? 'en')

/** A window with no frame has no console a person can open: what fails is said on the app's own error output. */
const say = (what: unknown) => void invoke('note', { text: what instanceof Error ? `${what.message} ${what.stack ?? ''}` : String(what) }).catch(() => {})
addEventListener('error', e => say(e.error ?? e.message))
addEventListener('unhandledrejection', e => say(e.reason))

let view: View | null = null
/** Where the window's bottom right corner sits, in screen points: the drawing grows up and to the left of it. */
let corner: { x: number; y: number } | null = null

/** Sizes the window to the drawing and keeps its bottom right corner where the person left it. */
async function place(v: View) {
  const monitor = await currentMonitor()
  if (!monitor) return
  const k = monitor.scaleFactor
  const area = { x: monitor.workArea.position.x / k, y: monitor.workArea.position.y / k, w: monitor.workArea.size.width / k, h: monitor.workArea.size.height / k }
  const scale = Math.min(1, (area.w - EDGE * 2) / v.width)
  const w = Math.round(v.width * scale)
  const h = Math.round(v.height * scale)
  corner ??= { x: area.x + area.w - EDGE, y: area.y + area.h - EDGE }
  await win.setSize(new LogicalSize(w, h))
  await win.setPosition(new LogicalPosition(Math.max(area.x, corner.x - w), Math.max(area.y, corner.y - h)))
}

async function read() {
  const now = Date.now()
  const texts = await invoke<string[]>('read_live').catch(() => [])
  const next = viewOf(peersOf(texts, now), now)
  const isFirst = view === null
  // The drawing loops by itself: it is put on screen again only when it differs, so its motion never starts over for nothing.
  if (isFirst || next.svg !== view!.svg) {
    const resized = isFirst || next.width !== view!.width || next.height !== view!.height
    stage.innerHTML = next.svg
    stage.classList.toggle('floor', next.peers.length > 0)
    if (resized) await place(next)
  }
  view = next
  if (isFirst) {
    await win.show()
    if (import.meta.env.DEV) say(`first drawing ${next.width}x${next.height}, ${next.peers.length} chats, corner ${JSON.stringify(corner)}`)
  }
}

// A press opens the chat under it; a pull moves the window.
let pressed: { x: number; y: number } | null = null
stage.addEventListener('pointerdown', e => {
  if (e.button === 0) pressed = { x: e.screenX, y: e.screenY }
})
stage.addEventListener('pointermove', e => {
  if (!pressed || Math.hypot(e.screenX - pressed.x, e.screenY - pressed.y) < 4) return
  pressed = null
  void win.startDragging()
})
stage.addEventListener('pointerup', e => {
  if (!pressed || !view) return
  pressed = null
  const link = linkAt(view, e.clientX / stage.clientWidth)
  if (link) void openUrl(link)
})

void win.onMoved(async ({ payload }) => {
  const k = await win.scaleFactor()
  const size = await win.outerSize()
  corner = { x: (payload.x + size.width) / k, y: (payload.y + size.height) / k }
})

void read()
setInterval(() => void read(), READ_MS)
