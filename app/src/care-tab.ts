import { type Machine } from './machine'
import { type Server, serverName } from './servers'
import { type TreeState, canRemove, gbOf, lossesOf } from './trees'
import { type Agent } from './whatsnew'
import { words } from './words'

/**
 * The room's Computer tab: this computer's disk, battery and load; the dev servers left running; the worktrees that
 * can be removed; and what is new in the agents. A part is null until it has been read.
 */

/** What the Computer tab shows: each part null until it has been read. */
export type CareState = {
  machine: Machine | null
  servers: Server[] | null
  trees: TreeState[] | null            // every worktree but the main ones, of every repository
  versions: { agent: Agent; version: string; changes: string[] }[] | null
  /** The row whose button was pressed once and waits for the second press: 'server:<pid>:<port>' or 'tree:<path>'; '' for none. */
  armed: string
  /** What the last removal said: '' or a line to show under the worktrees. */
  said: string
  /** The paths of the worktrees being removed now: each shows a wait where its button was, and cannot be pressed again. */
  removing: string[]
  /** The worktree whose removal would lose something, waiting for the person's word in a window of its own; null for none. */
  ask: TreeState | null
}

/** Nothing read yet. */
export const EMPTY: CareState = { machine: null, servers: null, trees: null, versions: null, armed: '', said: '', removing: [], ask: null }

/** What the tab can ask for. */
/** `tree`: a press on a worktree's Remove, which removes it or asks; `force`: the person's word to lose what the window said; `cancel`: the window closed. */
export type CareActs = { stop: (s: Server) => void; tree: (t: TreeState) => void; force: (t: TreeState) => void; cancel: () => void; arm: (key: string) => void; open: (agent: Agent) => void }

/** Kilobytes of the worktrees that could be removed, for the line over them. */
export const removableKb = (trees: readonly TreeState[]): number => trees.filter(canRemove).reduce((sum, t) => sum + t.kb, 0)

/** Whole hours from seconds, for `words().care.age`. */
export const hoursOf = (seconds: number): number => Math.floor(seconds / 3600)

/** A share as a whole percent between 0 and 100. */
export const percentOf = (part: number, whole: number): number => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0)

/** The last part of a path, for naming a folder or a detached worktree. */
const last = (path: string): string => path.split(/[/\\]/).filter(Boolean).pop() ?? path

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

/** A section of the tab with its heading, as the usage tab builds them. */
const section = (title: string): HTMLElement => {
  const s = el('section', 'w-sec care-sec')
  s.append(el('h3', '', title))
  return s
}

/** A tile of the machine: its words, and a bar of a share when there is one. */
const tile = (text: string, share?: number): HTMLElement => {
  const box = el('div', 'u-fact')
  box.append(el('span', '', text))
  if (share !== undefined) {
    const track = el('div', 'w-track')
    const fill = el('span')
    fill.style.width = `${share}%`
    fill.style.background = 'var(--clay)'
    track.append(fill)
    box.append(track)
  }
  return box
}

/** A button that takes two presses: the first arms it, the second does what it says. */
const twice = (label: string, armed: boolean, press: () => void): HTMLElement => {
  const b = el('button', 'care-btn', label)
  b.type = 'button'
  b.setAttribute('aria-pressed', String(armed))
  b.addEventListener('click', press)
  return b
}

/** The window that says what removing a worktree would lose and asks: Cancel is where the focus starts, and Escape or a press beside the window is Cancel too. */
function windowOf(t: TreeState, acts: CareActs): HTMLElement {
  const w = words().care.trees
  const veil = el('div', 'care-veil')
  const box = el('div', 'care-modal')
  box.setAttribute('role', 'alertdialog')
  box.setAttribute('aria-modal', 'true')
  // Focusable, so a press on its text keeps the focus inside and Escape still reaches it.
  box.tabIndex = -1
  box.append(el('h4', '', w.askTitle(t.branch || last(t.path))))
  const list = el('ul')
  for (const loss of lossesOf(t)) list.append(el('li', '', loss.kind === 'notMerged' ? w.askNotMerged : loss.kind === 'detached' ? w.askDetached : loss.kind === 'dirty' ? w.askDirty : w.askKeeps(loss.name)))
  const cancel = el('button', 'care-btn', w.cancel)
  cancel.type = 'button'
  cancel.addEventListener('click', acts.cancel)
  const force = el('button', 'care-btn care-danger', w.force)
  force.type = 'button'
  force.addEventListener('click', () => acts.force(t))
  const buttons = el('div', 'care-buttons')
  buttons.append(cancel, force)
  box.append(list, buttons)
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') acts.cancel()
  })
  veil.addEventListener('click', e => {
    if (e.target === veil) acts.cancel()
  })
  veil.append(box)
  queueMicrotask(() => cancel.focus())
  return veil
}

