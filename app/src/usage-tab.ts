import { usageInk } from '../../hooks/gauge'
import { lang } from '../../hooks/i18n'
import { type Point, type Quota, SPANS, type Span, type Usage, type Window, barsOf, tokenSum } from './usage'
import { words } from './words'

/**
 * The room's Usage tab: what the agents used and cost, as CodeBurn counts it. The total and what it came to; each agent
 * with its limits; the days (or today's hours) by model; where the tokens went; then the models, projects, kinds of work,
 * tools, pull requests and branches as ledgers; the chats open now; and where it could cost less.
 */

const INKS = ['#E27A52', '#F2B84B', '#5FB3F0', '#B794F6', '#F07CB8', '#4CC3A0']
const OTHER_INK = '#8C7B70'
const TOKEN_INKS = { input: '#5FB3F0', output: '#E27A52', cacheRead: '#4CC3A0', cacheWrite: '#B794F6' }

/** What the tab has to show: CodeBurn's report of the span, the providers' limits, Claude's limits as Mochi's chats heard them. */
export type Feed = { report: Usage | null; quota: Quota[]; claude: Window[]; busy: boolean; error: '' | 'missing' | 'failed' }
export type UsageState = { span: number }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const r1 = (n: number) => Math.round(n * 10) / 10
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}
const pic = (className: string, markup: string, label: string) => {
  const node = el('div', className)
  node.setAttribute('role', 'img')
  node.setAttribute('aria-label', label)
  // Drawn here from the person's own numbers; names are escaped.
  node.innerHTML = markup
  return node
}
const section = (title: string, hint = '') => {
  const s = el('section', 'w-sec')
  s.append(el('h3', '', title))
  if (hint) s.append(el('p', 'w-hint', hint))
  return s
}

