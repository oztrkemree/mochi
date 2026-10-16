import type { Env, FileDiff, Recent } from '../types'
import { boardLines, chatsCard } from './chats'
import { ciCard, ciLine, ciLines, prLine } from './ci'
import { age, ago, baseName, biggest, categoryName, clockAt, dayKey, dirOf, forecastFull, local, shiftDay, timeGone, turnsLeft, warnLevel } from './facts'
import { DEFS, STYLE, ring, usageInk } from './gauge'
import { t } from './i18n'
import { UNLOCKS, hintFor, itemName, levelOf, unlocked, xpOf } from './level'
import { KIND_INK, glyph, limitName, sliceInk, tokens, until } from './panel'
import { duration } from './react'
import { clip, cols, rtlStyle } from './text'
import { WEAR } from './wear'

// The detail pane: the session in full, in the panel's language (rings,
// quiet cards, one type scale), as one drawing so nothing reflows.

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const GIT_INK: Record<string, string> = { M: '#F2B84B', A: '#4CC38A', D: '#F0645A', R: '#7AA2F7', '?': '#A1A09B', U: '#F0645A' }

const PAD = 14
const IN = 16

/** A card: its body is drawn from (x, y) and `content` tall; the card adds its heading and padding around it. */
export type Card = { title: string; right?: string; content: number; body: (x: number, y: number, w: number) => string }

const thousands = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, t().thousands)

/** The pane's parts in order: the overview always shown, then those its folding sections hold. */
export const PARTS = ['overview', 'chats', 'changes', 'context', 'activity'] as const
export type Part = (typeof PARTS)[number]
/** A part's cards, and the gist its section's heading shows while it is folded. */
export type Parts = Record<Part, { cards: Card[]; gist: string }>

/** The whole pane as one drawing, as `/mochi snap` saves it. */
export function detailSvg(env: Env, now: number, width: number): string {
  const W = Math.max(340, Math.round(width))
  const parts = detailParts(env, now, W - PAD * 2 - IN * 2)
  return paint(PARTS.flatMap(p => parts[p].cards), W)
}

