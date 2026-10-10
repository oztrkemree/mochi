import type { Env, Recent } from '../types'
import { ciCard, ciLines } from './ci'
import { age, ago, baseName, biggest, categoryName, clockAt, dayKey, dirOf, forecastFull, local, shiftDay, warnLevel } from './facts'
import { DEFS, STYLE, ring, usageInk } from './gauge'
import { t } from './i18n'
import { UNLOCKS, hintFor, itemName, levelOf, unlocked, xpOf } from './level'
import { PEER_INK, peerState } from './live'
import { KIND_INK, glyph, limitName, sliceInk, tokens, until } from './panel'
import { duration } from './react'
import { clip, cols } from './text'
import { WEAR } from './wear'

// The detail pane: the session in full, in the panel's language (rings,
// quiet cards, one type scale), as one drawing so nothing reflows.

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const GIT_INK: Record<string, string> = { M: '#F2B84B', A: '#4CC38A', D: '#F0645A', R: '#7AA2F7', '?': '#A59D96', U: '#F0645A' }

const PAD = 14
const IN = 16

/** A card: its body is drawn from (x, y) and `content` tall; the card adds its heading and padding around it. */
export type Card = { title: string; right?: string; content: number; body: (x: number, y: number, w: number) => string }

const thousands = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, t().thousands)

