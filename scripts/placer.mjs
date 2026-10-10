#!/usr/bin/env node
// A small page to place what Mochi wears: drag, scroll to scale, and every
// change is written straight into WEAR_AT in hooks/rig.ts.
//   node scripts/placer.mjs   → http://localhost:5174
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RIG = join(ROOT, 'hooks', 'rig.ts')
const read = f => readFileSync(join(ROOT, 'hooks', f), 'utf8')
const PORT = Number(process.env.PORT ?? 5174)

/** Every line of a block that looks like `  id: { ... },`. */
const lines = (src, from) => {
  const at = src.indexOf(from)
  const end = src.indexOf('\n}', at)
  return src.slice(at, end).split('\n')
}

function state() {
  const art = {}
  for (const l of read('assets.ts').split('\n')) {
    const m = /^ {2}(body|arm|foot): \{ w: (\d+), h: (\d+), uri: '([^']+)'/.exec(l)
    if (m) art[m[1]] = { w: +m[2], h: +m[3], uri: m[4] }
  }
  const wear = {}
  for (const l of read('wear.ts').split('\n')) {
    const m = /^ {2}(\w+): \{ w: (\d+), h: (\d+), uri: '([^']+)'/.exec(l)
    if (m) wear[m[1]] = { w: +m[2], h: +m[3], uri: m[4] }
  }
  const level = read('level.ts')
  const slotOf = {}
  const block = level.slice(level.indexOf('export const SLOT_ITEMS'), level.indexOf('export const SLOT:'))
  for (const m of block.matchAll(/(head|face|neck|held|ground): \[([^\]]*)\]/g)) {
    for (const id of m[2].matchAll(/'(\w+)'/g)) slotOf[id[1]] = m[1]
  }
  const items = []
  for (const l of lines(read('rig.ts'), 'export const WEAR_AT')) {
    const m = /^ {2}(\w+): \{ (.*) \},?$/.exec(l)
    if (!m || !wear[m[1]]) continue
    const at = { id: m[1], slot: slotOf[m[1]] ?? 'head', pw: wear[m[1]].w, ph: wear[m[1]].h, uri: wear[m[1]].uri, x: 50, y: 50, w: 20 }
    for (const kv of m[2].split(', ')) {
      const [k, v] = kv.split(': ')
      at[k] = v === 'true' ? true : Number(v)
    }
    items.push(at)
  }
  return { art, items }
}

const backup = join(tmpdir(), 'mochi-rig.ts.bak')

function save({ id, x, y, w, r, stretch, skew, flip }) {
  if (!/^\w+$/.test(id) || ![x, y, w, r, stretch, skew].every(Number.isFinite)) return false
  if (!existsSync(backup)) copyFileSync(RIG, backup)
  const src = readFileSync(RIG, 'utf8')
  const re = new RegExp(`^ {2}${id}: \\{ (.*) \\},$`, 'm')
  const m = re.exec(src)
  if (!m) return false
  const old = Object.fromEntries(m[1].split(', ').map(kv => kv.split(': ')))
  const q = v => String(Math.round(v * 10) / 10)
  const parts = [`x: ${q(x)}`, `y: ${q(y)}`, `w: ${q(w)}`]
  if (r) parts.push(`r: ${Math.round(r)}`)
  if (old.s !== undefined) parts.push(`s: ${old.s}`)
  if (stretch !== 1) parts.push(`stretch: ${Math.round(stretch * 100) / 100}`)
  if (skew) parts.push(`skew: ${Math.round(skew)}`)
  if (flip) parts.push('flip: true')
  if (old.ground !== undefined) parts.push('ground: true')
  writeFileSync(RIG, src.replace(re, `  ${id}: { ${parts.join(', ')} },`))
  return true
}


// ---------- delete: take an item out of every place it lives in ----------