/** Money in the person's currency, from dollars: cents under a hundred, whole above. */
const moneyOf = (u: Usage) => {
  const small = new Intl.NumberFormat(lang(), { style: 'currency', currency: u.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const big = new Intl.NumberFormat(lang(), { style: 'currency', currency: u.currency, maximumFractionDigits: 0 })
  return (usd: number) => (Math.abs(usd * u.rate) < 100 ? small : big).format(usd * u.rate)
}
const nf = () => new Intl.NumberFormat(lang())
const compact = (n: number) => new Intl.NumberFormat(lang(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)
const pct = (share: number, digits = 0) => new Intl.NumberFormat(lang(), { style: 'percent', maximumFractionDigits: digits }).format(share)

/** A window's reset, as far off as it is. */
function resetsIn(at: number, now: number): string {
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  return words().usage.resets(Math.floor(mins / 1440), Math.floor((mins % 1440) / 60), mins % 60)
}

/** A limit as a ring: how much is used, in the colour Mochi's own rings take for it; under it, its name and its reset. */
function ringOf(w: Window, now: number): HTMLElement {
  const R = 25, C = 2 * Math.PI * R
  const ink = usageInk(w.used)
  const box = el('div', 'u-ring')
  box.append(pic('u-ring-pic', `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(255,236,222,.08)" stroke-width="6"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${r1((w.used / 100) * C)} ${r1(C)}" transform="rotate(-90 32 32)"/><text x="32" y="36.5" text-anchor="middle">${Math.round(w.used)}%</text></svg>`, `${w.label} ${Math.round(w.used)}%`))
  const text = el('div')
  text.append(el('b', '', words().usage.windows[w.label] ?? w.label), el('small', '', w.resetsAt > now ? resetsIn(w.resetsAt, now) : ''))
  box.append(text)
  return box
}

/** One of the rows of a ledger: a name, a bar of its share, and its numbers; the grid's columns come from the ledger. */
type Line = { name: string; sub?: string; ink?: string; share: number; cells: string[]; href?: string }

function ledger(into: HTMLElement, cols: string[], lines: Line[], template: string) {
  const box = el('div', 'u-ledger')
  box.style.setProperty('--cols', template)
  const head = el('div', 'u-row w-row-head')
  for (const c of cols) head.append(el('span', '', c))
  box.append(head)
  const top = Math.max(...lines.map(l => l.share), 0.0001)
  for (const l of lines) {
    const row = el('div', 'u-row')
    const name = el('span', 'w-name')
    if (l.ink) {
      const dot = el('i')
      dot.style.background = l.ink
      name.append(dot)
    }
    const b = el('b', '', l.name)
    b.title = l.href ?? l.name
    name.append(b)
    if (l.sub) name.append(el('small', '', l.sub))
    const track = el('span', 'w-time')
    const bar = el('span', 'w-track')
    const fill = el('span')
    fill.style.width = `${Math.max(1.5, (l.share / top) * 100)}%`
    fill.style.background = l.ink ?? 'var(--clay)'
    bar.append(fill)
    track.append(bar, el('small', '', pct(l.share)))
    row.append(name, track, ...l.cells.map(c => el('span', '', c)))
    box.append(row)
  }
  into.append(box)
}

/** A short list of names with a bar each, for counts (tools, servers): the top ten. */
function counts(into: HTMLElement, title: string, rows: { name: string; n: number; tail?: string }[], ink: string) {
  const box = el('div', 'u-counts')
  box.append(el('h4', '', title))
  const top = Math.max(...rows.map(r => r.n), 1)
  for (const r of rows.slice(0, 10)) {
    const row = el('div', 'u-count')
    const bar = el('i')
    bar.style.width = `${Math.max(2, (r.n / top) * 100)}%`
    bar.style.background = ink
    row.append(el('span', '', r.name), el('b', '', r.tail ?? nf().format(r.n)), bar)
    row.title = r.name
    box.append(row)
  }
  into.append(box)
}

/** The bars of the span: a day each (today, an hour each), stacked by model, with a tip of their parts. */
function chart(into: HTMLElement, u: Usage, span: Span, now: number, money: (usd: number) => string) {
  const w = words().usage
  const isHours = span === 'today'
  // The report's own day, not the clock's: one kept from yesterday still adds up while it is counted again.
  const bars = barsOf(u, span, u.at || now)
  const label = (b: Point, long = false) => isHours
    ? new Intl.DateTimeFormat(lang(), { hour: 'numeric' }).format(new Date(b.at))
    : new Intl.DateTimeFormat(lang(), { ...(long ? { weekday: 'long' } : {}), day: 'numeric', month: 'short' }).format(new Date(b.at))
  // Five models in their own ink, by what they cost in the span; the rest as one.
  const byModel = new Map<string, number>()
  for (const b of bars) for (const m of b.models) byModel.set(m.name, (byModel.get(m.name) ?? 0) + m.cost)
  const ranked = [...byModel].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  const inkOf = (name: string) => (ranked.indexOf(name) < 5 ? INKS[ranked.indexOf(name)]! : OTHER_INK)
  const parts = (b: Point) => {
    const own = b.models.filter(m => m.cost > 0).map(m => ({ name: ranked.indexOf(m.name) < 5 ? m.name : w.other, cost: m.cost, ink: inkOf(m.name) }))
    const rest = b.cost - own.reduce((s, m) => s + m.cost, 0)
    if (rest > 0.005) own.push({ name: w.other, cost: rest, ink: OTHER_INK })
    const merged = new Map<string, { name: string; cost: number; ink: string }>()
    for (const p of own) merged.set(p.name, { ...p, cost: (merged.get(p.name)?.cost ?? 0) + p.cost })
    return [...merged.values()].sort((a, b) => b.cost - a.cost)
  }
  const s = section(isHours ? w.hourly : w.daily, w.chartHint)
  const W = 800, H = 240, TOP = 24, BOT = 28, X0 = 8, X1 = 792
  const step = (X1 - X0) / bars.length
  const bw = Math.max(2, Math.min(34, step * 0.68))
  const max = Math.max(...bars.map(b => b.cost), 0.01)
  const k = (H - TOP - BOT) / max
  let rects = ''
  let ticks = ''
  const every = Math.ceil(bars.length / 10)
  bars.forEach((b, i) => {
    const x = X0 + i * step + (step - bw) / 2
    let y = H - BOT
    for (const p of [...parts(b)].reverse()) {
      const h = p.cost * k
      y -= h
      rects += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(bw)}" height="${r1(Math.max(0, h))}" rx="${bw > 8 ? 3 : 1}" fill="${p.ink}"/>`
    }
    if (i % every === 0 || i === bars.length - 1) ticks += `<text class="w-ax" x="${r1(X0 + i * step + step / 2)}" y="${H - 8}">${esc(label(b))}</text>`
  })
  const peak = bars.reduce((best, b, i) => (b.cost > bars[best]!.cost ? i : best), 0)
  const px = X0 + peak * step + step / 2
  const peakText = bars[peak]!.cost > 0 ? `<text class="w-pk${px > W * 0.7 ? ' end' : ''}" x="${r1(px > W * 0.7 ? px + bw / 2 : px - bw / 2)}" y="${r1(Math.max(14, H - BOT - bars[peak]!.cost * k - 8))}">${esc(money(bars[peak]!.cost))}</text>` : ''
  const cols = bars.map((_, i) => `<rect data-i="${i}" x="${r1(X0 + i * step)}" y="0" width="${r1(step)}" height="${H}" fill="transparent"/>`).join('')
  const grid = [0.5].map(f => `<line class="w-grid" x1="${X0}" x2="${X1}" y1="${r1(H - BOT - max * f * k)}" y2="${r1(H - BOT - max * f * k)}"/><text class="w-ax start" x="${X0}" y="${r1(H - BOT - max * f * k - 5)}">${esc(money(max * f))}</text>`).join('')
  const box = el('div', 'w-river u-chart')
  const picture = pic('w-pic', `<svg viewBox="0 0 ${W} ${H}">${grid}${rects}${peakText}${ticks}${cols}</svg>`, isHours ? w.hourly : w.daily)
  const tip = el('div', 'w-tip')
  tip.hidden = true
  box.append(picture, tip)
  picture.addEventListener('mouseover', ev => {
    const i = Number((ev.target as Element).getAttribute('data-i'))
    if (!Number.isInteger(i) || !bars[i]) return
    const b = bars[i]!
    tip.replaceChildren()
    const top = el('div', 'w-tip-top')
    top.append(el('b', '', label(b, true)), el('span', '', money(b.cost)))
    tip.append(top)
    for (const p of parts(b)) {
      const row = el('div', 'w-tip-row')
      const dot = el('i')
      dot.style.background = p.ink
      row.append(dot, el('span', '', p.name), el('b', '', money(p.cost)))
      tip.append(row)
    }
    if (b.tokens > 0) tip.append(el('div', 'w-tip-row', w.tokens(compact(b.tokens))))
    const x = X0 + i * step + step / 2
    tip.style.left = `${(x / W) * 100}%`
    tip.classList.toggle('flip', x > W * 0.6)
    tip.hidden = false
  })
  picture.addEventListener('mouseleave', () => (tip.hidden = true))
  const keys = el('div', 'w-chips')
  for (const name of ranked.slice(0, 5)) {
    const chip = el('span', 'w-chip u-key')
    const dot = el('i')
    dot.style.background = inkOf(name)
    chip.append(dot, name, el('small', '', money(byModel.get(name) ?? 0)))
    keys.append(chip)
  }
  s.append(box, keys)
  into.append(s)
}

/** The Usage tab, drawn into `into`. `set` changes the state and draws again; `again` asks CodeBurn to count again. */
export function drawUsage(into: HTMLElement, feed: Feed, st: UsageState, set: (st: UsageState) => void, again: () => void, now = Date.now()) {
  const w = words().usage
  const span = SPANS[st.span] ?? 'week'
  const u = feed.report

  // The head: what it came to, the span, and when CodeBurn counted it.
  const head = el('div', 'w-head')
  const text = el('div')
  const side = el('div', 'u-side')
  const seg = el('div', 'seg w-seg')
  seg.setAttribute('role', 'group')
  w.spans.forEach((label, i) => {
    const b = el('button', '', label)
    b.type = 'button'
    b.setAttribute('aria-pressed', String(st.span === i))
    b.addEventListener('click', () => set({ span: i }))
    seg.append(b)
  })
  const status = el('p', 'u-status')
  const mins = u ? Math.floor((now - u.at) / 60_000) : -1
  const ago = mins < 60 ? words().work.mins(nf().format(mins)) : words().work.hours(nf().format(Math.floor(mins / 60)))
  status.append(feed.busy ? el('span', 'u-busy', w.counting) : u ? (mins < 1 ? w.countedNow : w.counted(ago)) : '')
  if (!feed.busy && feed.error !== 'missing') {
    const b = el('button', 'u-again', w.again)
    b.type = 'button'
    b.addEventListener('click', again)
    status.append(b)
  }
  side.append(seg, status)
  head.append(text, side)
  into.append(head)

  if (!u) {
    if (feed.error === 'missing') {
      text.append(el('p', 'w-empty', w.missing))
      const how = el('p', 'u-install')
      how.append(w.install, ' ', el('code', '', 'brew install codeburn'), ' · ', el('code', '', 'npm i -g codeburn'))
      text.append(how)
    } else text.append(el('p', 'w-empty', feed.busy ? w.counting : w.failed))
    if (feed.claude.length || feed.quota.length) agents(into, null, feed, now)
    return
  }
  const money = moneyOf(u)
  const lead = el('h2', 'w-lead')
  const [before = '', after = ''] = (w.spent[st.span] ?? w.spent[1]).split('{c}')
  lead.append(before, el('b', '', money(u.cost)), after)
  text.append(lead, el('p', 'w-sub', w.sub(nf().format(u.calls), nf().format(u.sessions), compact(tokenSum(u.tokens)))))
  if (feed.error === 'failed') text.append(el('p', 'w-note', w.failed))

  // Four facts of how well the money went.
  const facts = el('div', 'u-facts')
  for (const [value, label, good] of [
    [pct(Math.floor(u.cacheHit * 10) / 1000, 1), w.facts.cache, true],
    [u.oneShot === null ? '–' : pct(u.oneShot), w.facts.oneShot, true],
    [money(u.retry.cost), w.facts.retry, false],
    [nf().format(u.streak), w.facts.streak, true],
  ] as const) {
    const f = el('div', good ? 'u-fact' : 'u-fact warm')
    f.append(el('strong', '', value), el('span', '', label))
    facts.append(f)
  }
  into.append(facts)

  if (u.cost <= 0 && u.calls <= 0) {
    into.append(el('p', 'w-empty', w.empty))
    agents(into, u, feed, now)
    return
  }

  agents(into, u, feed, now)
  chart(into, u, span, now, money)

  // Where the tokens went: one bar of the four kinds.
  const tokens = section(w.tokensTitle, w.tokensHint)
  const all = Math.max(1, tokenSum(u.tokens))
  const strip = el('div', 'u-strip')
  const legend = el('div', 'u-legend')
  for (const kind of ['cacheRead', 'cacheWrite', 'output', 'input'] as const) {
    const v = u.tokens[kind]
    const part = el('i')
    part.style.flexGrow = String(v / all)
    part.style.background = TOKEN_INKS[kind]
    part.title = `${w.kinds[kind]}: ${nf().format(v)}`
    strip.append(part)
    const key = el('div')
    const dot = el('i')
    dot.style.background = TOKEN_INKS[kind]
    key.append(dot, el('span', '', w.kinds[kind]), el('b', '', compact(v)), el('small', '', pct(v / all, 1)))
    legend.append(key)
  }
  tokens.append(strip, legend)
  into.append(tokens)

  // The ledgers.
  const c = w.cols
  const share = (cost: number) => (u.cost > 0 ? cost / u.cost : 0)
  if (u.models.length) {
    const s = section(w.models, w.modelsHint)
    ledger(s, [c.name, c.share, c.calls, c.perEdit, c.oneShot, c.cost], u.models.map((m, i) => ({ name: m.name, ink: INKS[i] ?? OTHER_INK, share: share(m.cost), cells: [nf().format(m.calls), m.perEdit === null ? '–' : money(m.perEdit), m.oneShot === null ? '–' : pct(m.oneShot), money(m.cost)] })), 'minmax(140px,1.2fr) minmax(150px,1.4fr) 70px 86px 70px 90px')
    into.append(s)
  }
  const pair = el('div', 'w-pair')
  if (u.projects.length) {
    const s = section(w.projects)
    ledger(s, [c.name, c.share, c.sessions, c.cost], u.projects.map(p => ({ name: p.name, share: share(p.cost), cells: [nf().format(p.sessions), money(p.cost)], href: p.path })), 'minmax(110px,1fr) minmax(90px,1fr) 60px 80px')
    pair.append(s)
  }
  if (u.activities.length) {
    const s = section(w.activities, w.activitiesHint)
    ledger(s, [c.name, c.share, c.turns, c.oneShot, c.cost], u.activities.map(a => ({ name: a.name, share: share(a.cost), cells: [nf().format(a.turns), a.oneShot === null ? '–' : pct(a.oneShot), money(a.cost)] })), 'minmax(100px,1fr) minmax(80px,1fr) 46px 62px 76px')
    pair.append(s)
  }
  if (pair.childElementCount) into.append(pair)

  // What the agents reached for.
  if (u.tools.length || u.mcp.length || u.skills.length || u.subagents.length) {
    const s = section(`${w.tools} · ${w.mcp} · ${w.skills} · ${w.subagents}`, w.callsHint)
    const grid = el('div', 'u-grid')
    if (u.tools.length) counts(grid, w.tools, u.tools.map(t => ({ name: t.name, n: t.calls })), '#5FB3F0')
    if (u.mcp.length) counts(grid, w.mcp, u.mcp.map(t => ({ name: t.name, n: t.calls })), '#B794F6')
    if (u.skills.length) counts(grid, w.skills, u.skills.map(t => ({ name: t.name, n: t.cost, tail: money(t.cost) })), '#F2B84B')
    if (u.subagents.length) counts(grid, w.subagents, u.subagents.map(t => ({ name: t.name, n: t.cost, tail: money(t.cost) })), '#4CC3A0')
    s.append(grid)
    into.append(s)
  }

  const pair2 = el('div', 'w-pair')
  if (u.prs.length) {
    const s = section(w.prs)
    ledger(s, [c.name, c.share, c.sessions, c.cost], u.prs.slice(0, 12).map(p => ({ name: p.label, share: share(p.cost), cells: [nf().format(p.sessions), money(p.cost)], href: p.url })), 'minmax(130px,1.3fr) minmax(80px,1fr) 60px 80px')
    pair2.append(s)
  }
  if (u.branches.length) {
    const s = section(w.branches)
    ledger(s, [c.name, c.share, c.sessions, c.cost], u.branches.slice(0, 12).map(b => ({ name: b.name, share: share(b.cost), cells: [nf().format(b.sessions), money(b.cost)] })), 'minmax(110px,1fr) minmax(80px,1fr) 60px 80px')
    pair2.append(s)
  }
  if (pair2.childElementCount) into.append(pair2)

  // The chats open now, and the files gone over most.
  const pair3 = el('div', 'w-pair')
  if (u.live.length) {
    const s = section(w.live, w.liveHint)
    for (const l of u.live) {
      const row = el('div', 'u-live')
      const full = l.window > 0 ? l.used / l.window : 0
      const name = el('div')
      name.append(el('b', '', l.project || l.provider), el('small', '', [l.model, l.branch].filter(Boolean).join(' · ')))
      const bar = el('div', 'w-track big')
      const fill = el('span')
      fill.style.width = `${Math.min(100, full * 100)}%`
      fill.style.background = usageInk(full * 100)
      bar.append(fill)
      row.append(name, bar, el('span', '', w.context(compact(l.used), compact(l.window))))
      s.append(row)
    }
    pair3.append(s)
  }
  if (u.reworked.length) {
    const s = section(w.reworked)
    counts(s, '', u.reworked.map(f => ({ name: f.path, n: f.edits, tail: w.edits(nf().format(f.edits)) })), '#F07CB8')
    pair3.append(s)
  }
  if (pair3.childElementCount) into.append(pair3)

  // Where it could cost less.
  if (u.retry.cost > 0 || u.routing.cost > 0 || u.findings.length) {
    const s = section(w.cheaper, u.findings.length ? w.findingsHint : '')
    if (u.retry.cost > 0) s.append(el('p', 'u-save', w.retryLine(nf().format(u.retry.retries), money(u.retry.cost))))
    if (u.routing.cost > 0 && u.routing.baseline) s.append(el('p', 'u-save', w.routingLine(u.routing.baseline, money(u.routing.cost))))
    for (const f of [...u.findings].sort((a, b) => b.cost - a.cost)) {
      const row = el('div', 'u-finding')
      row.append(el('em', `u-impact ${f.impact}`, w.impact[f.impact] ?? f.impact), el('span', '', f.title), el('b', '', f.cost * u.rate >= 0.005 ? `−${money(f.cost)}` : ''))
      s.append(row)
    }
    into.append(s)
  }
}

/** Each agent: what it cost in the span, its share, and its limit rings. Claude's limits come from CodeBurn, else from Mochi's chats. */
function agents(into: HTMLElement, u: Usage | null, feed: Feed, now: number) {
  const w = words().usage
  // Claude and Codex always; another provider signed in on this computer only when it was used or its limits are.
  const quota = feed.quota.filter(q => ['claude', 'codex'].includes(q.id) || q.windows.some(x => x.used > 0))
  const ids = [...new Set([...(u?.providers ?? []).map(p => p.id), ...quota.map(q => q.id), ...(feed.claude.length ? ['claude'] : [])])]
  if (!ids.length) return
  const money = u ? moneyOf(u) : null
  const s = section(w.agents, w.agentsHint)
  const grid = el('div', 'u-agents')
  for (const id of ids) {
    const p = u?.providers.find(x => x.id === id)
    const q = feed.quota.find(x => x.id === id)
    const windows = q?.windows ?? (id === 'claude' ? feed.claude : [])
    const card = el('div', `u-agent ${id}`)
    const top = el('header')
    top.append(el('b', '', p?.name ?? q?.name ?? ({ claude: 'Claude', codex: 'Codex' } as Record<string, string>)[id] ?? id))
    if (q?.plan) top.append(el('small', '', /plan/i.test(q.plan) ? q.plan : w.plan(q.plan)))
    card.append(top)
    if (p && money && u) {
      card.append(el('strong', '', money(p.cost)))
      const bar = el('div', 'w-track')
      const fill = el('span')
      fill.style.width = `${u.cost > 0 ? Math.max(1, (p.cost / u.cost) * 100) : 0}%`
      fill.style.background = 'var(--clay)'
      bar.append(fill)
      card.append(bar, el('p', '', `${w.share(pct(u.cost > 0 ? p.cost / u.cost : 0))} · ${w.calls(nf().format(p.calls))} · ${w.sessions(nf().format(p.sessions))} · ${w.tokens(compact(tokenSum(p.tokens)))}`))
    }
    const rings = el('div', 'u-rings')
    for (const win of windows) rings.append(ringOf(win, now))
    if (!windows.length) rings.append(el('small', 'u-none', w.noLimits))
    card.append(rings)
    grid.append(card)
  }
  s.append(grid)
  into.append(s)
}
