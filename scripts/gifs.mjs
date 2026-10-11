// Draws the README's moving pictures (docs/gif/*.webp and *.gif): a whole
// turn, the shield stopping an `rm -rf`, and the wardrobe. Every face and
// line is Mochi's real drawing and reaction code, run as it is; a headless
// Edge or Chrome takes the frames and Python's Pillow strings them together.
// From the repository's folder, with Node 22.18 or later and Pillow:
//
//   node scripts/gifs.mjs            (BROWSER=/path/to/chrome to pick one)

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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
const { itemName } = await import('../hooks/level.ts')
const { moodLabel } = await import('../hooks/looks.ts')
const { panelSvg } = await import('../hooks/panel.ts')
const { afterTool, beforeTool, onPrompt, onTurnEnd } = await import('../hooks/react.ts')
const { paramsAt, svgFor } = await import('../hooks/rig.ts')
const { danger } = await import('../hooks/guard.ts')

setLang('en')
const st = t().st
const FPS = 15
const NOW = Date.UTC(2026, 9, 10, 15, 0)
const OUT = new URL('../docs/gif/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const outfit = wear => ({ head: null, face: null, neck: null, held: null, ground: null, ...wear })
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---------- the band, moment by moment ----------

/**
 * The band through a list of moments, each eased out of the one before as the
 * real band does: the face from where it was, the meters from what they showed.
 */
function bandMoments(moments, wear) {
  let prev = null
  let last = ''
  return moments.map(m => {
    if (m.r.mood === 'proud') last = m.r.line.split(' · ').slice(1).join(' · ')
    const info = {
      label: moodLabel(m.r.mood),
      detail: m.r.line,
      context: { percent: m.ctx, tokens: m.ctx * 2000, window: 200_000, slices: [{ name: 'System prompt', tokens: 9000, color: '' }, { name: 'Messages', tokens: m.ctx * 2000 - 9000, color: '' }] },
      limits: [{ kind: 'five_hour', percent: m.five, resetsAt: NOW + 134 * 60_000 }, { kind: 'seven_day', percent: 61, resetsAt: NOW + 3 * 86_400_000 + 4 * 3_600_000 }],
      cost: 0,
      agents: 0,
      tools: m.recent.length,
      isBusy: m.busy === true,
      recent: m.recent.map((r, k) => ({ ...r, id: k })),
      last,
      compactPct: 83.5,
      warn: 0,
      git: { branch: 'dark-mode', changed: m.changed ?? 0, ahead: 0, behind: 0, lastCommit: NOW - 3 * 3_600_000 },
      forecast: {},
      tz: 0,
      peers: [],
    }
    const scene = { context: Math.round(m.ctx / 5) * 5, agents: 0, outfit: outfit(m.wear ?? wear) }
    const from = prev ? { params: paramsAt(prev.from?.params ?? null, prev.shot.mood, (m.at - prev.at) * 1000), mood: prev.shot.mood, scene: prev.shot.scene } : null
    const shot = { mood: m.r.mood, scene, at: NOW, from }
    const { svg } = panelSvg({ panel: { shot, info, infoFrom: prev?.info ?? null, infoAt: NOW }, now: NOW, width: 720 })
    prev = { shot, info, from, at: m.at }
    return { at: m.at, svg }
  })
}

const ok = kind => ({ kind, state: 'ok' })
const run = kind => ({ kind, state: 'run' })
const fail = kind => ({ kind, state: 'fail' })

// ---------- the page every scene is drawn on ----------

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{background:transparent}
body{font:14px/1.55 ui-monospace,"Cascadia Mono","SF Mono",Consolas,monospace;color:#E9E3DD;-webkit-font-smoothing:antialiased}
.win{position:absolute;inset:0;background:#171513;border-radius:14px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.bar{height:36px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#1F1C1A;border-bottom:1px solid rgba(255,255,255,.06)}
.bar i{width:12px;height:12px;border-radius:50%;display:block}
.bar span{flex:1;text-align:center;color:#8A827B;font-size:12.5px;margin-right:44px}
.log{position:absolute;left:22px;right:22px;top:52px}
.ln{white-space:pre;opacity:0;transform:translateY(4px);transition:none}
.ln.on{opacity:1;transform:none}
.you{color:#F1ECE7;background:rgba(255,255,255,.05);border-radius:6px;padding:2px 8px;display:inline-block;margin-bottom:6px}
.dot{color:#D97757}.ok{color:#4CC38A}.bad{color:#F0645A}.dim{color:#8A827B}.tool{color:#F1ECE7;font-weight:600}
.band{position:absolute;left:20px;width:720px;height:76px}
.prompt{position:absolute;left:20px;right:20px;height:44px;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 14px;color:#F1ECE7}
.prompt b{color:#8A827B;font-weight:400;margin-right:8px}
.caret{display:inline-block;width:8px;height:17px;background:#D97757;vertical-align:-3px;margin-left:1px}
.hint{position:absolute;left:34px;color:#6E6761;font-size:12px}
.ask{position:absolute;left:20px;right:20px;border:1px solid #D97757;border-radius:10px;padding:12px 16px;background:rgba(217,119,87,.06);opacity:0}
.ask .q{white-space:pre-wrap;color:#F1ECE7;margin-bottom:8px}
.ask .q code{color:#F0645A;font-weight:600}
.opt{color:#A59D96;padding-left:18px;position:relative}
.opt.sel{color:#F1ECE7}
.opt.sel:before{content:"❯";position:absolute;left:0;color:#D97757}
`

/** One scene as a page: `seek(s)` puts everything where it is `s` seconds in. */
function page(w, h, body, script) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div style="position:relative;width:${w}px;height:${h}px">${body}</div>
<script>
const clamp = v => Math.max(0, Math.min(1, v))
let shown = -1
function band(el, moments, s) {
  let i = 0
  while (i + 1 < moments.length && moments[i + 1].at <= s) i++
  if (i !== shown) { el.innerHTML = moments[i].svg; shown = i }
  const svg = el.firstElementChild
  svg.pauseAnimations()
  svg.setCurrentTime(Math.max(0, s - moments[i].at))
}
function lines(s) {
  for (const el of document.querySelectorAll('[data-at]')) el.classList.toggle('on', s >= Number(el.dataset.at))
}
function typed(el, text, from, to, s) {
  const n = Math.round(clamp((s - from) / (to - from)) * text.length)
  el.textContent = text.slice(0, n)
}
${script}
</script></body></html>`
}

const chrome = title => `<div class="win"><div class="bar"><i style="background:#F0645A"></i><i style="background:#F2B84B"></i><i style="background:#4CC38A"></i><span>${esc(title)}</span></div>`

/** A transcript line that shows from `at` seconds on. */
const ln = (at, html) => `<div class="ln" data-at="${at}">${html}</div>`
const tool = (at, name, arg) => ln(at, `<span class="dot">●</span> <span class="tool">${name}</span><span class="dim">(</span>${esc(arg)}<span class="dim">)</span>`)
const out = (at, html) => ln(at, `  <span class="dim">⎿</span>  ${html}`)
const say = (at, text) => ln(at, `<span class="dot">●</span> ${esc(text)}`)

// ---------- scene 1: a whole turn ----------

function sessionScene() {
  const W = 760
  const H = 492
  const prompt = 'add a dark mode toggle to the settings page'
  const settings = { tool: 'Read', file_path: 'src/settings.tsx' }
  const grep = { tool: 'Grep', pattern: 'theme' }
  const edit1 = { tool: 'Edit', file_path: 'src/settings.tsx' }
  const test = { tool: 'Bash', command: 'npm test' }
  const edit2 = { tool: 'Edit', file_path: 'src/theme.ts' }
  const wear = { head: 'beanie', held: 'mug' }
  const t1 = [ok('read'), ok('search'), ok('edit')]
  const moments = bandMoments([
    { at: 0, r: { mood: 'wave', line: st.ready }, ctx: 9, five: 22, recent: [] },
    { at: 3.0, r: onPrompt(prompt, false), ctx: 11, five: 22, busy: true, recent: [] },
    { at: 4.4, r: beforeTool(settings), ctx: 14, five: 23, busy: true, recent: [run('read')] },
    { at: 5.6, r: beforeTool(grep), ctx: 17, five: 23, busy: true, recent: [ok('read'), run('search')] },
    { at: 6.8, r: beforeTool(edit1), ctx: 21, five: 24, busy: true, recent: [ok('read'), ok('search'), run('edit')], changed: 1 },
    { at: 8.4, r: beforeTool(test), ctx: 24, five: 25, busy: true, recent: [...t1, run('bash')], changed: 1 },
    { at: 9.9, r: afterTool(test, { isError: true, text: '2 failed' }, 1, 4), ctx: 26, five: 25, busy: true, recent: [...t1, fail('bash')], changed: 1 },
    { at: 11.6, r: beforeTool(edit2), ctx: 28, five: 26, busy: true, recent: [...t1, fail('bash'), run('edit')], changed: 2 },
    { at: 12.9, r: beforeTool(test), ctx: 30, five: 26, busy: true, recent: [...t1, fail('bash'), ok('edit'), run('bash')], changed: 2 },
    { at: 14.3, r: afterTool(test, { isError: false, text: '48 passed' }, 0, 4), ctx: 31, five: 27, busy: true, recent: [...t1, fail('bash'), ok('edit'), ok('bash')], changed: 2 },
    { at: 16.6, r: onTurnEnd({ reason: 'completed', seconds: 102, tools: 6, edits: 2, errors: 0 }), ctx: 32, five: 27, recent: [...t1, fail('bash'), ok('edit'), ok('bash')], changed: 2 },
  ], wear)
  const log = [
    ln(3.0, `<span class="you">&gt; ${esc(prompt)}</span>`),
    say(3.6, 'Let me see how the theme is wired first.'),
    tool(4.4, 'Read', 'src/settings.tsx'),
    tool(5.6, 'Search', 'pattern: "theme"'),
    tool(6.8, 'Update', 'src/settings.tsx'),
    out(7.4, '<span class="ok">+42</span> <span class="bad">−8</span> <span class="dim">lines</span>'),
    tool(8.4, 'Bash', 'npm test'),
    out(9.9, '<span class="bad">✗ 2 failed</span> <span class="dim">· theme.test.ts</span>'),
    tool(11.6, 'Update', 'src/theme.ts'),
    tool(12.9, 'Bash', 'npm test'),
    out(14.3, '<span class="ok">✓ 48 passed</span>'),
    say(16.6, 'Dark mode is in: Settings → Appearance → Theme.'),
  ].join('')
  const body = `${chrome('claude — ~/shop')}
<div class="log">${log}</div>
<div class="band" id="band" style="top:${H - 140}px"></div>
<div class="prompt" style="top:${H - 58}px"><b>&gt;</b><span id="typed"></span><span class="caret" id="caret"></span></div>
</div>`
  const script = `const M = ${JSON.stringify(moments)}
window.seek = s => {
  band(document.getElementById('band'), M, s); lines(s)
  typed(document.getElementById('typed'), ${JSON.stringify(prompt)}, 0.7, 2.6, s < 3 ? s : -1)
  document.getElementById('caret').style.opacity = (s < 3 ? Math.floor(s * 2.5) % 2 === 0 || s > 0.6 : Math.floor(s * 2) % 2 === 0) ? 1 : 0
}`
  return { name: 'session', w: W, h: H, dur: 20, html: page(W, H, body, script) }
}

// ---------- scene 2: the shield ----------

function shieldScene() {
  const W = 760
  const H = 520
  const prompt = 'clean up the old build folders'
  const cmd = 'rm -rf ./dist ~/'
  const bash = { tool: 'Bash', command: cmd }
  const what = danger(cmd)
  const question = t().shield.question(what, cmd).split('\n\n')
  const wear = { head: 'hardhat' }
  const moments = bandMoments([
    { at: 0, r: { mood: 'idle', line: st.ready }, ctx: 14, five: 31, recent: [] },
    { at: 2.4, r: onPrompt(prompt, false), ctx: 15, five: 31, busy: true, recent: [] },
    { at: 3.6, r: beforeTool(bash), ctx: 17, five: 32, busy: true, recent: [run('bash')] },
    { at: 8.4, r: afterTool(bash, { deny: 'stopped' }, 0, 0), ctx: 17, five: 32, recent: [fail('bash')] },
    { at: 10.4, r: { mood: 'pleased', line: `${t().shield.stop} · ${what}` }, ctx: 17, five: 32, recent: [fail('bash')] },
  ], wear)
  const log = [
    ln(2.4, `<span class="you">&gt; ${esc(prompt)}</span>`),
    tool(3.6, 'Bash', cmd),
    out(8.4, '<span class="bad">Stopped by Mochi’s shield</span> <span class="dim">· nothing was deleted</span>'),
  ].join('')
  const opts = [t().shield.run, t().shield.stop, t().shield.always]
  const body = `${chrome('claude — ~/shop')}
<div class="log">${log}</div>
<div class="ask" id="ask" style="top:112px"><div class="q">${esc(question[0])}\n\n<code>${esc(question[1])}</code>\n\n${esc(question[2])}</div>${opts.map((o, i) => `<div class="opt" id="o${i}">${esc(o)}</div>`).join('')}</div>
<div class="band" id="band" style="top:${H - 140}px"></div>
<div class="prompt" style="top:${H - 58}px"><b>&gt;</b><span id="typed"></span><span class="caret" id="caret"></span></div>
</div>`
  const script = `const M = ${JSON.stringify(moments)}
window.seek = s => {
  band(document.getElementById('band'), M, s); lines(s)
  typed(document.getElementById('typed'), ${JSON.stringify(prompt)}, 0.5, 2.0, s < 2.4 ? s : -1)
  document.getElementById('caret').style.opacity = Math.floor(s * 2.5) % 2 === 0 || (s > 0.5 && s < 2.4) ? 1 : 0
  const ask = document.getElementById('ask')
  ask.style.opacity = s < 4.2 ? clamp((s - 3.9) / 0.3) : s < 8.4 ? 1 : 1 - clamp((s - 8.4) / 0.25)
  const sel = s < 6.4 ? 0 : 1
  for (let i = 0; i < 3; i++) document.getElementById('o' + i).classList.toggle('sel', i === sel)
}`
  return { name: 'shield', w: W, h: H, dur: 13, html: page(W, H, body, script) }
}

// ---------- scene 3: the wardrobe ----------

function wardrobeScene() {
  const W = 760
  const H = 400
  const looks = [
    { mood: 'wave', wear: { head: 'beanie', held: 'mug' } },
    { mood: 'proud', wear: { head: 'crown', face: 'monocle', ground: 'cat' } },
    { mood: 'thinking', wear: { head: 'wizard', neck: 'scarf' } },
    { mood: 'party', wear: { head: 'partyhat', neck: 'medal', held: 'balloon' } },
    { mood: 'writing', wear: { head: 'cowboy', face: 'mustache' } },
    { mood: 'reading', wear: { head: 'gradcap', face: 'glasses', held: 'pencil' } },
    { mood: 'success', wear: { head: 'pirate', face: 'sunglasses', ground: 'duck' } },
    { mood: 'running', wear: { head: 'hardhat', held: 'wrench' } },
    { mood: 'pleased', wear: { head: 'chefhat', neck: 'bowtie', held: 'cake' } },
    { mood: 'sleeping', wear: { head: 'nightcap', ground: 'cactus' } },
  ]
  const SLOT_S = 1.6
  let prev = null
  const frames = looks.map((l, i) => {
    const scene = { context: 20, agents: 0, outfit: outfit(l.wear) }
    const from = prev ? { params: paramsAt(prev.from?.params ?? null, prev.mood, SLOT_S * 1000), mood: prev.mood, scene: prev.scene } : null
    const shot = { mood: l.mood, scene, from }
    prev = { ...shot }
    const names = Object.values(l.wear).map(itemName).join(' · ')
    return { at: i * SLOT_S, svg: svgFor(shot, 0), names, mood: moodLabel(l.mood) }
  })
  const body = `<div class="win" style="background:radial-gradient(120% 90% at 50% 0%,#2A2421 0%,#171513 70%)">
<div style="position:absolute;left:0;right:0;top:34px;text-align:center;font:600 26px/1.2 ui-sans-serif,'Segoe UI',system-ui,sans-serif;color:#F1ECE7;letter-spacing:-.01em">134 things to wear</div>
<div style="position:absolute;left:0;right:0;top:72px;text-align:center;font:14px/1.4 ui-sans-serif,'Segoe UI',system-ui,sans-serif;color:#A59D96">earned by real work: turns, commits, streaks and badges</div>
<div id="m" style="position:absolute;left:${W / 2 - 115}px;top:104px;width:230px;height:230px"></div>
<div id="n" style="position:absolute;left:0;right:0;top:346px;text-align:center;font:600 15px/1.4 ui-sans-serif,'Segoe UI',system-ui,sans-serif;color:#F2B84B"></div>
<div id="dots" style="position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;gap:6px">${looks.map(() => '<i style="width:6px;height:6px;border-radius:3px;background:#fff;opacity:.15;display:block"></i>').join('')}</div>
</div>`
  const script = `const M = ${JSON.stringify(frames)}
window.seek = s => {
  band(document.getElementById('m'), M, s)
  const i = shown
  document.getElementById('n').textContent = M[i].names
  document.getElementById('n').style.opacity = clamp((s - M[i].at) / 0.3)
  document.querySelectorAll('#dots i').forEach((d, k) => { d.style.opacity = k === i ? 0.9 : 0.15; d.style.width = k === i ? '18px' : '6px' })
}`
  return { name: 'wardrobe', w: W, h: H, dur: looks.length * SLOT_S, html: page(W, H, body, script) }
}

// ---------- taking the frames ----------

function findBrowser() {
  const list = [
    process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const found = list.find(p => p && existsSync(p))
  if (!found) throw new Error('No Chrome or Edge found; set BROWSER to one.')
  return found
}

async function cdp(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
      const { webSocketDebuggerUrl } = await r.json()
      const ws = new WebSocket(webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      let id = 0
      const waiting = new Map()
      ws.onmessage = m => {
        const msg = JSON.parse(m.data)
        if (msg.id && waiting.has(msg.id)) {
          const { res, rej } = waiting.get(msg.id)
          waiting.delete(msg.id)
          msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
        }
      }
      return { ws, send: (method, params = {}) => new Promise((res, rej) => { waiting.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })) }) }
    } catch {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  throw new Error('The browser did not answer.')
}

const work = mkdtempSync(join(tmpdir(), 'mochi-gifs-'))
const port = 9300 + Math.floor(Math.random() * 500)
const browser = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'profile')}`, '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' })

const ASSEMBLE = String.raw`
import sys, glob
from PIL import Image
src, out, fps, width = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
files = sorted(glob.glob(src + '/f*.png'))
frames = [Image.open(f).convert('RGBA') for f in files]
w, h = frames[0].size
big = [f.resize((width, round(h * width / w)), Image.LANCZOS) if w != width else f for f in frames]
ms = round(1000 / fps)
big[0].save(out + '.webp', save_all=True, append_images=big[1:], duration=ms, loop=0, quality=86, method=4)
small = [f.resize((w // 2, h // 2), Image.LANCZOS) for f in frames]
# One palette for every frame, so what does not move stays the same pixels and the frames shrink to what changed.
sample = small[::max(1, len(small) // 16)]
sheet = Image.new('RGB', (small[0].width, small[0].height * len(sample)))
for k, f in enumerate(sample):
    sheet.paste(f.convert('RGB'), (0, k * small[0].height))
shared = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
def pal(f):
    p = f.convert('RGB').quantize(palette=shared, dither=Image.Dither.NONE)
    p.paste(255, mask=f.getchannel('A').point(lambda v: 0 if v > 127 else 255))
    return p
gif = [pal(f) for f in small]
gif[0].save(out + '.gif', save_all=True, append_images=gif[1:], duration=ms, loop=0, transparency=255, disposal=1, optimize=False)
`

try {
  const { send, ws } = await cdp(port)
  for (const scene of [sessionScene(), shieldScene(), wardrobeScene()]) {
    const file = join(work, `${scene.name}.html`)
    writeFileSync(file, scene.html)
    await send('Emulation.setDeviceMetricsOverride', { width: scene.w, height: scene.h, deviceScaleFactor: 2, mobile: false })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    await send('Page.enable')
    await send('Page.navigate', { url: pathToFileURL(file).href })
    await new Promise(r => setTimeout(r, 800))
    const dir = join(work, scene.name)
    mkdirSync(dir)
    const count = Math.round(scene.dur * FPS)
    for (let i = 0; i < count; i++) {
      await send('Runtime.evaluate', { expression: `seek(${i / FPS})` })
      const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: scene.w, height: scene.h, scale: 1 } })
      writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))
    }
    const target = join(OUT.pathname.replace(/^\/([A-Za-z]:)/, '$1'), scene.name)
    const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', ASSEMBLE, dir, target, String(FPS), String(scene.w * 2)], { stdio: 'inherit' })
    if (py.status !== 0) throw new Error(`Pillow could not put ${scene.name} together.`)
    console.log(`docs/gif/${scene.name}: ${count} frames`)
  }
  ws.close()
} finally {
  browser.kill()
  await new Promise(r => setTimeout(r, 500))
  rmSync(work, { recursive: true, force: true, maxRetries: 5 })
}