/** Every card of the pane, `innerW` wide, by the part it belongs to. */
export function detailParts(env: Env, now: number, innerW: number): Parts {
  const cards: Card[] = []
  const level = warnLevel(env)
  const total = Math.max(1, env.window)

  // ---- hero: three rings ----
  const pct = env.window > 0 ? (env.tokens / env.window) * 100 : env.context
  const left = turnsLeft(env)
  const five = env.limits.find(l => l.kind === 'five_hour')
  const week = env.limits.find(l => l.kind === 'seven_day')
  const heroes = [
    {
      label: t().detail.context, sub: env.window > 0 ? `${tokens(env.tokens)} / ${tokens(env.window)}${left !== null ? ` · ${t().panel.turnsLeft(left)}` : ''}` : '—', center: pct >= 0 ? `${Math.round(pct)}%` : '—',
      arcs: env.slices.map(s => ({ key: s.name, value: (s.tokens / total) * 100, color: sliceInk(s.name) })),
      mark: env.compactAt > 0 ? (env.compactAt / total) * 100 : undefined, halo: level >= 2 ? '#F0645A' : level >= 1 ? '#F2B84B' : undefined,
      full: null as number | null, pace: null as number | null,
    },
    ...[five, week].map((l, i) => ({
      label: i === 0 ? t().detail.session5h : t().detail.week7d,
      sub: l && l.resetsAt > now ? t().detail.resetsIn(until(l.resetsAt - now)) : '—',
      full: l ? forecastFull(env.samples ?? [], l, now, env.tz ?? 0) : null,
      pace: l ? timeGone(l, now) : null,
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
          ...(g.mark !== undefined ? { mark: g.mark } : {}), ...(g.pace !== null ? { pace: g.pace } : {}), ...(g.halo ? { halo: g.halo, markColor: g.halo } : {}) }) +
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

  const overview = cards.splice(0)

  // ---- every chat on the machine ----
  const board = chatsCard(env, now)

  // ---- what changed in the files ----
  const changes = changesCard(env, now)
  if (changes) cards.push(changes)
  const ci = ciCard(env, now)
  if (ci) cards.push(ci)
  const changed = cards.splice(0)

  // ---- context, as /context draws it ----
  const all = env.allSlices.length > 0 ? env.allSlices : env.slices.map(s => ({ ...s, kind: 'used' }))
  const legend = all.filter(s => s.tokens > 0)
  const legendCols = innerW >= 500 ? 3 : 2
  const legendRows = Math.ceil(legend.length / legendCols)
  cards.push({
    title: t().detail.contextTitle,
    right: `${tokens(env.tokens)} / ${tokens(env.window)}${env.compactAt > 0 ? ` · ${t().detail.compactsAt(tokens(env.compactAt))}` : ''}${left !== null ? ` · ${t().panel.turnsLeft(left)}` : ''}`,
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
        const sw = s.kind === 'free' ? `<rect x="${n(lx)}" y="${ly - 8}" width="9" height="9" rx="2.5" fill="none" stroke="#A1A09B"/>`
          : `<rect x="${n(lx)}" y="${ly - 8}" width="9" height="9" rx="2.5" fill="${s.kind === 'buffer' ? '#6E6D69' : sliceInk(s.name)}"/>`
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
  const context = cards.splice(0)

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

  const activity = cards.splice(0)
  const days = hist && hist.activeDays > 0 ? `${hist.days[dayKey(now, tz)]?.turns ?? 0} ${t().detail.today}` : ''
  const gist = (...parts: (string | undefined)[]) => parts.filter(s => s !== undefined && s !== '').join(' · ')
  return {
    overview: { cards: overview, gist: '' },
    chats: { cards: board ? [board] : [], gist: board?.right ?? '' },
    changes: { cards: changed, gist: gist(changes?.right, env.ci ? ciLine(env.ci) : env.pr ? prLine(env.pr) : '') },
    context: { cards: context, gist: context[0]?.right ?? '' },
    activity: { cards: activity, gist: gist(activity.find(c => c.title === t().detail.recentTurns)?.right, days) },
  }
}

/**
 * A part on its own, for its folding section, which is its card: the cards
 * one under another, a rule between them; the first one's heading left out
 * when it is the section's own (`heading`).
 */
export function partSvg(cards: Card[], width: number, heading: string): string {
  const W = Math.max(280, Math.round(width))
  let y = 6
  const body = cards.map((c, i) => {
    const top = y
    const hasHead = c.title !== '' && !(i === 0 && c.title === heading)
    const rule = i > 0 ? `<path class="rule" d="M2 ${top - 9}H${W - 2}"/>` : ''
    const head = hasHead
      ? `<text class="t faint" x="2" y="${top + 10}" font-size="10" font-weight="650" letter-spacing="1.1">${esc(c.title)}</text>` +
        (c.right ? `<text class="t faint" x="${W - 2}" y="${top + 10}" font-size="10.5" text-anchor="end">${esc(clip(c.right, Math.floor((W - 120) / 6.2)))}</text>` : '')
      : ''
    const offset = hasHead ? 26 : 0
    y += offset + c.content + 20
    return rule + head + c.body(2, top + offset, W - 4)
  }).join('')
  const H = Math.max(12, y - 12)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${rtlStyle()}${DEFS}${body}</svg>`
}

/**
 * The overview as the pane's "now" tab shows it: the context and the two
 * usage windows as thin bars (the context in its kinds, the compaction
 * marked), each with its figure and when it resets, or when it fills at this
 * pace; under them the session in one line.
 */
export function metersSvg(env: Env, now: number, width: number): string {
  const W = Math.max(280, Math.round(width))
  const total = Math.max(1, env.window)
  const level = warnLevel(env)
  const pct = env.window > 0 ? (env.tokens / env.window) * 100 : env.context
  const five = env.limits.find(l => l.kind === 'five_hour')
  const week = env.limits.find(l => l.kind === 'seven_day')
  type Meter = { label: string; right: string; ink?: string; segs: { value: number; color: string }[]; mark?: number }
  const meters: Meter[] = [
    {
      label: t().detail.context,
      right: pct >= 0 ? `${Math.round(pct)}% · ${tokens(env.tokens)}` : '—',
      ...(level >= 2 ? { ink: '#F0645A' } : level >= 1 ? { ink: '#F2B84B' } : {}),
      segs: env.slices.map(s => ({ value: (s.tokens / total) * 100, color: sliceInk(s.name) })),
      ...(env.compactAt > 0 ? { mark: (env.compactAt / total) * 100 } : {}),
    },
    ...([[five, t().detail.session5h], [week, t().detail.week7d]] as const).map(([l, label]): Meter => {
      if (!l) return { label, right: '—', segs: [] }
      const full = forecastFull(env.samples ?? [], l, now, env.tz ?? 0)
      const right = full !== null ? t().detail.paceFull(clockAt(full, now, env.tz ?? 0)) : l.resetsAt > now ? `${Math.round(l.percent)}% · ${until(l.resetsAt - now)}` : `${Math.round(l.percent)}%`
      return {
        label, right: full !== null ? `${Math.round(l.percent)}% · ${right}` : right,
        ...(full !== null ? { ink: full - now < 30 * 60_000 ? '#F0645A' : '#F2B84B' } : l.percent >= 80 ? { ink: '#F0645A' } : {}),
        segs: [{ value: Math.min(100, l.percent), color: usageInk(l.percent) }],
      }
    }),
  ]
  const labelW = Math.min(170, Math.max(...meters.map(m => cols(m.label))) * 6.6 + 14)
  const rightW = Math.min(220, Math.max(...meters.map(m => cols(m.right))) * 6.2 + 14)
  const barX = 2 + labelW
  const barW = Math.max(60, W - 4 - labelW - rightW)
  let svg = ''
  meters.forEach((m, i) => {
    const y = 6 + i * 24
    let at = barX
    const segs = m.segs.map(s => {
      const sw = (barW * Math.max(0, s.value)) / 100
      const r = `<rect x="${n(at)}" y="${y + 4}" width="${n(Math.max(0, sw - (m.segs.length > 1 ? 1 : 0)))}" height="6" fill="${s.color}"/>`
      at += sw
      return r
    }).join('')
    const mark = m.mark !== undefined ? `<path d="M${n(barX + (barW * m.mark) / 100)} ${y + 1}V${y + 13}" stroke="#F2B84B" stroke-width="1.4" stroke-linecap="round"/>` : ''
    svg += `<text class="t ${m.ink ? '' : 'fg'}" x="2" y="${y + 11}" font-size="12"${m.ink ? ` fill="${m.ink}"` : ''}>${esc(m.label)}</text>` +
      `<clipPath id="m${i}"><rect x="${barX}" y="${y + 4}" width="${n(barW)}" height="6" rx="3"/></clipPath>` +
      `<rect class="trackf" x="${barX}" y="${y + 4}" width="${n(barW)}" height="6" rx="3"/><g clip-path="url(#m${i})">${segs}</g>${mark}` +
      `<text class="t ${m.ink ? '' : 'dim'}" x="${W - 2}" y="${y + 11}" font-size="11.5" text-anchor="end" font-variant-numeric="tabular-nums"${m.ink ? ` fill="${m.ink}"` : ''}>${esc(clip(m.right, Math.floor(rightW / 6)))}</text>`
  })
  const s = t().detail.stats
  const errors = env.turns.reduce((a, x) => a + x.errors, 0)
  const parts = [
    ...(env.startedAt > 0 ? [`${until(now - env.startedAt)} ${s.time}`] : []),
    `${env.turns.length} ${s.turns}`,
    `${Object.values(env.kinds).reduce((a, b) => a + b, 0)} ${s.tools}`,
    `${env.turns.reduce((a, x) => a + x.edits, 0)} ${s.edits}`,
  ]
  const line = `<text class="t dim" x="2" y="${6 + 3 * 24 + 12}" font-size="11.5" font-variant-numeric="tabular-nums">${esc(parts.join(' · '))}` +
    (errors > 0 ? `<tspan class="dim"> · </tspan><tspan fill="#F0645A">${errors} ${esc(s.errors)}</tspan>` : '') +
    (env.cost > 0 ? `<tspan class="dim"> · $${env.cost.toFixed(2)}</tspan>` : '') + '</text>'
  const H = 6 + 3 * 24 + 22
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${rtlStyle()}${DEFS}${svg}${line}</svg>`
}

/** A hairline across the pane, between the rows of its list. */
export function ruleSvg(width: number): string {
  const W = Math.max(40, Math.round(width))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 9" width="100%" height="100%" preserveAspectRatio="none">${STYLE}<path class="rule" d="M0 4.5H${W}"/></svg>`
}

/** A setting's switch: the clay track with the knob at the right when on, a quiet one at the left when off. */
export function switchSvg(isOn: boolean): string {
  const track = isOn ? '<rect x="1" y="1" width="30" height="17" rx="8.5" fill="#D97757"/>' : '<rect class="trackf" x="1" y="1" width="30" height="17" rx="8.5" style="fill-opacity:.16"/>'
  const knob = `<circle cx="${isOn ? 22.5 : 9.5}" cy="9.5" r="6.5" fill="${isOn ? '#FFFFFF' : '#D6D5D1'}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 19" width="100%" height="100%">${STYLE}${track}${knob}</svg>`
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${rtlStyle()}${DEFS}${body}</svg>`
}

// ---------- what changed in the files ----------

const ADD_INK = '#4CC38A'
const DEL_INK = '#F0645A'
const MOD_INK = '#7AA2F7'
const ME_INK = '#E08A6A'
/** A change's kind, from git's two letters: its colour and its sign. */
function changeKind(code: string): { ink: string; sign: string } {
  const c = code.trim()
  if (c === '??' || c.startsWith('A')) return { ink: ADD_INK, sign: '+' }
  if (c.includes('D')) return { ink: DEL_INK, sign: '−' }
  if (c.startsWith('R')) return { ink: MOD_INK, sign: '→' }
  if (c.includes('U')) return { ink: DEL_INK, sign: '!' }
  return { ink: MOD_INK, sign: '~' }
}

/** "+12 −3" as tspans, a zero side left out ("+146", "−212"); "0" when nothing changed. */
function counts(add: number, del: number): string {
  if (add === 0 && del === 0) return '<tspan class="faint">0</tspan>'
  return (add > 0 ? `<tspan fill="${ADD_INK}">+${thousands(add)}</tspan>` : '') + (del > 0 ? `<tspan fill="${DEL_INK}"${add > 0 ? ' dx="6"' : ''}>−${thousands(del)}</tspan>` : '')
}

/** A change's size as one bar: as long as it is beside the biggest, green for what came, red for what went. */
function sizeBar(x: number, cy: number, w: number, add: number, del: number, most: number): string {
  const total = add + del
  const len = total === 0 ? 0 : Math.max(3, (w * total) / Math.max(1, most))
  const green = total === 0 ? 0 : (len * add) / total
  return `<rect class="trackf" x="${n(x)}" y="${n(cy - 3)}" width="${n(w)}" height="6" rx="3"/>` +
    (green > 0 ? `<rect x="${n(x)}" y="${n(cy - 3)}" width="${n(green)}" height="6" rx="3" fill="${ADD_INK}"/>` : '') +
    (len - green > 0 ? `<rect x="${n(x + green)}" y="${n(cy - 3)}" width="${n(len - green)}" height="6" rx="${green > 0 ? 0 : 3}" fill="${DEL_INK}"/>` : '')
}

type ChangeRow = { path: string; code: string; add: number | null; del: number | null; at: number }

/** A path as git writes it, from the repository's root; git writes `/`, Claude's own paths on Windows `\`. */
export function relPath(root: string, abs: string): string {
  const path = abs.replaceAll('\\', '/')
  return root !== '' && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : abs
}

/** The changed files: those Claude edited in this chat first, latest first, then the biggest. */
function changeRows(env: Env): ChangeRow[] {
  const git = env.git
  const root = git?.root ?? ''
  const edited = env.files.filter(f => f.edits > 0)
  const mine = new Map(edited.map(f => [relPath(root, f.path), f]))
  const all: ChangeRow[] = git
    ? git.files.map(f => ({ path: f.path, code: f.code, add: f.add ?? (f.code === '??' ? null : 0), del: f.del ?? (f.code === '??' ? null : 0), at: mine.get(f.path)?.at ?? 0 }))
    : edited.map(f => ({ path: f.path, code: ' M', add: f.add ?? 0, del: f.del ?? 0, at: f.at }))
  return all.sort((a, b) => b.at - a.at || size(b) - size(a))
}
const size = (r: ChangeRow) => (r.add ?? 0) + (r.del ?? 0)

/** The files Changes shows a button for where its rows hear no clicks: in a repository, with lines to show; `sign` as the card marks them. */
export const diffable = (env: Env): { path: string; sign: string }[] =>
  env.git ? changeRows(env).slice(0, 10).filter(r => r.add !== null).map(r => ({ path: r.path, sign: changeKind(r.code).sign })) : []

/** A folder with at least this many of the other changes in it, all of about one size (siblings, as a file per language), shows as one line, which opens to them. */
const FOLD_AT = 4
const MINE_MAX = 8
const REST_MAX = 6

/** A line of the list: a file, a folder of files folded into one (`files`), or one of an opened folder's files (`isChild`). */
type Entry = { row: ChangeRow; files?: ChangeRow[]; isOpen?: boolean; isChild?: boolean }

/** The changes in two groups: Claude's in this chat, latest first; the rest by size, a crowded folder folded into one line. */
function changeGroups(env: Env): { mine: Entry[]; rest: Entry[]; restCount: number; hidden: ChangeRow[] } {
  const rows = changeRows(env)
  const mineAll = rows.filter(r => r.at > 0)
  const restAll = rows.filter(r => r.at === 0)
  const folderOf = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  const byFolder = new Map<string, ChangeRow[]>()
  for (const r of restAll) byFolder.set(folderOf(r.path), [...(byFolder.get(folderOf(r.path)) ?? []), r])
  const open = env.dirs ?? []
  const tops: Entry[] = []
  const folded = new Set<string>()
  for (const r of restAll) {
    const dir = folderOf(r.path)
    const kin = byFolder.get(dir) ?? []
    const sizes = kin.map(size)
    const isKin = kin.length >= FOLD_AT && Math.max(...sizes) <= 2 * Math.max(1, Math.min(...sizes))
    if (dir === '' || !isKin) {
      tops.push({ row: r })
    } else if (!folded.has(dir)) {
      folded.add(dir)
      const known = kin.filter(f => f.add !== null)
      const codes = new Set(kin.map(f => changeKind(f.code).sign))
      tops.push({
        row: {
          path: dir, code: codes.size === 1 ? kin[0]!.code : ' M', at: 0,
          add: known.length === 0 ? null : known.reduce((a, f) => a + (f.add ?? 0), 0),
          del: known.length === 0 ? null : known.reduce((a, f) => a + (f.del ?? 0), 0),
        },
        files: kin, isOpen: open.includes(dir),
      })
    }
  }
  tops.sort((a, b) => size(b.row) - size(a.row))
  const shownTops = tops.slice(0, REST_MAX)
  const rest = shownTops.flatMap(e => e.files && e.isOpen ? [e, ...e.files.map(f => ({ row: f, isChild: true }))] : [e])
  const hidden = [...mineAll.slice(MINE_MAX), ...tops.slice(REST_MAX).flatMap(e => e.files ?? [e.row])]
  return { mine: mineAll.slice(0, MINE_MAX).map(row => ({ row })), rest, restCount: restAll.length, hidden }
}

/**
 * A strip of Changes, `h` tall, drawn from (x, y) across `w`; `key` is the
 * press it answers to where its rows hear clicks ('' for none).
 */
export type Piece = { key: string; h: number; draw: (x: number, y: number, w: number) => string }

type Line = FileDiff['lines'][number]

/** A diff's lines in a box, `x` in from the left; a caption over them when it has one. */
function diffBox(lines: Line[], more: number, caption: string): Piece {
  const capH = caption === '' ? 0 : 20
  const h = capH + 8 + lines.length * 16 + (more > 0 ? 16 : 0) + 6
  return {
    key: '', h,
    draw: (x, y, w) => {
      const bx = x + 30
      const bw = w - 30
      const chars = Math.max(10, Math.floor((bw - 34) / 6.5))
      let out = `<rect class="trackf" x="${n(bx)}" y="${y + 2}" width="${n(bw)}" height="${h - 8}" rx="8"/>`
      if (caption !== '') out += `<text class="t faint" x="${n(bx + 10)}" y="${y + 16}" font-size="9.5" font-weight="650" letter-spacing="1">${esc(caption)}</text>`
      let ly = y + 2 + capH + 4
      for (const l of lines) {
        const ink = l.kind === 'old' ? DEL_INK : l.kind === 'new' ? ADD_INK : ''
        if (ink !== '') out += `<rect x="${n(bx)}" y="${ly}" width="${n(bw)}" height="16" fill="${ink}" fill-opacity="0.1"/>`
        if (ink !== '') out += `<text class="m" x="${n(bx + 9)}" y="${ly + 11.5}" font-size="10.5" fill="${ink}">${l.kind === 'old' ? '−' : '+'}</text>`
        out += `<text class="m ${l.kind === 'ctx' ? 'faint' : 'fg'}" x="${n(bx + 23)}" y="${ly + 11.5}" font-size="10.5" xml:space="preserve">${esc(clip(l.text.replace(/\t/g, '  '), chars))}</text>`
        ly += 16
      }
      if (more > 0) out += `<text class="t faint" x="${n(bx + 23)}" y="${ly + 11.5}" font-size="10.5">${esc(t().detail.moreLines(more))}</text>`
      return out
    },
  }
}

/**
 * Changes as strips, top to bottom: the branch, the files Claude edited in
 * this chat, the rest (a crowded folder as one line), and what is not shown.
 * The file picked opens under its own line; with none picked, the last edit
 * under the file it was made in, until put away. `hint` says the lines can
 * be pressed, where they can.
 */
export function changesPieces(env: Env, now: number, hint = false): Piece[] {
  const git = env.git
  const { mine, rest, restCount, hidden } = changeGroups(env)
  const d = t().detail
  const pieces: Piece[] = []
  const all = [...mine, ...rest]
  const most = Math.max(1, ...all.filter(e => !e.isChild).map(e => size(e.row)))

  // The branch, how far it is from its remote, the last commit; under it what came against what went.
  const added = (git?.files ?? []).reduce((a, f) => a + (f.add ?? 0), 0)
  const removed = (git?.files ?? []).reduce((a, f) => a + (f.del ?? 0), 0)
  pieces.push({
    key: '', h: git && added + removed > 0 ? 34 : 24,
    draw: (x, y, w) => {
      if (!git) return `<text class="t faint" x="${x}" y="${y + 14}" font-size="11.5">${esc(clip(d.notRepo, Math.floor(w / 6.2)))}</text>`
      const name = clip(git.branch, 40)
      const chipW = cols(name) * 6.6 + 14
      const after = [...(git.ahead > 0 ? [`↑${git.ahead}`] : []), ...(git.behind > 0 ? [`↓${git.behind}`] : []), git.lastCommit > 0 ? t().st.lastCommit(ago(now - git.lastCommit)) : t().st.noCommits].join('  ·  ')
      const total = added + removed
      return `<g transform="translate(${x} ${y + 10})" stroke="#A1A09B" stroke-width="1.3" fill="none" stroke-linecap="round"><circle cx="2" cy="-4" r="1.6"/><circle cx="2" cy="4" r="1.6"/><circle cx="8" cy="-2" r="1.6"/><path d="M2 -2.4V2.4M8 -0.4C8 2 2 1 2 2.4"/></g>` +
        `<rect class="trackf" x="${x + 16}" y="${y + 1}" width="${n(chipW)}" height="18" rx="5"/>` +
        `<text class="m fg" x="${x + 23}" y="${y + 14}" font-size="11.5">${esc(name)}</text>` +
        `<text class="t faint" x="${n(x + 16 + chipW + 8)}" y="${y + 14}" font-size="11">${esc(clip(after, Math.max(6, Math.floor((w - chipW - 30) / 6))))}</text>` +
        (total > 0
          ? `<rect class="trackf" x="${x}" y="${y + 27}" width="${w}" height="3" rx="1.5"/>` +
            `<rect x="${x}" y="${y + 27}" width="${n((w * added) / total)}" height="3" rx="1.5" fill="${ADD_INK}"/>` +
            (removed > 0 ? `<rect x="${n(x + (w * added) / total)}" y="${y + 27}" width="${n((w * removed) / total)}" height="3" rx="1.5" fill="${DEL_INK}"/>` : '')
          : '')
    },
  })
  if (all.length === 0 && git) {
    pieces.push({ key: '', h: 26, draw: (x, y) => `<text class="t faint" x="${x}" y="${y + 18}" font-size="11.5">${esc(d.cleanTree)}</text>` })
  }

  // What opens under a line: the file picked, else the last edit while it is not put away.
  const picked = env.diff && env.diff.path !== '' && all.some(e => e.row.path === env.diff?.path) ? env.diff : null
  const hunk = env.lastEdit
  const root = git?.root ?? ''
  const lastAt = picked === null && hunk !== null && env.diff?.hidden !== hunk.at ? relPath(root, hunk.path) : ''
  const lastLines = (): Line[] => hunk
    ? [...(hunk.ctx ? [{ kind: 'ctx', text: hunk.ctx }] : []), ...hunk.old.map(text => ({ kind: 'old', text })), ...hunk.new.map(text => ({ kind: 'new', text }))] as Line[]
    : []
  const lastBox = () => diffBox(lastLines(), hunk ? (hunk.add - hunk.new.length) + (hunk.del - hunk.old.length) : 0, hunk ? `${d.lastEdit} · ${ago(now - hunk.at)}` : '')
  let isLastShown = false

  const head = (dot: boolean, label: string, count: number, right: string, isRuled: boolean): Piece => ({
    key: '', h: isRuled ? 34 : 24,
    draw: (x, y, w) => {
      const top = y + (isRuled ? 10 : 0)
      return (isRuled ? `<path class="rule" d="M${x} ${y + 4}H${x + w}"/>` : '') +
        (dot ? `<circle cx="${x + 4}" cy="${top + 13}" r="3" fill="${ME_INK}"/>` : '') +
        `<text class="t" x="${x + (dot ? 13 : 0)}" y="${top + 17}" font-size="11"><tspan class="fg" font-weight="600">${esc(label)}</tspan><tspan class="faint" dx="6">· ${esc(d.files(count))}</tspan></text>` +
        `<text class="t faint" x="${x + w}" y="${top + 17}" font-size="10.5" text-anchor="end">${esc(right)}</text>`
    },
  })

  const line = (e: Entry): Piece => {
    const r = e.row
    const isPicked = picked !== null && picked.path === r.path
    const k = changeKind(r.code)
    const key = e.files ? `dir:${r.path}` : git && r.add !== null ? `diff:${r.path}` : ''
    return {
      key, h: e.isChild ? 22 : 26,
      draw: (x, y, w) => {
        const cy = y + (e.isChild ? 11 : 13)
        const timeW = mine.length > 0 ? 40 : 0
        const numR = x + w - timeW
        const barW = Math.max(48, Math.min(110, w * 0.16))
        const barX = numR - 84 - barW
        const nameX = x + 30 + (e.isChild ? 16 : 0)
        let out = isPicked ? `<rect class="trackf" x="${x - 2}" y="${y + 1}" width="${w + 4}" height="${(e.isChild ? 22 : 26) - 2}" rx="6"/><rect x="${x - 2}" y="${y + 4}" width="2.5" height="${(e.isChild ? 22 : 26) - 8}" rx="1" fill="${ME_INK}"/>` : ''
        if (!e.isChild) {
          out += `<rect x="${x}" y="${cy - 9}" width="20" height="18" rx="5" fill="${k.ink}" fill-opacity="0.16"/>` +
            `<text class="m" x="${x + 10}" y="${cy + 4}" font-size="11.5" font-weight="700" text-anchor="middle" fill="${k.ink}">${k.sign}</text>`
        }
        const room = Math.max(8, Math.floor((barX - nameX - 14) / 6.7))
        if (e.files) {
          const chevron = e.isOpen ? 'M0 0L4 4L8 0' : 'M0 0L4 4L0 8'
          out += `<path d="${chevron}" transform="translate(${nameX} ${cy - (e.isOpen ? 2 : 4)})" stroke="#A1A09B" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
            `<text class="t" x="${nameX + 14}" y="${cy + 4}" font-size="12"><tspan class="fg">${esc(clip(r.path, room - 10))}/</tspan><tspan class="faint" font-size="11" dx="7">${esc(d.files(e.files.length))}</tspan></text>`
        } else {
          const name = baseName(r.path)
          const dir = e.isChild ? '' : dirOf(r.path, Math.max(4, room - cols(name) - 2))
          out += `<text class="t" x="${nameX}" y="${cy + 4}" font-size="${e.isChild ? 11.5 : 12}"><tspan class="${e.isChild ? 'dim' : 'fg'}">${esc(clip(name, room))}</tspan><tspan class="faint" font-size="11" dx="6">${esc(dir)}</tspan></text>`
        }
        out += r.add === null
          ? `<text class="t faint" x="${n(numR)}" y="${cy + 4}" font-size="11" text-anchor="end">${esc(r.code === '??' ? d.newFile : d.binary)}</text>`
          : sizeBar(barX, cy, barW, r.add, r.del ?? 0, most) +
            `<text class="m" x="${n(numR)}" y="${cy + 4}" font-size="11.5" font-weight="600" text-anchor="end">${counts(r.add, r.del ?? 0)}</text>`
        if (r.at > 0) out += `<text class="t faint" x="${n(x + w)}" y="${cy + 4}" font-size="10.5" text-anchor="end">${esc(age(now - r.at) || t().justNow)}</text>`
        return out
      },
    }
  }
  const lines = (entries: Entry[]) => {
    for (const e of entries) {
      pieces.push(line(e))
      if (picked !== null && picked.path === e.row.path && !e.files) pieces.push(diffBox(picked.lines, picked.more, ''))
      else if (lastAt !== '' && lastAt === e.row.path && !isLastShown) {
        isLastShown = true
        pieces.push(lastBox())
      }
    }
  }

  if (mine.length > 0) {
    pieces.push(head(true, d.mine, mine.length, d.newest, false))
    lines(mine)
  }
  if (rest.length > 0) {
    pieces.push(head(false, mine.length > 0 ? d.others : d.allChanges, restCount, d.biggest, mine.length > 0))
    lines(rest)
  }
  if (hidden.length > 0) {
    const names = hidden.slice(0, 3).map(r => baseName(r.path)).join(', ') + (hidden.length > 3 ? '…' : '')
    pieces.push({ key: '', h: 20, draw: (x, y, w) => `<text class="t faint" x="${x + 30}" y="${y + 13}" font-size="11">${esc(clip(`${d.moreFiles(hidden.length)} · ${names}`, Math.floor((w - 30) / 6)))}</text>` })
  }
  // The last edit in a file the list does not show (or outside a repository's lines): under the list.
  if (lastAt !== '' && !isLastShown) pieces.push(lastBox())
  if (all.length > 0) {
    pieces.push({
      key: '', h: 26,
      draw: (x, y, w) => {
        const sign = (sx: number, s: string, ink: string) => `<rect x="${sx}" y="${y + 9}" width="16" height="14" rx="4" fill="${ink}" fill-opacity="0.16"/><text class="m" x="${sx + 8}" y="${y + 20}" font-size="10" font-weight="700" text-anchor="middle" fill="${ink}">${s}</text>`
        return sign(x, '+', ADD_INK) + `<text class="t faint" x="${x + 22}" y="${y + 20}" font-size="10.5">${esc(d.newFile)}</text>` +
          sign(x + 34 + cols(d.newFile) * 6, '~', MOD_INK) + `<text class="t faint" x="${n(x + 56 + cols(d.newFile) * 6)}" y="${y + 20}" font-size="10.5">${esc(d.changed)}</text>` +
          (hint ? `<text class="t faint" x="${x + w}" y="${y + 20}" font-size="10.5" text-anchor="end">${esc(d.rowHint)}</text>` : '')
      },
    })
  }
  return pieces
}

