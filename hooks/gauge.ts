// Ring gauges: the panel's and the detail pane's way of showing how full
// something is. One or many arcs around a track, an optional notch, an
// optional pulsing halo, and arcs that glide from what they showed before.

export type Arc = { key: string; value: number; color: string }

export type Ring = {
  id: string
  cx: number
  cy: number
  r: number
  width: number
  /** Shares of the full turn, in percent, drawn clockwise from the top. */
  arcs: Arc[]
  /** What the arcs showed before; matched by key, so they glide. */
  was?: Arc[]
  /** A notch at this percent (the compaction point). */
  mark?: number
  markColor?: string
  /** A halo that breathes around the ring, for a warning. */
  halo?: string
  /** Text in the middle. */
  center?: string
  centerSize?: number
}

const n = (v: number) => String(Math.round(v * 100) / 100)
const EASE = 'calcMode="spline" keyTimes="0;1" keySplines="0.35 0 0.15 1"'

function glide(attr: string, from: string, to: string): string {
  return from === to ? '' : `<animate attributeName="${attr}" values="${from};${to}" dur="0.9s" fill="freeze" ${EASE}/>`
}

/** Where each arc starts and how long it is along the circle. */
function lay(arcs: Arc[], c: number, gap: number): Map<string, { start: number; len: number }> {
  const out = new Map<string, { start: number; len: number }>()
  let at = 0
  for (const a of arcs) {
    const full = (Math.max(0, a.value) / 100) * c
    const len = arcs.length > 1 ? Math.max(0, full - gap) : full
    out.set(a.key, { start: at, len })
    at += full
  }
  return out
}

export function ring(g: Ring): string {
  const c = 2 * Math.PI * g.r
  const gap = g.arcs.length > 1 ? Math.min(1.6, g.width * 0.35) : 0
  const now = lay(g.arcs, c, gap)
  const before = g.was ? lay(g.was, c, gap) : now
  const cap = g.arcs.length > 1 ? 'butt' : 'round'

  const arcs = g.arcs.map(a => {
    const p = now.get(a.key) ?? { start: 0, len: 0 }
    const q = before.get(a.key) ?? { start: p.start, len: 0 }
    const dash = (len: number) => `${n(len)} ${n(c)}`
    return `<circle cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}" fill="none" stroke="${a.color}" stroke-width="${n(g.width)}" stroke-linecap="${cap}" ` +
      `stroke-dasharray="${dash(p.len)}" stroke-dashoffset="${n(-p.start)}">` +
      glide('stroke-dasharray', dash(q.len), dash(p.len)) + glide('stroke-dashoffset', n(-q.start), n(-p.start)) + '</circle>'
  }).join('')

  const mark = g.mark !== undefined && g.mark > 0 && g.mark < 100
    ? (() => {
        const t = (g.mark / 100) * 2 * Math.PI
        const r1 = g.r - g.width / 2 - 1.5
        const r2 = g.r + g.width / 2 + 1.5
        return `<line x1="${n(g.cx + r1 * Math.cos(t))}" y1="${n(g.cy + r1 * Math.sin(t))}" x2="${n(g.cx + r2 * Math.cos(t))}" y2="${n(g.cy + r2 * Math.sin(t))}" stroke="${g.markColor ?? '#F2C14E'}" stroke-width="1.6" stroke-linecap="round"/>`
      })()
    : ''

  const halo = g.halo
    ? `<circle cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}" fill="none" stroke="${g.halo}" stroke-width="${n(g.width + 7)}" filter="url(#soft)" opacity="0.25"><animate attributeName="opacity" values="0.12;0.5;0.12" dur="1.8s" repeatCount="indefinite"/></circle>`
    : ''

  const center = g.center
    ? `<text class="t fg" x="${n(g.cx)}" y="${n(g.cy + (g.centerSize ?? 11) * 0.36)}" font-size="${g.centerSize ?? 11}" font-weight="650" text-anchor="middle" font-variant-numeric="tabular-nums">${g.center}</text>`
    : ''

  return `<g>${halo}<circle class="track" cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}" fill="none" stroke-width="${n(g.width)}"/>` +
    `<g transform="rotate(-90 ${n(g.cx)} ${n(g.cy)})">${arcs}${mark}</g>${center}</g>`
}

/** Severity colours for a usage window. */
export function usageInk(p: number): string {
  if (p >= 80) return '#F0645A'
  if (p >= 50) return '#F2B84B'
  return '#4CC38A'
}

/** The shared styles and filters every drawing of the mod uses. */
export const STYLE = '<style>:root{color-scheme:light dark}' +
  '.t{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif}' +
  '.m{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace}' +
  '.fg{fill:#F1ECE7}.dim{fill:#A59D96}.faint{fill:#77706A}.track{stroke:#fff;stroke-opacity:.09}.trackf{fill:#fff;fill-opacity:.07}' +
  '.card{fill:#fff;fill-opacity:.03;stroke:#fff;stroke-opacity:.06}.rule{stroke:#fff;stroke-opacity:.08}' +
  '@media (prefers-color-scheme:light){.fg{fill:#26211D}.dim{fill:#776E68}.faint{fill:#A49B95}.track{stroke:#000;stroke-opacity:.08}.trackf{fill:#000;fill-opacity:.06}' +
  '.card{fill:#000;fill-opacity:.025;stroke:#000;stroke-opacity:.06}.rule{stroke:#000;stroke-opacity:.08}}' +
  'html,body{margin:0;background:transparent}</style>'

export const DEFS = '<defs>' +
  '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>' +
  '<filter id="haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>' +
  '<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="#9D958F" opacity="0.55"/></pattern>' +
  '</defs>'
