import { emit } from '@tauri-apps/api/event'
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks'

/**
 * Mochi's window in a browser tab, with the app behind it played by this file:
 * the page is index.html's own markup and styles, and `window.mochi` says what
 * the app would (a chat's file changed, a hook call came). For looking at the
 * drawing while working on it; the app never loads this.
 */

// /preview.html?room shows Mochi's room instead of the corner window; add &all to open everything.
const isRoom = location.search.includes('room')
const page = new DOMParser().parseFromString(await (await fetch(isRoom ? '/room.html' : '/index.html')).text(), 'text/html')
for (const style of page.querySelectorAll('style')) document.head.append(style)
document.body.innerHTML = isRoom ? page.querySelector('main')!.outerHTML : page.getElementById('root')!.outerHTML
// A desk to stand on, so what is see-through shows as it would over other windows.
if (!isRoom) document.body.style.cssText = 'background: linear-gradient(160deg, #20242c, #3b3550 60%, #51413f); height: 100vh;'

const screen = { name: 'preview', scaleFactor: 1, position: { x: 0, y: 0 }, size: { width: innerWidth, height: innerHeight }, workArea: { position: { x: 0, y: 0 }, size: { width: innerWidth, height: innerHeight } } }
const asked: { cmd: string; args: unknown }[] = []
/** Some weeks of made-up work, so the level, the badges and the city have something to show. */
const day = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10)
// /preview.html?room&all: a long, busy history, so every item and colour is open to try on.
const isAll = location.search.includes('all')
const allDays = [JSON.stringify({ id: 'demo', label: 'shop', days: Object.fromEntries(Array.from({ length: isAll ? 120 : 26 }, (_, i) => [day(i), isAll ? { turns: 600, tools: 3000, edits: 500, errors: 1, commits: 60, cost: 0, secs: 40_000, night: 12, add: 9000, del: 9500, early: 6, langs: 63 } : { turns: 4 + ((i * 7) % 11), tools: 30, edits: 6 + (i % 5) * 4, errors: 1, commits: i % 3 === 0 ? 0 : 1 + (i % 4), cost: 0, secs: 900, night: i % 6 === 0 ? 1 : 0, add: 120, del: 40, early: 0, langs: 3 }])) })]
const shared: Record<string, string> = { 'level.json': JSON.stringify({ level: 1, items: [] }), 'badges.json': '[]', 'repos.json': JSON.stringify({ '/w/shop': 1, '/w/shop/.claude/worktrees/loop-2': 1, '/w/api': 1 }) }
// For the Work tab: more projects, one worked in from a worktree of shop, a busy day of chats side by side, and a chat tied to no project.
if (isRoom && !isAll) {
  const more = [{ label: 'api', secs: 5400, every: 11 }, { label: 'docs', secs: 1800, every: 5 }, { label: 'loop-2', secs: 7200, every: 3 }, { label: 'site', secs: 2400, every: 9 }, { label: 'fervent-boyd-1df155', secs: 1200, every: 2 }]
  for (const m of more) allDays.push(JSON.stringify({ id: m.label, label: m.label, days: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [day(i), { turns: 6, commits: i % 3, secs: i % m.every === 0 ? m.secs * 2 : Math.round((m.secs * ((i * 7) % 5)) / 4), night: i % 4 === 0 ? 2 : 0, add: 200, del: 60 }])) }))
  for (let w = 1; w <= 6; w++) allDays.push(JSON.stringify({ id: `w${w}`, label: `night-w${w}`, days: { [day(9)]: { turns: 40, commits: 5, secs: 14_000 + w * 1800, add: 900, del: 120 } } }))
}

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
  if (cmd === 'read_look') return null
  if (cmd === 'open_room') return null
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

await (isRoom ? import('./room') : import('./main'))