/** A strip of Changes as its own drawing, `width` wide, for a line the desktop makes pressable. */
export function pieceSvg(piece: Piece, width: number): string {
  const W = Math.max(280, Math.round(width))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${piece.h}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${rtlStyle()}${DEFS}${piece.draw(2, 0, W - 4)}</svg>`
}

/** Changes as one card, as the section, the snapshot and a surface without pressable lines draw it. */
function changesCard(env: Env, now: number): Card | null {
  const git = env.git
  const all = changeRows(env)
  if (all.length === 0 && env.lastEdit === null && git === null) return null
  const pieces = changesPieces(env, now)
  const count = git ? git.changed : all.length
  const added = all.reduce((a, r) => a + (r.add ?? 0), 0)
  const removed = all.reduce((a, r) => a + (r.del ?? 0), 0)
  return {
    title: t().detail.changes,
    right: count > 0 ? `${t().detail.files(count)} · +${thousands(added)} −${thousands(removed)}` : git ? t().detail.clean : '',
    content: pieces.reduce((a, p) => a + p.h, 0) - 12,
    body: (x, y, w) => {
      let at = y
      return pieces.map(p => {
        const out = p.draw(x, at, w)
        at += p.h
        return out
      }).join('')
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
        const pic = next ? WEAR[next.item] : undefined
        return badge +
          `<text class="t fg" x="${tx}" y="${y + 16}" font-size="14" font-weight="650">${esc(t().detail.levelN(lv.level))}</text>` +
          `<rect class="trackf" x="${tx}" y="${y + 26}" width="${n(barW)}" height="6" rx="3"/><rect x="${tx}" y="${y + 26}" width="${n((barW * progress) / 100)}" height="6" rx="3" fill="#E08A6A"/>` +
          `<text class="t faint" x="${tx}" y="${y + 48}" font-size="11">${esc(clip(`${t().detail.toNext(thousands(lv.next - xp))}${total ? ` · ${t().detail.totals(thousands(total.turns), thousands(total.edits), total.commits)}` : ''}`, room))}</text>` +
          `<text class="t faint" x="${tx}" y="${y + 66}" font-size="11">${esc(clip(`${t().detail.wardrobeCount(open.length)}${next ? ` · ${t().detail.next(itemName(next.item), hintFor(next.item))}` : ''}`, room))}</text>` +
          (pic ? `<image href="${pic.uri}" x="${n(x + w - 26)}" y="${y + 52}" width="${n(Math.min(26, (20 * pic.w) / pic.h))}" height="20" opacity="0.35"/>` : '')
      },
    })
  }

  const card = cards[0]
  if (card === undefined) return ''
  const H = card.content + 12
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${rtlStyle()}${DEFS}${card.body(2, 6, W - 4)}</svg>`
}