export function detailSvg(env: Env, now: number, width: number): string {
  const W = Math.max(340, Math.round(width))
  const cardW = W - PAD * 2
  const innerW = cardW - IN * 2
  const cards: Card[] = []
  const level = warnLevel(env)
  const total = Math.max(1, env.window)

  // ---- hero: three rings ----
  const pct = env.window > 0 ? (env.tokens / env.window) * 100 : env.context
  const five = env.limits.find(l => l.kind === 'five_hour')
  const week = env.limits.find(l => l.kind === 'seven_day')
  const heroes = [
    {
      label: t().detail.context, sub: env.window > 0 ? `${tokens(env.tokens)} / ${tokens(env.window)}` : '—', center: pct >= 0 ? `${Math.round(pct)}%` : '—',
      arcs: env.slices.map(s => ({ key: s.name, value: (s.tokens / total) * 100, color: sliceInk(s.name) })),
      mark: env.compactAt > 0 ? (env.compactAt / total) * 100 : undefined, halo: level >= 2 ? '#F0645A' : level >= 1 ? '#F2B84B' : undefined,
      full: null as number | null,
    },
    ...[five, week].map((l, i) => ({
      label: i === 0 ? t().detail.session5h : t().detail.week7d,
      sub: l && l.resetsAt > now ? t().detail.resetsIn(until(l.resetsAt - now)) : '—',
      full: l ? forecastFull(env.samples ?? [], l, now) : null,
      center: l ? `${Math.round(l.percent)}%` : '—',
      arcs: l ? [{ key: 'u', value: Math.min(100, l.percent), color: usageInk(l.percent) }] : [],
      mark: undefined, halo: l && l.percent >= 80 ? '#F0645A' : undefined,
    })),
  ]
  const hasForecast = heroes.some(g => g.full !== null)
  cards.push({
    title: '', content: hasForecast ? 126 : 112,
    body: (x, y, w) => {
      const col = w / heroes.length
      return heroes.map((g, i) => {
        const cx0 = x + col * i + col / 2
        const ink = g.full !== null && g.full - now < 30 * 60_000 ? '#F0645A' : '#F2B84B'
        const forecast = g.full !== null
          ? `<text class="t" x="${n(cx0)}" y="${y + 120}" font-size="10.5" font-weight="600" text-anchor="middle" fill="${ink}">${esc(clip(t().detail.paceFull(clockAt(g.full, now, env.tz ?? 0)), Math.floor(col / 5.6)))}</text>`
          : ''
        const cx = x + col * i + col / 2
        return ring({ id: `hero${i}`, cx, cy: y + 34, r: 30, width: 7.5, arcs: g.arcs, center: esc(g.center), centerSize: 16,
          ...(g.mark !== undefined ? { mark: g.mark } : {}), ...(g.halo ? { halo: g.halo, markColor: g.halo } : {}) }) +
          `<text class="t ${g.halo ? '' : 'fg'}" x="${n(cx)}" y="${y + 87}" font-size="12" font-weight="600" text-anchor="middle"${g.halo ? ` fill="${g.halo}"` : ''}>${esc(g.label)}</text>` +
          `<text class="t faint" x="${n(cx)}" y="${y + 104}" font-size="10.5" text-anchor="middle">${esc(clip(g.sub, Math.floor(col / 5.6)))}</text>` + forecast
      }).join('')
    },
  })

  // ---- the session at a glance ----
  const turns = env.turns
  const toolCount = Object.values(env.kinds).reduce((a, b) => a + b, 0)
  const stats: [string, string][] = [
    [env.startedAt > 0 ? until(now - env.startedAt) : '—', t().detail.stats.time],
    [String(turns.length), t().detail.stats.turns],
    [String(toolCount), t().detail.stats.tools],
    [String(turns.reduce((a, x) => a + x.edits, 0)), t().detail.stats.edits],
    [String(turns.reduce((a, x) => a + x.errors, 0)), t().detail.stats.errors],
    [env.cost > 0 ? `$${env.cost.toFixed(2)}` : '—', t().detail.stats.cost],
  ]
  cards.push({
    title: t().detail.thisSession, content: 40,
    body: (x, y, w) => {
      const col = w / stats.length
      return stats.map(([v, label], i) => {
        const cx = x + col * i + col / 2
        return `<text class="t fg" x="${n(cx)}" y="${y + 18}" font-size="16" font-weight="650" text-anchor="middle" font-variant-numeric="tabular-nums">${esc(v)}</text>` +
          `<text class="t faint" x="${n(cx)}" y="${y + 34}" font-size="10.5" text-anchor="middle">${esc(label)}</text>`
      }).join('')
    },
  })

  // ---- the other chats ----
  const peers = env.peers ?? []
  if (peers.length > 0) {
    cards.push({
      title: t().detail.otherChats, right: t().detail.open(peers.length), content: 16 + (peers.length - 1) * 22,
      body: (x, y, w) => peers.map((p, i) => {
        const cy = y + 8 + i * 22
        const ink = PEER_INK[p.state]
        const pulse = p.state === 'asking' || p.state === 'busy'
          ? `<animate attributeName="opacity" values="1;0.35;1" dur="${p.state === 'asking' ? 1.2 : 2}s" repeatCount="indefinite"/>`
          : ''
        const labelW = Math.min(170, w * 0.32)
        const stateW = 128
        const time = p.state === 'busy' && p.since > 0 ? ` · ${duration((now - p.since) / 1000)}` : ''
        return `<circle cx="${x + 4}" cy="${cy}" r="4" fill="${ink}">${pulse}</circle>` +
          `<text class="t fg" x="${x + 16}" y="${cy + 4}" font-size="12" font-weight="600">${esc(clip(p.label, Math.floor(labelW / 7)))}</text>` +
          `<text class="t${p.state === 'idle' ? ' faint' : ''}" x="${n(x + 16 + labelW)}" y="${cy + 4}" font-size="11.5"${p.state === 'idle' ? '' : ` fill="${ink}"`}>${esc(peerState(p.state) + time)}</text>` +
          (w - labelW - stateW - 16 > 40 ? `<text class="t faint" x="${n(x + 16 + labelW + stateW)}" y="${cy + 4}" font-size="11">${esc(clip(p.line, Math.floor((w - labelW - stateW - 16) / 6.2)))}</text>` : '')
      }).join(''),
    })
  }

  // ---- what changed in the files ----
  const changes = changesCard(env, now, innerW)
  if (changes) cards.push(changes)
  const ci = ciCard(env, now)
  if (ci) cards.push(ci)

  // ---- context, as /context draws it ----
  const all = env.allSlices.length > 0 ? env.allSlices : env.slices.map(s => ({ ...s, kind: 'used' }))
  const legend = all.filter(s => s.tokens > 0)
  const legendCols = W >= 560 ? 3 : 2
  const legendRows = Math.ceil(legend.length / legendCols)
  cards.push({
    title: t().detail.contextTitle,
    right: `${tokens(env.tokens)} / ${tokens(env.window)}${env.compactAt > 0 ? ` · ${t().detail.compactsAt(tokens(env.compactAt))}` : ''}`,
    content: 34 + (legendRows - 1) * 19 + (level >= 1 ? 40 : 6),
    body: (x, y, w) => {
      let at = x
      const segs = all.map(s => {
        const sw = (w * s.tokens) / total
        const fill = s.kind === 'free' ? 'none' : s.kind === 'buffer' ? 'url(#hatch)' : sliceInk(s.name)
        const r = fill === 'none' ? '' : `<rect x="${n(at)}" y="${y}" width="${n(Math.max(0, sw - 1))}" height="12" fill="${fill}"/>`
        at += sw
        return r
      }).join('')
      const mark = env.compactAt > 0
        ? `<path d="M${n(x + (w * env.compactAt) / total)} ${y - 4}V${y + 16}" stroke="#F2B84B" stroke-width="1.6" stroke-linecap="round"/>`
        : ''
      const colW = w / legendCols
      const items = legend.map((s, i) => {
        const lx = x + colW * (i % legendCols)
        const ly = y + 34 + Math.floor(i / legendCols) * 19
        const sw = s.kind === 'free' ? `<rect x="${n(lx)}" y="${ly - 8}" width="9" height="9" rx="2.5" fill="none" stroke="#A59D96"/>`
          : `<rect x="${n(lx)}" y="${ly - 8}" width="9" height="9" rx="2.5" fill="${s.kind === 'buffer' ? '#77706A' : sliceInk(s.name)}"/>`
        const share = (s.tokens / total) * 100
        const amount = `${tokens(s.tokens)} · ${share < 0.1 ? '<0.1' : share < 10 ? n(Math.round(share * 10) / 10) : Math.round(share)}%`
        return sw + `<text class="t" x="${n(lx + 15)}" y="${ly}" font-size="11.5"><tspan class="fg">${esc(clip(categoryName(s.name), 17))}</tspan><tspan class="faint" dx="6">${esc(amount)}</tspan></text>`
      }).join('')
      const top = biggest(env)
      const ink = level >= 2 ? '#F0645A' : '#F2B84B'
      const warnY = y + 34 + (legendRows - 1) * 19 + 12
      const warn = level >= 1
        ? `<rect x="${x}" y="${warnY}" width="${w}" height="26" rx="8" fill="${ink}" fill-opacity="0.1" stroke="${ink}" stroke-opacity="0.35"/>` +
          `<text class="t" x="${x + 12}" y="${warnY + 17}" font-size="11.5" font-weight="600" fill="${ink}">${esc(`${t().detail.contextWarn[Math.min(2, level - 1)] ?? ''}${top ? ` · ${t().ctx.biggest(top.name, top.percent)}` : ''} · ${t().ctx.hint}`)}</text>`
        : ''
      return `<clipPath id="bar"><rect x="${x}" y="${y}" width="${w}" height="12" rx="6"/></clipPath>` +
        `<rect class="trackf" x="${x}" y="${y}" width="${w}" height="12" rx="6"/><g clip-path="url(#bar)">${segs}</g>${mark}${items}${warn}`
    },
  })

  // ---- the last turns ----
  if (turns.length > 0) {
    const last = turns.slice(-20)
    const maxS = Math.max(...last.map(t => t.seconds), 1)
    const avg = last.reduce((a, t) => a + t.seconds, 0) / last.length
    const spent = last.reduce((a, t) => a + t.cost, 0)
    cards.push({
      title: t().detail.recentTurns, right: `${t().detail.average(duration(avg))}${spent > 0 ? ` · $${spent.toFixed(2)}` : ''}`, content: 90,
      body: (x, y, w) => {
        const slot = w / 20
        const bw = Math.max(4, slot - 5)
        const floor = y + 66
        const bars = last.map((t, i) => {
          const h = Math.max(3, (58 * t.seconds) / maxS)
          const bx = x + slot * (20 - last.length + i) + (slot - bw) / 2
          const ink = t.errors > 0 ? '#F0645A' : t.edits > 0 ? '#B794F6' : '#7AA2F7'
          const label = slot >= 20 && t.tools > 0 ? `<text class="t faint" x="${n(bx + bw / 2)}" y="${n(floor - h - 4)}" font-size="9" text-anchor="middle">${t.tools}</text>` : ''
          return `<rect x="${n(bx)}" y="${n(floor - h)}" width="${n(bw)}" height="${n(h)}" rx="${n(Math.min(3.5, bw / 2))}" fill="${ink}" fill-opacity="0.9"/>${label}`
        }).join('')
        const key = [['#7AA2F7', t().detail.legend.read], ['#B794F6', t().detail.legend.edit], ['#F0645A', t().detail.legend.error]] as const
        let kx = x
        const legendRow = key.map(([c, label]) => {
          const out = `<rect x="${n(kx)}" y="${floor + 12}" width="8" height="8" rx="2" fill="${c}"/><text class="t faint" x="${n(kx + 12)}" y="${floor + 19.5}" font-size="10.5">${label}</text>`
          kx += 22 + cols(label) * 6
          return out
        }).join('') + `<text class="t faint" x="${n(x + w)}" y="${floor + 19.5}" font-size="10.5" text-anchor="end">${esc(t().detail.countIsTools)}</text>`
        return `<path class="rule" d="M${x} ${floor + 0.5}H${x + w}"/>${bars}${legendRow}`
      },
    })
  }

  // ---- every chat's days, as a calendar ----
  const hist = env.history
  const tz = env.tz ?? 0
  if (hist && hist.activeDays > 0) {
    const today = dayKey(now, tz)
    const todayRow = (local(now, tz).dow + 6) % 7
    const step = 14
    const labelW = 26
    const statsW = 190
    const isBeside = innerW - labelW - 8 * step >= statsW
    const weeks = Math.max(6, Math.min(26, Math.floor((innerW - labelW - (isBeside ? statsW : 0)) / step)))
    const most = Math.max(1, ...Object.values(hist.days).map(d => d.turns))
    const week = Array.from({ length: 7 }, (_, i) => hist.days[shiftDay(today, -i)]?.turns ?? 0).reduce((a, b) => a + b, 0)
    const stats: [string, string][] = [
      [`${hist.days[today]?.turns ?? 0}`, t().detail.today],
      [`${week}`, t().detail.last7],
      [`${hist.streak}`, t().detail.streak],
      [thousands(hist.total.turns), t().detail.total(hist.activeDays)],
    ]
    const gridH = 7 * step - 3
    cards.push({
      title: t().detail.history, right: t().detail.allChats, content: 16 + gridH + 22 + (isBeside ? 0 : 58),
      body: (x, y, w) => {
        const gx = x + labelW
        const gy = y + 16
        let cells = ''
        let months = ''
        let lastMonth = -1
        let lastLabelAt = -9
        for (let c = 0; c < weeks; c++) {
          const monday = shiftDay(today, -((weeks - 1 - c) * 7 + todayRow))
          const month = Number(monday.slice(5, 7)) - 1
          if (month !== lastMonth && c - lastLabelAt >= 3) {
            months += `<text class="t faint" x="${gx + c * step}" y="${y + 8}" font-size="9.5">${esc(t().months[month] ?? '')}</text>`
            lastLabelAt = c
          }
          lastMonth = month
          for (let r = 0; r < 7; r++) {
            const back = (weeks - 1 - c) * 7 + (todayRow - r)
            if (back < 0) continue
            const key = shiftDay(today, -back)
            const turns = hist.days[key]?.turns ?? 0
            const q = turns / most
            const op = turns === 0 ? 0 : q <= 0.25 ? 0.35 : q <= 0.5 ? 0.55 : q <= 0.75 ? 0.78 : 1
            const isToday = back === 0
            cells += turns === 0
              ? `<rect class="trackf" x="${gx + c * step}" y="${gy + r * step}" width="11" height="11" rx="3"${isToday ? ' stroke="#E08A6A" stroke-width="1.2"' : ''}/>`
              : `<rect x="${gx + c * step}" y="${gy + r * step}" width="11" height="11" rx="3" fill="#D97757" fill-opacity="${op}"${isToday ? ' stroke="#F4B89E" stroke-width="1.2"' : ''}/>`
          }
        }
        const days = [0, 2, 4].map(r => `<text class="t faint" x="${x}" y="${gy + r * step + 9}" font-size="9.5">${esc(t().days[(r + 1) % 7] ?? '')}</text>`).join('')
        const ly = gy + gridH + 18
        const legend = `<text class="t faint" x="${gx}" y="${ly}" font-size="9.5">${esc(t().detail.less)}</text>` +
          [0.15, 0.35, 0.55, 0.78, 1].map((o, i) => `<rect x="${gx + 16 + i * 13}" y="${ly - 9}" width="10" height="10" rx="2.5" fill="#D97757" fill-opacity="${o}"/>`).join('') +
          `<text class="t faint" x="${gx + 16 + 5 * 13 + 3}" y="${ly}" font-size="9.5">${esc(t().detail.more)}</text>`
        const sx = isBeside ? gx + weeks * step + 24 : x
        const sy = isBeside ? gy : ly + 14
        const colW = isBeside ? (x + w - sx) / 2 : w / 4
        const statSvg = stats.map(([v, label], i) => {
          const cx = sx + (isBeside ? (i % 2) * colW : i * colW)
          const cy = sy + (isBeside ? Math.floor(i / 2) * 50 : 0)
          return `<text class="t fg" x="${n(cx)}" y="${cy + 18}" font-size="17" font-weight="650" font-variant-numeric="tabular-nums">${esc(v)}</text>` +
            `<text class="t faint" x="${n(cx)}" y="${cy + 34}" font-size="10.5">${esc(label)}</text>`
        }).join('')
        return months + days + cells + legend + statSvg
      },
    })
  }

  // ---- tools by family ----
  const kinds = (Object.entries(env.kinds) as [Recent['kind'], number][]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])
  if (kinds.length > 0) {
    // Lay the pills out in rows that fit the card.
    const pills: { k: Recent['kind']; c: number; x: number; row: number; w: number }[] = []
    let px = 0
    let row = 0
    for (const [k, c] of kinds) {
      const w = 34 + cols(`${t().detail.kind[k]} ${c}`) * 6.6
      if (px + w > innerW && px > 0) {
        px = 0
        row += 1
      }
      pills.push({ k, c, x: px, row, w })
      px += w + 6
    }
    cards.push({
      title: t().detail.toolsTitle, content: row * 30 + 24,
      body: (x, y) => pills.map(p => {
        const ink = KIND_INK[p.k]
        const py = y + p.row * 30
        const label = `${t().detail.kind[p.k]} ${p.c}`
        return `<rect x="${n(x + p.x)}" y="${py}" width="${n(p.w)}" height="24" rx="12" fill="${ink}" fill-opacity="0.12" stroke="${ink}" stroke-opacity="0.35"/>` +
          `<g transform="translate(${n(x + p.x + 14)} ${py + 12})">${glyph(p.k, ink)}</g>` +
          `<text class="t fg" x="${n(x + p.x + 26)}" y="${py + 16}" font-size="11.5">${esc(label)}</text>`
      }).join(''),
    })
  }

  return paint(cards, W)
}

