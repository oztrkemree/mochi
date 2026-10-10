// Draws docs/demo.svg, the README's animation: the desktop band as Mochi
// draws it, through eight moods and a few outfits, one after another, on a
// loop. It is the real drawing code, run as it is; from the repository's
// folder, with Node 22.18 or later (Node reads the TypeScript itself):
//
//   node scripts/demo.mjs

import { writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'

// The hooks import each other without the `.ts` the engine does not need.
registerHooks({
  resolve(spec, context, next) {
    try {
      return next(spec, context)
    } catch (e) {
      if (spec.startsWith('.')) return next(`${spec}.ts`, context)
      throw e
    }
  },
})

const { setLang, t } = await import('../hooks/i18n.ts')
const { DEFS, STYLE } = await import('../hooks/gauge.ts')
const { itemName } = await import('../hooks/level.ts')
const { moodLabel } = await import('../hooks/looks.ts')
const { PANEL_H, panelSvg } = await import('../hooks/panel.ts')
const { beforeTool, onTurnEnd, restLine } = await import('../hooks/react.ts')
const { BG } = await import('../hooks/share.ts')

setLang('en')
const st = t().st
const W = 720
const PAD = 12
const SLOT_S = 2.6
const FADE_S = 0.3
/** A fixed moment, so the drawing comes out the same on every run. */
const NOW = Date.UTC(2026, 9, 10, 15, 0)

const ok = kind => ({ kind, state: 'ok' })
const run = kind => ({ kind, state: 'run' })
const read3 = [ok('read'), ok('search'), ok('read')]
const turn = [...read3, ok('edit'), ok('edit'), ok('bash')]

/** What each moment shows: a reaction from the real code, what Mochi wears, and the band's figures. */
const frames = [
  { r: { mood: 'wave', line: st.ready }, wear: { head: 'beanie' }, ctx: 12, recent: [] },
  { r: beforeTool({ tool: 'Read', file_path: 'hooks/rig.ts' }), wear: { head: 'headphones', face: 'glasses' }, ctx: 18, busy: true, recent: [...read3.slice(0, 2), run('read')] },
  { r: beforeTool({ tool: 'Edit', file_path: 'hooks/panel.ts' }), wear: { head: 'headphones', face: 'glasses' }, ctx: 24, busy: true, recent: [...read3, run('edit')] },
  { r: beforeTool({ tool: 'Bash', command: 'npm run build' }), wear: { head: 'hardhat' }, ctx: 31, busy: true, recent: [...turn.slice(0, 5), run('bash')] },
  { r: onTurnEnd({ reason: 'completed', seconds: 74, tools: 6, edits: 2, errors: 0 }), wear: { head: 'crown', neck: 'bowtie' }, ctx: 34, recent: turn },
  { r: beforeTool({ tool: 'AskUserQuestion' }), wear: { head: 'wizard', neck: 'scarf' }, ctx: 38, busy: true, recent: [...turn, run('ask')] },
  { r: { mood: 'party', line: [st.level(8), st.newItems(itemName('chefhat'))].join(' · ') }, wear: { head: 'partyhat', neck: 'medal', ground: 'cat' }, ctx: 41, recent: [...turn, ok('ask')] },
  { r: { mood: 'sleeping', line: restLine('sleeping', 12 * 60_000) }, wear: { head: 'nightcap', ground: 'duck' }, ctx: 41, recent: [...turn, ok('ask')] },
]

const outfit = wear => ({ head: null, face: null, neck: null, held: null, ground: null, ...wear })
let last = ''

/** One moment as the band draws it, its ids made its own so the moments do not share gradients and masks. */
function draw(f, i) {
  if (f.r.mood === 'proud') last = f.r.line.split(' · ').slice(1).join(' · ')
  const info = {
    label: moodLabel(f.r.mood),
    detail: f.r.line,
    context: { percent: f.ctx, tokens: f.ctx * 2000, window: 200_000, slices: [{ name: 'System prompt', tokens: 9000, color: '' }, { name: 'Messages', tokens: f.ctx * 2000 - 9000, color: '' }] },
    limits: [{ kind: 'five_hour', percent: 18 + i * 3, resetsAt: NOW + 134 * 60_000 }, { kind: 'seven_day', percent: 52 + i, resetsAt: NOW + 3 * 86_400_000 + 4 * 3_600_000 }],
    cost: Math.round((0.18 + i * 0.15) * 100) / 100,
    agents: 0,
    tools: f.recent.length,
    isBusy: f.busy === true,
    recent: f.recent.map((r, k) => ({ ...r, id: k })),
    last,
    compactPct: 83.5,
    warn: 0,
    git: { branch: 'main', changed: i >= 2 ? 2 : 0, ahead: i >= 4 ? 1 : 0, behind: 0, lastCommit: NOW - 3 * 3_600_000 },
    forecast: {},
    tz: 0,
    peers: [],
  }
  const shot = { mood: f.r.mood, scene: { context: Math.round(f.ctx / 5) * 5, agents: 0, outfit: outfit(f.wear) }, at: NOW, from: null }
  const { svg } = panelSvg({ panel: { shot, info, infoFrom: null, infoAt: NOW }, now: NOW, width: W })
  return svg
    .slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
    .replace(STYLE, '')
    .replace(DEFS, '')
    .replace(/(id="|url\(#)(bm|liq|glow|blush)\b/g, `$1$2-${i}`)
}

/** When moment `i` shows over the loop: it fades in as the one before fades out. */
function timing(i) {
  const total = frames.length * SLOT_S
  const at = s => Math.max(0, Math.min(1, s / total))
  const keys = i === 0
    ? [[0, 1], [at(SLOT_S - FADE_S), 1], [at(SLOT_S), 0], [at(total - FADE_S), 0], [1, 1]]
    : [[0, 0], [at(i * SLOT_S - FADE_S), 0], [at(i * SLOT_S), 1], [at((i + 1) * SLOT_S - FADE_S), 1], [at((i + 1) * SLOT_S), 0], [1, 0]]
  const kept = keys.filter((k, j) => j === 0 || k[0] > keys[j - 1][0])
  const r = v => Math.round(v * 10_000) / 10_000
  return `<animate attributeName="opacity" values="${kept.map(k => k[1]).join(';')}" keyTimes="${kept.map(k => r(k[0])).join(';')}" dur="${total}s" repeatCount="indefinite"/>`
}

let body = frames.map((f, i) => `<g opacity="${i === 0 ? 1 : 0}">${timing(i)}${draw(f, i)}</g>`).join('')

// Every picture once: each moment draws the same clay, so the moments point at one copy.
const ids = new Map()
body = body.replace(/<image href="(data:[^"]+)" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g, (_, uri, x, y, w, h) => {
  if (!ids.has(uri)) ids.set(uri, `p${ids.size}`)
  return `<use href="#${ids.get(uri)}" x="${x}" y="${y}" width="${w}" height="${h}"`
})
const pictures = [...ids].map(([uri, id]) => `<symbol id="${id}" viewBox="0 0 1 1" preserveAspectRatio="none"><image href="${uri}" width="1" height="1" preserveAspectRatio="none"/></symbol>`).join('')

const w = W + PAD * 2
const h = PANEL_H + PAD * 2
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>Mochi for Claude Code</title>` +
  STYLE + BG + DEFS.replace('</defs>', `${pictures}</defs>`) +
  `<rect class="bg" x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="16"/>` +
  `<g transform="translate(${PAD} ${PAD})">${body}</g></svg>\n`

writeFileSync(new URL('../docs/demo.svg', import.meta.url), svg)
console.log(`docs/demo.svg: ${frames.length} moments, ${Math.round(svg.length / 1024)} KB`)