const F = {
  types: join(ROOT, 'types', 'index.d.ts'),
  level: join(ROOT, 'hooks', 'level.ts'),
  rig: RIG,
  wear: join(ROOT, 'hooks', 'wear.ts'),
  tests: join(ROOT, 'tests', 'mochi.test.ts'),
}
const langs = readdirSync(join(ROOT, 'hooks', 'lang')).filter(f => f.endsWith('.ts')).map(f => join(ROOT, 'hooks', 'lang', f))
const docs = readdirSync(ROOT).filter(f => /^README.*\.md$/.test(f)).map(f => join(ROOT, f)).concat(join(ROOT, 'docs', 'OUTFITS.md'))
let lastDelete = null

const total = () => {
  const level = readFileSync(F.level, 'utf8')
  const block = level.slice(level.indexOf('export const SLOT_ITEMS'), level.indexOf('export const SLOT:'))
  return [...block.matchAll(/'(\w+)'/g)].length
}

/** `id: 'text',` taken out of a line, with the comma and space after it. */
function dropEntry(line, id) {
  const key = id + ": '"
  let at = line.indexOf(key)
  while (at > 0 && /\w/.test(line[at - 1])) at = line.indexOf(key, at + 1)
  if (at < 0) return line
  const end = line.indexOf("'", at + key.length)
  let to = end + 1
  if (line[to] === ',') to += 1
  if (line[to] === ' ') to += 1
  return line.slice(0, at) + line.slice(to)
}

/** The file's text with the item gone, or null when something else still names it. */
function without(id, file, text) {
  const NL = String.fromCharCode(10)
  const tag = "'" + id + "'"
  const blank = l => l.trim() === '' && l !== ''
  let lines = text.split(NL)
  if (file === F.types) {
    lines = lines.map(l => l.replace('| ' + tag, '')).filter(l => !blank(l))
  } else if (file === F.level) {
    lines = lines
      .filter(l => !l.trim().startsWith('{ item: ' + tag + ','))
      .map(l => l.split(tag + ', ').join('').split(', ' + tag + ']').join(']').split(tag + ']').join(']'))
      .map(l => dropEntry(l, id))
      .filter(l => !blank(l))
    if (lines.some(l => l.includes(tag))) return null // worn on a day or ranked: not a plain item
  } else if (file === F.rig) {
    lines = lines.filter(l => !l.startsWith('  ' + id + ': {'))
  } else if (file === F.wear) {
    lines = lines.filter(l => !l.startsWith('  ' + id + ': { w:'))
  } else {
    const from = lines.findIndex(l => l === '  item: {')
    const to = lines.findIndex((l, i) => i > from && l.startsWith('    slot:'))
    if (from < 0 || to < 0) return text
    lines = [...lines.slice(0, from), ...lines.slice(from, to).map(l => dropEntry(l, id)).filter(l => !blank(l) && l.trim() !== ','), ...lines.slice(to)]
  }
  return lines.join(NL)
}

function remove(id) {
  if (!/^\w+$/.test(id)) return { ok: false, why: 'bad id' }
  const files = [F.types, F.level, F.rig, F.wear, ...langs]
  const next = new Map()
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    const out = without(id, f, text)
    if (out === null) return { ok: false, why: id + ' is worn on a day or ranked in level.ts; remove it by hand' }
    next.set(f, out)
  }
  const before = total()
  const dir = mkdtempSync(join(tmpdir(), 'mochi-delete-'))
  const saved = []
  for (const f of [...files, ...docs, F.tests]) {
    const name = `${saved.length}.bak`
    copyFileSync(f, join(dir, name))
    saved.push([f, join(dir, name)])
  }
  for (const [f, out] of next) writeFileSync(f, out)
  const after = total()
  // The counts the READMEs and the pane's test quote.
  for (const f of docs) {
    const lns = readFileSync(f, 'utf8').split('\n')
    const rows = f.endsWith('OUTFITS.md') ? [2] : [13, 158]
    for (const i of rows) if (lns[i] !== undefined) lns[i] = lns[i].replace(new RegExp('(?<![0-9.])' + before + '(?![0-9])', 'g'), String(after))
    writeFileSync(f, lns.join('\n'))
  }
  lastDelete = { id, saved }
  return { ok: true, total: after }
}