/** Draws the tab: this computer, the dev servers, the worktrees, what is new. */
export function drawCare(into: HTMLElement, st: CareState, acts: CareActs): void {
  const w = words().care

  const m = st.machine
  const machine = section(w.machine.title)
  if (m) {
    const tiles = el('div', 'u-facts care-tiles')
    if (m.diskTotal > 0) {
      tiles.append(tile(w.machine.disk(gbOf(m.diskFree / 1024), gbOf(m.diskTotal / 1024)), percentOf(m.diskTotal - m.diskFree, m.diskTotal)))
    }
    if (m.battery) {
      tiles.append(tile(w.machine.battery(m.battery.percent) + (m.battery.isCharging ? `, ${w.machine.charging}` : '')))
    }
    if (m.load !== null) {
      const share = percentOf(m.load, 1)
      tiles.append(tile(w.machine.load(share), share))
    }
    machine.append(tiles)
  }
  into.append(machine)

  const servers = section(w.servers.title)
  if (st.servers) {
    if (st.servers.length === 0) servers.append(el('p', 'w-note', w.servers.none))
    for (const s of st.servers) {
      const key = `server:${s.pid}:${s.port}`
      const row = el('div', 'care-row')
      const name = el('span', 'w-name', '')
      name.append(el('b', '', serverName(s)), el('small', '', w.servers.port(s.port)))
      if (s.seconds > 0) name.append(el('small', '', w.servers.since(w.age(hoursOf(s.seconds)))))
      row.append(name, twice(st.armed === key ? w.servers.sure : w.servers.stop, st.armed === key, () => (st.armed === key ? acts.stop(s) : acts.arm(key))))
      servers.append(row)
    }
  }
  into.append(servers)

  const trees = section(w.trees.title)
  trees.append(el('p', 'w-hint', w.trees.hint))
  const free = st.trees ? removableKb(st.trees) : 0
  if (free > 0) trees.append(el('p', 'w-hint', w.trees.total(gbOf(free))))
  if (st.trees === null) trees.append(el('p', 'w-note', w.trees.looking))
  else if (st.trees.length === 0) trees.append(el('p', 'w-note', w.trees.none))
  else {
    const byRepo = new Map<string, TreeState[]>()
    for (const t of st.trees) byRepo.set(t.repo, [...(byRepo.get(t.repo) ?? []), t])
    for (const [repo, list] of byRepo) {
      const group = el('div', 'u-counts')
      group.append(el('h4', '', last(repo)))
      for (const t of list) {
        const row = el('div', 'care-row')
        const name = el('span', 'w-name', '')
        name.append(el('b', '', t.branch || last(t.path)))
        name.append(el('small', '', t.isMerged ? w.trees.merged : w.trees.notMerged))
        if (t.isDirty) name.append(el('small', '', w.trees.dirty))
        if (t.isOpen) name.append(el('small', '', w.trees.open))
        if (t.isLocked) name.append(el('small', '', w.trees.locked))
        if (t.keeps.length) name.append(el('small', '', w.trees.keeps(t.keeps[0])))
        row.append(name, el('span', 'care-size', w.gb(gbOf(t.kb))))
        if (st.removing.includes(t.path)) row.append(el('span', 'care-wait', w.trees.removing))
        else {
          const button = el('button', 'care-btn', w.trees.remove)
          button.type = 'button'
          button.addEventListener('click', () => acts.tree(t))
          row.append(button)
        }
        group.append(row)
      }
      trees.append(group)
    }
    if (st.said) trees.append(el('p', 'w-note', st.said))
  }
  into.append(trees)
  if (st.ask) into.append(windowOf(st.ask, acts))

  const news = section(w.news.title)
  const versions = (st.versions ?? []).filter(v => v.version)
  if (st.versions !== null && versions.length === 0) news.append(el('p', 'w-note', w.news.none))
  if (versions.length) {
    const grid = el('div', 'u-agents')
    for (const v of versions) {
      const card = el('div', `u-agent ${v.agent}`)
      const top = el('header')
      top.append(el('b', '', words().agentName[v.agent]), el('small', '', v.version))
      const list = el('ul', 'care-list')
      for (const c of v.changes) list.append(el('li', '', c))
      const all = el('button', 'care-link', w.news.all)
      all.type = 'button'
      all.addEventListener('click', () => acts.open(v.agent))
      card.append(top, list, all)
      grid.append(card)
    }
    news.append(grid)
  }
  into.append(news)
}