/** The cards one under another, each as tall as its content, in one drawing. */
function paint(cards: Card[], W: number): string {
  const cardW = W - PAD * 2
  const innerW = cardW - IN * 2
  let y = PAD
  const body = cards.map(c => {
    const top = y
    const offset = c.title ? 38 : 16
    const h = offset + c.content + 16
    const head = c.title
      ? `<text class="t faint" x="${PAD + IN}" y="${top + 22}" font-size="10" font-weight="650" letter-spacing="1.1">${esc(c.title)}</text>` +
        (c.right ? `<text class="t faint" x="${W - PAD - IN}" y="${top + 22}" font-size="10.5" text-anchor="end">${esc(clip(c.right, Math.floor(innerW / 6.2)))}</text>` : '')
      : ''
    const out = `<rect class="card" x="${PAD}" y="${top}" width="${cardW}" height="${h}" rx="14"/>` + head + c.body(PAD + IN, top + offset, innerW)
    y += h + 10
    return out
  }).join('')
  const H = y + PAD - 10
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${DEFS}${body}</svg>`
}

// ---------- what changed in the files ----------

const ADD_INK = '#4CC38A'
const DEL_INK = '#F0645A'
const ME_INK = '#E08A6A'
/** A change's kind, from git's two letters: its colour and its sign. */
function changeKind(code: string): { ink: string; sign: string } {
  const c = code.trim()
  if (c === '??' || c.startsWith('A')) return { ink: ADD_INK, sign: '+' }
  if (c.includes('D')) return { ink: DEL_INK, sign: '−' }
  if (c.startsWith('R')) return { ink: '#7AA2F7', sign: '→' }
  if (c.includes('U')) return { ink: DEL_INK, sign: '!' }
  return { ink: '#F2B84B', sign: '•' }
}

/** "+12 −3" as tspans, a zero side left out ("+146", "−212"); "0" when nothing changed. */
function counts(add: number, del: number): string {
  if (add === 0 && del === 0) return '<tspan class="faint">0</tspan>'
  return (add > 0 ? `<tspan fill="${ADD_INK}">+${thousands(add)}</tspan>` : '') + (del > 0 ? `<tspan fill="${DEL_INK}"${add > 0 ? ' dx="6"' : ''}>−${thousands(del)}</tspan>` : '')
}

/** Five squares, as GitHub draws a change: as many filled as the change is big beside the biggest, green for added, red for removed. */
function blocks(x: number, cy: number, add: number | null, del: number | null, most: number): string {
  const total = (add ?? 0) + (del ?? 0)
  const filled = add === null || total === 0 ? 0 : Math.max(1, Math.min(5, Math.ceil((5 * total) / Math.max(1, most))))
  const green = filled === 0 ? 0 : Math.round((filled * (add ?? 0)) / total)
  return Array.from({ length: 5 }, (_, i) => {
    const fill = i < green ? `fill="${ADD_INK}"` : i < filled ? `fill="${DEL_INK}"` : 'class="trackf"'
    return `<rect x="${n(x + i * 10)}" y="${n(cy - 4)}" width="8" height="8" rx="2" ${fill}/>`
  }).join('')
}

/**
 * The repository's changes against the last commit, line by line, the files
 * Claude edited in this chat marked and first; under them the last edit
 * itself. Outside a repository, the files edited in this chat.
 */
function changesCard(env: Env, now: number, innerW: number): Card | null {
  const git = env.git
  const root = git?.root ?? ''
  // git writes `/`; Claude's own paths on Windows `\`.
  const rel = (abs: string) => {
    const path = abs.replaceAll('\\', '/')
    return root !== '' && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : abs
  }
  const edited = env.files.filter(f => f.edits > 0)
  const mine = new Map(edited.map(f => [rel(f.path), f]))
  type Row = { path: string; code: string; add: number | null; del: number | null; at: number }
  const all: Row[] = git
    ? git.files.map(f => ({ path: f.path, code: f.code, add: f.add ?? (f.code === '??' ? null : 0), del: f.del ?? (f.code === '??' ? null : 0), at: mine.get(f.path)?.at ?? 0 }))
    : edited.map(f => ({ path: f.path, code: ' M', add: f.add ?? 0, del: f.del ?? 0, at: f.at }))
  const hunk = env.lastEdit
  if (all.length === 0 && hunk === null && git === null) return null
  const rows = [...all].sort((a, b) => b.at - a.at || ((b.add ?? 0) + (b.del ?? 0)) - ((a.add ?? 0) + (a.del ?? 0))).slice(0, 10)
  const count = git ? git.changed : all.length
  const added = all.reduce((a, r) => a + (r.add ?? 0), 0)
  const removed = all.reduce((a, r) => a + (r.del ?? 0), 0)
  const most = Math.max(1, ...rows.map(r => (r.add ?? 0) + (r.del ?? 0)))
  const hasMine = rows.some(r => r.at > 0)
  const more = count - rows.length
  const shown = hunk ? [...(hunk.ctx ? [hunk.ctx] : []), ...hunk.old, ...hunk.new] : []
  const longer = hunk ? (hunk.add - hunk.new.length) + (hunk.del - hunk.old.length) : 0
  const hunkH = hunk ? 14 + 20 + 8 + shown.length * 16 + 8 + (longer > 0 ? 16 : 0) : 0
  const rowsH = rows.length * 24 + (more > 0 ? 18 : 0) + (hasMine ? 20 : 0)
  return {
    title: t().detail.changes,
    right: count > 0 ? `${t().detail.files(count)} · +${thousands(added)} −${thousands(removed)}` : git ? t().detail.clean : '',
    content: 24 + (rows.length === 0 ? 18 : rowsH) + hunkH,
    body: (x, y, w) => {
      let out = ''
      // The branch, how far it is from its remote, the last commit.
      const head = git
        ? [git.branch, ...(git.ahead > 0 ? [`↑${git.ahead}`] : []), ...(git.behind > 0 ? [`↓${git.behind}`] : []), git.lastCommit > 0 ? t().st.lastCommit(ago(now - git.lastCommit)) : t().st.noCommits].join('  ·  ')
        : t().detail.notRepo
      out += (git ? `<g transform="translate(${x} ${y + 9})" stroke="#A59D96" stroke-width="1.3" fill="none" stroke-linecap="round"><circle cx="2" cy="-4" r="1.6"/><circle cx="2" cy="4" r="1.6"/><circle cx="8" cy="-2" r="1.6"/><path d="M2 -2.4V2.4M8 -0.4C8 2 2 1 2 2.4"/></g>` : '') +
        `<text class="t ${git ? 'fg' : 'faint'}" x="${x + (git ? 16 : 0)}" y="${y + 13}" font-size="12" font-weight="${git ? 600 : 400}">${esc(clip(head, Math.floor(w / 6.6)))}</text>`
      let cy = y + 24 + 12
      if (rows.length === 0) {
        out += `<text class="t faint" x="${x}" y="${cy + 4}" font-size="11.5">${esc(t().detail.cleanTree)}</text>`
      }
      const numX = x + w - 50
      const blockX = numX - 74 - 50
      for (const r of rows) {
        const k = changeKind(r.code)
        const name = baseName(r.path)
        const room = Math.max(8, Math.floor((blockX - (x + 34) - 10) / 6.7))
        const dir = dirOf(r.path, Math.max(4, room - cols(name) - 2))
        out += `<rect x="${x}" y="${cy - 8}" width="18" height="16" rx="5" fill="${k.ink}" fill-opacity="0.16"/>` +
          `<text class="t" x="${x + 9}" y="${cy + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="${k.ink}">${k.sign}</text>` +
          (r.at > 0 ? `<circle cx="${x + 27}" cy="${cy}" r="2.8" fill="${ME_INK}"/>` : '') +
          `<text class="t" x="${x + 34}" y="${cy + 4}" font-size="12"><tspan class="fg">${esc(clip(name, room))}</tspan><tspan class="faint" font-size="11" dx="6">${esc(dir)}</tspan></text>` +
          blocks(blockX, cy, r.add, r.del, most) +
          (r.add === null
            ? `<text class="t faint" x="${n(numX)}" y="${cy + 4}" font-size="11" text-anchor="end">${esc(r.code === '??' ? t().detail.newFile : t().detail.binary)}</text>`
            : `<text class="t" x="${n(numX)}" y="${cy + 4}" font-size="11.5" font-weight="600" text-anchor="end" font-variant-numeric="tabular-nums">${counts(r.add, r.del ?? 0)}</text>`) +
          (r.at > 0 ? `<text class="t faint" x="${n(x + w)}" y="${cy + 4}" font-size="10.5" text-anchor="end">${esc(age(now - r.at) || t().justNow)}</text>` : '')
        cy += 24
      }
      if (more > 0) {
        out += `<text class="t faint" x="${x + 34}" y="${cy - 6}" font-size="11">${esc(t().detail.moreFiles(more))}</text>`
        cy += 18
      }
      if (hasMine) {
        out += `<circle cx="${x + 4}" cy="${cy - 5}" r="2.8" fill="${ME_INK}"/><text class="t faint" x="${x + 12}" y="${cy - 1.5}" font-size="10.5">${esc(t().detail.byClaude)}</text>`
        cy += 20
      }
      if (rows.length === 0) cy += 6
      // The last edit itself: the line before it, then what went and what came.
      if (hunk) {
        const top = cy - 12 + 14
        out += `<path class="rule" d="M${x} ${top - 8}H${x + w}"/>` +
          `<text class="t" x="${x}" y="${top + 8}" font-size="10" font-weight="650" letter-spacing="1"><tspan class="faint">${esc(t().detail.lastEdit)}</tspan>` +
          `<tspan class="fg" dx="10" font-size="12" letter-spacing="0">${esc(clip(baseName(hunk.path), 40))}</tspan>` +
          `<tspan class="faint" dx="8" font-size="11" letter-spacing="0">${esc(`${ago(now - hunk.at)} · `)}</tspan><tspan fill="${ADD_INK}" font-size="11" letter-spacing="0">+${hunk.add}</tspan><tspan fill="${DEL_INK}" font-size="11" dx="5" letter-spacing="0">−${hunk.del}</tspan></text>`
        const boxY = top + 20
        const boxH = shown.length * 16 + 8 + (longer > 0 ? 16 : 0)
        const chars = Math.max(10, Math.floor((w - 40) / 6.5))
        out += `<rect class="trackf" x="${x}" y="${boxY}" width="${w}" height="${boxH}" rx="8"/>`
        let ly = boxY + 4
        const line = (text: string, kind: 'ctx' | 'old' | 'new') => {
          const ink = kind === 'old' ? DEL_INK : kind === 'new' ? ADD_INK : ''
          const bg = kind === 'ctx' ? '' : `<rect x="${x}" y="${ly}" width="${w}" height="16" fill="${ink}" fill-opacity="0.1"/>`
          const sign = kind === 'old' ? '−' : kind === 'new' ? '+' : ' '
          const shownText = clip(text.replace(/\t/g, '  '), chars)
          const row = bg +
            `<text class="m${kind === 'ctx' ? ' faint' : ''}" x="${x + 8}" y="${ly + 11.5}" font-size="10.5"${ink ? ` fill="${ink}"` : ''}>${sign}</text>` +
            `<text class="m${kind === 'ctx' ? ' faint' : ' fg'}" x="${x + 22}" y="${ly + 11.5}" font-size="10.5" xml:space="preserve">${esc(shownText)}</text>`
          ly += 16
          return row
        }
        if (hunk.ctx) out += line(hunk.ctx, 'ctx')
        for (const t of hunk.old) out += line(t, 'old')
        for (const t of hunk.new) out += line(t, 'new')
        if (longer > 0) out += `<text class="t faint" x="${x + 22}" y="${ly + 11.5}" font-size="10.5">${esc(t().detail.moreLines(longer))}</text>`
      }
      return out
    },
  }
}