function undo() {
  if (!lastDelete) return { ok: false, why: 'nothing to undo' }
  for (const [f, bak] of lastDelete.saved) copyFileSync(bak, f)
  const id = lastDelete.id
  lastDelete = null
  return { ok: true, id }
}

createServer((req, res) => {
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body) }
  if (req.method === 'GET' && req.url === '/') return send(200, 'text/html; charset=utf-8', PAGE)
  if (req.method === 'GET' && req.url === '/api') return send(200, 'application/json', JSON.stringify(state()))
  if (req.method === 'POST' && req.url === '/api/save') {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try { send(200, 'application/json', JSON.stringify({ ok: save(JSON.parse(body)) })) } catch { send(400, 'application/json', '{"ok":false}') }
    })
    return
  }
  if (req.method === 'POST' && req.url === '/api/delete') {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try { send(200, 'application/json', JSON.stringify(remove(JSON.parse(body).id))) } catch (e) { send(400, 'application/json', JSON.stringify({ ok: false, why: String(e) })) }
    })
    return
  }
  if (req.method === 'POST' && req.url === '/api/undo') return send(200, 'application/json', JSON.stringify(undo()))
  send(404, 'text/plain', 'not found')
}).listen(PORT, '127.0.0.1', () => console.log(`Mochi placer: http://localhost:${PORT}  (writes hooks/rig.ts; backup at ${backup})`))

