import { emit } from '@tauri-apps/api/event'
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks'

/**
 * Mochi's window in a browser tab, with the app behind it played by this file:
 * the page is index.html's own markup and styles, and `window.mochi` says what
 * the app would (a chat's file changed, a hook call came). For looking at the
 * drawing while working on it; the app never loads this.
 */

const page = new DOMParser().parseFromString(await (await fetch('/index.html')).text(), 'text/html')
for (const style of page.querySelectorAll('style')) document.head.append(style)
document.body.innerHTML = page.getElementById('root')!.outerHTML
// A desk to stand on, so what is see-through shows as it would over other windows.
document.body.style.cssText = 'background: linear-gradient(160deg, #20242c, #3b3550 60%, #51413f); height: 100vh;'

const screen = { name: 'preview', scaleFactor: 1, position: { x: 0, y: 0 }, size: { width: innerWidth, height: innerHeight }, workArea: { position: { x: 0, y: 0 }, size: { width: innerWidth, height: innerHeight } } }
const asked: { cmd: string; args: unknown }[] = []

mockWindows('main')
mockIPC((cmd, args) => {
  asked.push({ cmd, args })
  if (cmd === 'plugin:window|available_monitors') return [screen]
  if (cmd === 'plugin:window|current_monitor') return screen
  if (cmd === 'plugin:window|scale_factor') return 1
  if (cmd === 'own_live') return []
  if (cmd === 'read_days') return null
  if (cmd === 'write_days' || cmd === 'answer') return true
  if (cmd === 'note') console.error('mochi:', args)
  return null
}, { shouldMockEvents: true })

const NOW = () => Date.now()
/** One chat's file as the mod writes it. */
const chat = (id: string, more: Record<string, unknown> = {}) => JSON.stringify({ id, label: id, state: 'idle', line: '', since: 0, at: NOW(), stateAt: NOW(), v: 2, ...more })

Object.assign(window, {
  mochi: {
    asked,
    chat,
    /** The chats the mod writes, as the text of their files. */
    live: (texts: string[]) => emit('live', texts),
    /** Hook calls, as the app's `hook` command leaves them. */
    calls: (calls: Record<string, unknown>[]) => emit('calls', calls.map(c => JSON.stringify(c))),
    look: (look: unknown) => emit('look', look === null ? null : JSON.stringify(look)),
    minute: () => emit('minute'),
    pointer: (x: number, y: number) => emit('pointer', [x, y]),
  },
})

await import('./main')