// ---------- the level, drawn on its own for its folding section ----------

/** One line about the level, for the section's heading while it is folded. */
export function levelSummary(env: Env): string {
  const hist = env.history
  const xp = xpOf(hist ?? null)
  const lv = levelOf(xp)
  const next = UNLOCKS.find(u => !unlocked(hist ?? null).includes(u.item))
  const pct = Math.floor(((xp - lv.at) / Math.max(1, lv.next - lv.at)) * 100)
  return `${t().detail.summary(lv.level, pct)}${next ? ` · ${t().detail.next(itemName(next.item), hintFor(next.item))}` : ''}`
}

/** The level on its own, without a card around it: its folding section is the card. */
export function levelSvg(env: Env, now: number, width: number): string {
  const W = Math.max(280, Math.round(width))
  const hist = env.history
  const cards: Card[] = []
  {
    const xp = xpOf(hist ?? null)
    const lv = levelOf(xp)
    const open = unlocked(hist ?? null)
    const total = hist?.total
    const next = UNLOCKS.find(u => !open.includes(u.item))
    cards.push({
      title: '', content: 92,
      body: (x, y, w) => {
        const progress = ((xp - lv.at) / Math.max(1, lv.next - lv.at)) * 100
        const badge = ring({ id: 'level', cx: x + 40, cy: y + 40, r: 32, width: 7, arcs: [{ key: 'xp', value: progress, color: '#E08A6A' }], center: String(lv.level), centerSize: 22 })
        const tx = x + 100
        const room = Math.floor((w - 100) / 6.2)
        const barW = Math.min(320, w - 100)
        return badge +
          `<text class="t fg" x="${tx}" y="${y + 16}" font-size="14" font-weight="650">${esc(t().detail.levelN(lv.level))}</text>` +
          `<rect class="trackf" x="${tx}" y="${y + 26}" width="${n(barW)}" height="6" rx="3"/><rect x="${tx}" y="${y + 26}" width="${n((barW * progress) / 100)}" height="6" rx="3" fill="#E08A6A"/>` +
          `<text class="t faint" x="${tx}" y="${y + 48}" font-size="11">${esc(clip(`${t().detail.toNext(thousands(lv.next - xp))}${total ? ` · ${t().detail.totals(thousands(total.turns), thousands(total.edits), total.commits)}` : ''}`, room))}</text>` +
          `<text class="t faint" x="${tx}" y="${y + 66}" font-size="11">${esc(clip(`${t().detail.wardrobeCount(open.length)}${next ? ` · ${t().detail.next(itemName(next.item), hintFor(next.item))}` : ''}`, room))}</text>` +
          (next ? `<image href="${WEAR[next.item].uri}" x="${n(x + w - 26)}" y="${y + 52}" width="${n(Math.min(26, (20 * WEAR[next.item].w) / WEAR[next.item].h))}" height="20" opacity="0.35"/>` : '')
      },
    })
  }

  const card = cards[0]
  if (card === undefined) return ''
  const H = card.content + 12
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${DEFS}${card.body(2, 6, W - 4)}</svg>`
}

/** The drawing's height for a width, so the pane can size the image. */
export function detailHeight(svg: string): number {
  return Number(/viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 400)
}

/** The same facts as lines, for the terminal. */
export function detailLines(env: Env, now: number): string[] {
  const out: string[] = []
  const tools = Object.values(env.kinds).reduce((a, b) => a + b, 0)
  const d = t().detail
  out.push(`${d.lineSession(env.turns.length, tools)}${env.cost > 0 ? ` · $${env.cost.toFixed(2)}` : ''}`)
  out.push(`${d.lineContext}: ${tokens(env.tokens)} / ${tokens(env.window)}${env.compactAt > 0 ? ` · ${d.compactsAt(tokens(env.compactAt))}` : ''}`)
  for (const s of env.slices) out.push(`  ${categoryName(s.name)}: ${tokens(s.tokens)}`)
  for (const l of env.limits) out.push(`${limitName(l.kind)}: ${Math.round(l.percent)}%${l.resetsAt > now ? ` · ${d.resetsIn(until(l.resetsAt - now))}` : ''}`)
  if (env.git) {
    const g = env.git
    const add = g.files.reduce((a, f) => a + (f.add ?? 0), 0)
    const del = g.files.reduce((a, f) => a + (f.del ?? 0), 0)
    out.push(`${d.lineGit(g.branch, g.changed)} · +${add} −${del}${g.ahead ? ` · ↑${g.ahead}` : ''}${g.behind ? ` · ↓${g.behind}` : ''}`)
    for (const f of g.files.slice(0, 8)) out.push(`  ${changeKind(f.code).sign} ${f.path}${f.add !== undefined ? `  +${f.add} −${f.del ?? 0}` : ''}`)
  }
  out.push(...ciLines(env, now))
  if (env.lastEdit) {
    const h = env.lastEdit
    out.push(`${d.lineLastEdit(baseName(h.path), ago(now - h.at))} · +${h.add} −${h.del}`)
    for (const line of h.old) out.push(`  − ${line}`)
    for (const line of h.new) out.push(`  + ${line}`)
  }
  return out
}