/** The drawing's height for a width, so the pane can size the image. */
export function detailHeight(svg: string): number {
  return Number(/viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 400)
}

/** The same facts as lines, for the terminal. */
export function detailLines(env: Env, now: number): string[] {
  const parts = partLines(env, now)
  return PARTS.flatMap(p => parts[p])
}

/** The terminal's lines by part, for its folding sections. */
export function partLines(env: Env, now: number): Record<Part, string[]> {
  const tools = Object.values(env.kinds).reduce((a, b) => a + b, 0)
  const d = t().detail
  const overview = [
    `${d.lineSession(env.turns.length, tools)}${env.cost > 0 ? ` · $${env.cost.toFixed(2)}` : ''}`,
    ...env.limits.map(l => `${limitName(l.kind)}: ${Math.round(l.percent)}%${l.resetsAt > now ? ` · ${d.resetsIn(until(l.resetsAt - now))}` : ''}`),
  ]
  const context = [
    `${d.lineContext}: ${tokens(env.tokens)} / ${tokens(env.window)}${env.compactAt > 0 ? ` · ${d.compactsAt(tokens(env.compactAt))}` : ''}`,
    ...env.slices.map(s => `  ${categoryName(s.name)}: ${tokens(s.tokens)}`),
  ]
  const changes: string[] = []
  if (env.git) {
    const g = env.git
    const add = g.files.reduce((a, f) => a + (f.add ?? 0), 0)
    const del = g.files.reduce((a, f) => a + (f.del ?? 0), 0)
    changes.push(`${d.lineGit(g.branch, g.changed)} · +${add} −${del}${g.ahead ? ` · ↑${g.ahead}` : ''}${g.behind ? ` · ↓${g.behind}` : ''}`)
    for (const f of g.files.slice(0, 8)) changes.push(`  ${changeKind(f.code).sign} ${f.path}${f.add !== undefined ? `  +${f.add} −${f.del ?? 0}` : ''}`)
  }
  changes.push(...ciLines(env, now))
  const picked = env.diff
  if (picked && picked.path !== '' && env.git?.files.some(f => f.path === picked.path)) {
    changes.push(picked.path)
    for (const l of picked.lines) changes.push(`  ${l.kind === 'old' ? '−' : l.kind === 'new' ? '+' : ' '} ${l.text}`)
    if (picked.more > 0) changes.push(`  ${d.moreLines(picked.more)}`)
  } else if (env.lastEdit) {
    const h = env.lastEdit
    changes.push(`${d.lineLastEdit(baseName(h.path), ago(now - h.at))} · +${h.add} −${h.del}`)
    for (const line of h.old) changes.push(`  − ${line}`)
    for (const line of h.new) changes.push(`  + ${line}`)
  }
  const hist = env.history
  const today = dayKey(now, env.tz ?? 0)
  const week = hist ? Array.from({ length: 7 }, (_, i) => hist.days[shiftDay(today, -i)]?.turns ?? 0).reduce((a, b) => a + b, 0) : 0
  const activity = hist && hist.activeDays > 0
    ? [`${hist.days[today]?.turns ?? 0} ${d.today} · ${week} ${d.last7} · ${hist.streak} ${d.streak} · ${thousands(hist.total.turns)} ${d.total(hist.activeDays)}`]
    : []
  return { overview, chats: (env.peers ?? []).length > 0 ? boardLines(env.me, env.peers, now) : [], changes, context, activity }
}
