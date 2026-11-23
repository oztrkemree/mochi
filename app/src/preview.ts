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
/** Some weeks of made-up work, so the level, the badges and the city have something to show. */
const day = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10)
const allDays = [JSON.stringify({ id: 'demo', label: 'shop', days: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [day(i), { turns: 4 + ((i * 7) % 11), tools: 30, edits: 6 + (i % 5) * 4, errors: 1, commits: i % 3 === 0 ? 0 : 1 + (i % 4), cost: 0, secs: 900, night: i % 6 === 0 ? 1 : 0, add: 120, del: 40, early: 0, langs: 3 }])) })]
const shared: Record<string, string> = { 'level.json': JSON.stringify({ level: 1, items: [] }), 'badges.json': '[]' }

mockWindows('main')
mockIPC((cmd, args) => {
  asked.push({ cmd, args })
  if (cmd === 'plugin:window|available_monitors') return [screen]
  if (cmd === 'plugin:window|current_monitor') return screen
  if (cmd === 'plugin:window|scale_factor') return 1
  if (cmd === 'own_live') return []
  if (cmd === 'read_all_days') return allDays
  if (cmd === 'read_shared') return shared[(args as { name: string }).name] ?? null
  if (cmd === 'write_shared') {
    shared[(args as { name: string }).name] = (args as { text: string }).text
    return true
  }
  if (cmd === 'claim') return true
  if (cmd === 'agent_state') return (args as { agent: string }).agent === 'claude' ? 'off' : 'missing'
  if (cmd === 'set_agent') return true
  if (cmd === 'save_share') return '/Users/you/.claude/mochi/share/mochi-card.svg'
  if (cmd === 'read_shield') return null
  if (cmd === 'line_state') return 'off'
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
    /** What the person last chose to wear, as prefs.json says it. */
    prefs: (pick: unknown) => emit('prefs', JSON.stringify({ v: 1, at: Date.now(), pick })),
    minute: () => emit('minute'),
    pointer: (x: number, y: number) => emit('pointer', [x, y]),
  },
})

await import('./main')