const PAGE = `<!doctype html><meta charset="utf-8"><title>Mochi placer</title>
<style>
*{box-sizing:border-box}body{margin:0;font:13px system-ui;background:#f4efe9;color:#2b1b17;display:flex;height:100vh}
#list{width:230px;overflow:auto;background:#fff;border-right:1px solid #0002;padding:8px}
#list h4{margin:10px 4px 4px;text-transform:uppercase;font-size:11px;color:#8a7d76}
.it{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:8px;cursor:pointer}
.it:hover{background:#f4efe9}.it.on{background:#d97757;color:#fff}.it img{width:34px;height:26px;object-fit:contain}
#main{flex:1;display:flex;align-items:center;justify-content:center;min-width:0}
#stage{height:min(92vh,92vw - 520px);aspect-ratio:1;background:#fff;border-radius:16px;box-shadow:0 2px 10px #0002;touch-action:none}
#side{width:260px;padding:14px;background:#fff;border-left:1px solid #0002;overflow:auto}
#side label{display:grid;grid-template-columns:22px 1fr 58px;gap:6px;align-items:center;margin:8px 0}
#side input[type=number]{width:58px}
#status{margin-top:14px;padding:8px;border-radius:8px;background:#e8f5e9;color:#1b5e20;min-height:34px}
.k{color:#8a7d76;font-size:12px;line-height:1.6;margin-top:12px}
</style>
<div id="list"></div>
<div id="main"><svg id="stage" viewBox="0 0 100 100"></svg></div>
<div id="side">
  <h3 id="name">-</h3>
  <label>x<input id="sx" type="range" min="0" max="100" step="0.1"><input id="nx" type="number" step="0.1"></label>
  <label>y<input id="sy" type="range" min="0" max="100" step="0.1"><input id="ny" type="number" step="0.1"></label>
  <label>w<input id="sw" type="range" min="4" max="90" step="0.1"><input id="nw" type="number" step="0.1"></label>
  <label>r<input id="sr" type="range" min="-45" max="45" step="1"><input id="nr" type="number" step="1"></label>
  <label title="height, 1 = as drawn">↕<input id="sstretch" type="range" min="0.4" max="2.5" step="0.01"><input id="nstretch" type="number" step="0.01"></label>
  <label title="lean sideways, degrees">⟋<input id="sskew" type="range" min="-40" max="40" step="1"><input id="nskew" type="number" step="1"></label>
  <label><span></span><span><input id="flip" type="checkbox"> mirror</span><span></span></label>
  <label><span></span><span><input id="guides" type="checkbox" checked> guides</span><span></span></label>
  <button id="del" style="width:100%;margin-top:10px;padding:9px;border:0;border-radius:8px;background:#c62828;color:#fff;font-weight:600;cursor:pointer">Delete this item completely</button>
  <button id="undo" style="width:100%;margin-top:6px;padding:7px;border:1px solid #0003;border-radius:8px;background:#fff;cursor:pointer" disabled>Undo last delete</button>
  <div id="status">-</div>
  <div class="k">drag: move · wheel: scale · alt+wheel: stretch · arrows: nudge (shift = 2)<br>+ / −: scale · [ ] : rotate · N / P: next / previous<br>Every change is saved to hooks/rig.ts at once.<br>Del: delete the item from every file (asks first).</div>
</div>
<script>
const $ = id => document.getElementById(id)
const NS = 'http://www.w3.org/2000/svg'
let S, cur, timer
const stage = $('stage')
const img = (a, x, y, w, extra = '') => '<image href="' + a.uri + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + (w * a.h / a.w) + '" ' + extra + '/>'

function mochi() {
  const A = S.art
  const arm = (px, py, deg) => '<g transform="rotate(' + deg + ' ' + px + ' ' + py + ')"><rect x="' + (px - 3.2) + '" y="' + (py - 2.3) + '" width="6.4" height="14" rx="3.2" fill="#D27352"/>' + img(A.arm, px - 3.5, py - 2.5, 7) + '</g>'
  const antenna = cur && cur.slot === 'head' ? '' :
    '<path d="M50 34 Q49 27 50 21" stroke="#B65A3C" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="50" cy="17.5" r="4" fill="#FFB38A"/>'
  return '<ellipse cx="50" cy="88.5" rx="21" ry="3" fill="#2B1B17" opacity="0.13"/>' +
    '<rect x="33.5" y="79.6" width="14" height="6.4" rx="3.2" fill="#C9694A"/>' + img(A.foot, 33, 79, 15) +
    '<rect x="52.5" y="79.6" width="14" height="6.4" rx="3.2" fill="#C9694A"/>' + img(A.foot, 52, 79, 15) +
    antenna + '<rect x="22" y="32" width="56" height="48.5" rx="19" fill="#D97757"/>' + img(A.body, 21, 31, 58) +
    '<ellipse cx="40" cy="52" rx="3.3" ry="4.3" fill="#2B1B17"/><ellipse cx="60" cy="52" rx="3.3" ry="4.3" fill="#2B1B17"/>' +
    '<circle cx="41.3" cy="50.2" r="1.15" fill="#fff"/><circle cx="61.3" cy="50.2" r="1.15" fill="#fff"/>' +
    '<path d="M44.4 62.6Q50 68.4 55.6 62.6Q50 66.6 44.4 62.6Z" fill="#2B1B17"/>' +
    arm(23.5, 55, 16) + arm(76.5, 55, -16)
}

function guides() {
  if (!$('guides').checked) return ''
  const l = (y, t) => '<line x1="0" x2="100" y1="' + y + '" y2="' + y + '" stroke="#5b8def" stroke-width="0.15" stroke-dasharray="1 1"/><text x="1" y="' + (y - 0.6) + '" font-size="2.2" fill="#5b8def">' + t + '</text>'
  return l(30, 'head top 30') + l(52, 'eyes 52') + l(60, 'mouth 60') + l(75, 'collar 75') + l(88, 'ground 88') +
    '<line x1="50" x2="50" y1="0" y2="100" stroke="#5b8def" stroke-width="0.15" stroke-dasharray="1 1"/>'
}

function wearOf(it) {
  const h = it.w * it.h / it.w0
  // Same order as rig.ts: stretch and skew about the center, inside the mirror, inside the tilt.
  const lean = 'translate(' + it.x + ' ' + it.y + ') skewX(' + (it.skew || 0) + ') scale(1 ' + (it.stretch || 1) + ') translate(' + (-it.x) + ' ' + (-it.y) + ')'
  const pic = img({ uri: it.uri, w: it.w0, h: it.h }, it.x - it.w / 2, it.y - h / 2, it.w, ' transform="' + lean + '"')
  const turn = 'rotate(' + (it.r || 0) + ' ' + it.x + ' ' + it.y + ')'
  const mirror = it.flip ? 'translate(' + (it.x * 2) + ' 0) scale(-1 1)' : ''
  return '<g transform="' + turn + '" style="cursor:move"><g transform="' + mirror + '">' + pic + '</g></g>' +
    '<rect x="' + (it.x - it.w / 2) + '" y="' + (it.y - h / 2) + '" width="' + it.w + '" height="' + h + '" fill="none" stroke="#d97757" stroke-width="0.25" stroke-dasharray="1 0.8" transform="' + turn + ' ' + mirror + ' ' + lean + '"/>'
}

function draw() {
  stage.innerHTML = mochi() + guides() + (cur ? wearOf(cur) : '')
  if (!cur) return
  $('name').textContent = cur.id + '  (' + cur.slot + ')'
  for (const [k, v] of [['x', cur.x], ['y', cur.y], ['w', cur.w], ['r', cur.r || 0], ['stretch', cur.stretch || 1], ['skew', cur.skew || 0]]) { $('s' + k).value = v; $('n' + k).value = Math.round(v * 10) / 10 }
  $('flip').checked = !!cur.flip
}

function changed() {
  draw()
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const r = await fetch('/api/save', { method: 'POST', body: JSON.stringify({ id: cur.id, x: cur.x, y: cur.y, w: cur.w, r: cur.r || 0, stretch: cur.stretch || 1, skew: cur.skew || 0, flip: !!cur.flip }) }).then(r => r.json()).catch(() => ({ ok: false }))
    const st = $('status')
    st.textContent = r.ok ? 'saved · ' + cur.id + ' · ' + new Date().toLocaleTimeString() : 'NOT saved'
    st.style.background = r.ok ? '#e8f5e9' : '#fdecea'; st.style.color = r.ok ? '#1b5e20' : '#b71c1c'
  }, 350)
}

function pick(id) {
  cur = S.items.find(i => i.id === id)
  document.querySelectorAll('.it').forEach(e => e.classList.toggle('on', e.dataset.id === id))
  draw()
}

function toSvg(e) {
  const r = stage.getBoundingClientRect()
  return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100]
}

let drag = null
stage.addEventListener('pointerdown', e => {
  if (!cur) return
  const [px, py] = toSvg(e)
  drag = { dx: cur.x - px, dy: cur.y - py }
  stage.setPointerCapture(e.pointerId)
})
stage.addEventListener('pointermove', e => {
  if (!drag) return
  const [px, py] = toSvg(e)
  cur.x = Math.round((px + drag.dx) * 10) / 10
  cur.y = Math.round((py + drag.dy) * 10) / 10
  draw()
})
stage.addEventListener('pointerup', () => { if (drag) { drag = null; changed() } })
stage.addEventListener('wheel', e => {
  if (!cur) return
  e.preventDefault()
  const f = e.deltaY < 0 ? 1.03 : 0.97
  if (e.altKey) cur.stretch = Math.min(2.5, Math.max(0.4, Math.round((cur.stretch || 1) * f * 100) / 100))
  else cur.w = Math.max(4, Math.round(cur.w * f * 10) / 10)
  changed()
}, { passive: false })

for (const k of ['x', 'y', 'w', 'r', 'stretch', 'skew']) {
  for (const p of ['s', 'n']) $(p + k).addEventListener('input', e => { cur[k] = Number(e.target.value); changed() })
}
$('flip').addEventListener('change', e => { cur.flip = e.target.checked; changed() })
$('guides').addEventListener('change', draw)

function setStatus(text, ok) {
  const st = $('status')
  st.textContent = text
  st.style.background = ok ? '#e8f5e9' : '#fdecea'; st.style.color = ok ? '#1b5e20' : '#b71c1c'
}

async function del() {
  if (!cur) return
  const id = cur.id
  if (!confirm('Delete "' + id + '" from every file (types, level, art, places, names in all languages)?')) return
  clearTimeout(timer)
  const r = await fetch('/api/delete', { method: 'POST', body: JSON.stringify({ id }) }).then(r => r.json()).catch(() => ({ ok: false, why: 'request failed' }))
  if (!r.ok) return setStatus('NOT deleted: ' + (r.why || ''), false)
  const i = S.items.findIndex(x => x.id === id)
  S.items.splice(i, 1)
  document.querySelector('.it[data-id="' + id + '"]').remove()
  $('undo').disabled = false
  setStatus('deleted · ' + id + ' · ' + r.total + ' items left', true)
  cur = null
  const next = S.items[Math.min(i, S.items.length - 1)]
  if (next) pick(next.id)
}
$('del').addEventListener('click', del)
$('undo').addEventListener('click', async () => {
  const r = await fetch('/api/undo', { method: 'POST' }).then(r => r.json()).catch(() => ({ ok: false }))
  if (r.ok) location.hash = r.id, location.reload()
  else setStatus('nothing to undo', false)
})

addEventListener('keydown', e => {
  if (e.key === 'Delete' && !(e.target.tagName === 'INPUT')) { e.preventDefault(); return del() }
  if (!cur || e.target.tagName === 'INPUT' && e.target.type === 'number') return
  const step = e.shiftKey ? 2 : 0.5
  const k = e.key
  if (k === 'ArrowLeft') cur.x -= step
  else if (k === 'ArrowRight') cur.x += step
  else if (k === 'ArrowUp') cur.y -= step
  else if (k === 'ArrowDown') cur.y += step
  else if (k === '+' || k === '=') cur.w += step
  else if (k === '-') cur.w = Math.max(4, cur.w - step)
  else if (k === '[') cur.r = (cur.r || 0) - 1
  else if (k === ']') cur.r = (cur.r || 0) + 1
  else if (k === 'n' || k === 'p') {
    const i = S.items.indexOf(cur) + (k === 'n' ? 1 : -1)
    return pick(S.items[(i + S.items.length) % S.items.length].id)
  } else return
  e.preventDefault()
  cur.x = Math.round(cur.x * 10) / 10; cur.y = Math.round(cur.y * 10) / 10; cur.w = Math.round(cur.w * 10) / 10
  changed()
})

fetch('/api').then(r => r.json()).then(s => {
  S = s
  // WEAR_AT's w is the width on the drawing; the picture's own pixel size is wear.ts's
  S.items.forEach(it => { it.w0 = it.pw; it.h = it.ph })
  const order = ['head', 'face', 'neck', 'held', 'ground']
  const list = $('list')
  for (const slot of order) {
    const here = S.items.filter(i => i.slot === slot)
    if (!here.length) continue
    list.insertAdjacentHTML('beforeend', '<h4>' + slot + ' · ' + here.length + '</h4>')
    for (const it of here) list.insertAdjacentHTML('beforeend', '<div class="it" data-id="' + it.id + '"><img src="' + it.uri + '"><span>' + it.id + '</span></div>')
  }
  list.addEventListener('click', e => { const t = e.target.closest('.it'); if (t) pick(t.dataset.id) })
  pick(location.hash.slice(1) && S.items.find(i => i.id === location.hash.slice(1)) ? location.hash.slice(1) : S.items.find(i => i.slot === 'head').id)
})
</script>`
