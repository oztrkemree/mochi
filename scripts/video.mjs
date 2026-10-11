// Draws docs/mochi-demo.mp4, a three-minute tour of Mochi: its moods, a whole
// turn, the limit rings, the shield, the details pane, the wardrobe, levels,
// badges and special days. Like scripts/gifs.mjs, every face, band and pane is
// Mochi's real drawing and reaction code, run as it is; a headless Chrome or
// Edge takes the frames and ffmpeg strings them together. From the
// repository's folder, with Node 22.18 or later and ffmpeg on PATH (or FFMPEG
// pointing at one; `pip install imageio-ffmpeg` ships one too):
//
//   node scripts/video.mjs              the whole film
//   node scripts/video.mjs short        a 25-second cut for X and Reddit (docs/mochi-short.mp4)
//   node scripts/video.mjs shield 4.2   one scene, or one frame of it as a PNG

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
const { itemName, SLOT_ITEMS, SLOTS } = await import('../hooks/level.ts')
const ITEMS = Object.values(SLOT_ITEMS).flat().length
const { moodLabel } = await import('../hooks/looks.ts')
const { panelSvg } = await import('../hooks/panel.ts')
const { afterTool, beforeTool, onPrompt, onTurnEnd, restLine } = await import('../hooks/react.ts')
const { paramsAt, POSES, svgFor } = await import('../hooks/rig.ts')
const { danger, dangers, say: sayDanger, watchCall, NEW_WATCH } = await import('../hooks/guard.ts')
const { weigh, editSecrets } = await import('../hooks/shield.ts')
const { NO_ENV } = await import('../hooks/state.ts')
const { detailSvg, detailHeight, levelSvg } = await import('../hooks/detail.ts')
const { summarize } = await import('../hooks/level.ts')
const { BADGES, badgeSvg, badgeName, badgeHint } = await import('../hooks/badges.ts')
const { cardSvg, wrappedOf, wrappedSvg } = await import('../hooks/share.ts')
const { greeting } = await import('../hooks/fun.ts')
const { contextWarning } = await import('../hooks/facts.ts')

setLang('en')
const st = t().st
const FPS = 30
const W = 1280
const H = 720
const SCALE = 1.5
const NOW = Date.UTC(2026, 9, 10, 15, 0)
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const outfit = wear => ({ head: null, face: null, neck: null, held: null, ground: null, ...wear })
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const canHold = mood => POSES[mood].held === undefined && POSES[mood].armR >= -40 && POSES[mood].armR <= 0
const ok = kind => ({ kind, state: 'ok' })
const run = kind => ({ kind, state: 'run' })
const fail = kind => ({ kind, state: 'fail' })

/** Mochi alone, through a list of moods and outfits, each eased out of the one before. */
function mascotMoments(list) {
  let prev = null
  return list.map(l => {
    const scene = { context: l.ctx ?? 20, agents: 0, outfit: outfit(l.wear ?? {}) }
    const from = prev ? { params: paramsAt(prev.from?.params ?? null, prev.mood, (l.at - prev.at) * 1000), mood: prev.mood, scene: prev.scene } : null
    const shot = { mood: l.mood, scene, from }
    prev = { ...shot, at: l.at }
    return { at: l.at, svg: svgFor(shot, 0), ...(l.label ? { label: l.label } : {}) }
  })
}

/** The band through a list of moments, eased one into the next as the real band does. */
function bandMoments(moments, wear, base = {}) {
  let prev = null
  let last = ''
  let prevR = null
  return moments.map(m => {
    const sound = m.r !== prevR ? m.r.sound : undefined
    prevR = m.r
    if (m.r.mood === 'proud') last = m.r.line.split(' · ').slice(1).join(' · ')
    const info = {
      label: moodLabel(m.r.mood),
      detail: m.r.line,
      context: { percent: m.ctx, tokens: m.ctx * 2000, window: 200_000, slices: m.slices ?? [{ name: 'System prompt', tokens: 9000, color: '' }, { name: 'Messages', tokens: m.ctx * 2000 - 9000, color: '' }] },
      limits: [{ kind: 'five_hour', percent: m.five, resetsAt: NOW + (m.resetIn ?? 134) * 60_000 }, { kind: 'seven_day', percent: m.week ?? 61, resetsAt: NOW + 3 * 86_400_000 + 4 * 3_600_000 }],
      cost: 0,
      agents: 0,
      tools: m.recent.length,
      isBusy: m.busy === true,
      recent: m.recent.map((r, k) => ({ ...r, id: k })),
      last,
      compactPct: 83.5,
      warn: m.warn ?? 0,
      git: { branch: base.branch ?? 'dark-mode', changed: m.changed ?? 0, ahead: 0, behind: 0, lastCommit: NOW - 3 * 3_600_000 },
      forecast: m.forecast ?? {},
      tz: 0,
      peers: m.peers ?? [],
    }
    const scene = { context: Math.round(m.ctx / 5) * 5, agents: 0, outfit: outfit(m.wear ?? wear) }
    const from = prev ? { params: paramsAt(prev.from?.params ?? null, prev.shot.mood, (m.at - prev.at) * 1000), mood: prev.shot.mood, scene: prev.shot.scene } : null
    const shot = { mood: m.r.mood, scene, at: NOW, from }
    const { svg } = panelSvg({ panel: { shot, info, infoFrom: prev?.info ?? null, infoAt: NOW }, now: NOW, width: 720 })
    prev = { shot, info, from, at: m.at }
    return { at: m.at, svg, ...(sound ? { sound } : {}) }
  })
}

// ---------- the stage every scene is drawn on ----------

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{background:#0E0C0B;overflow:hidden}
body{font-family:"Segoe UI Variable Display","Segoe UI",ui-sans-serif,system-ui,sans-serif;color:#F1ECE7;-webkit-font-smoothing:antialiased}
#stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(80% 90% at 78% 30%,#2B221E 0%,#171311 55%,#0E0C0B 100%)}
.mono{font-family:ui-monospace,"Cascadia Mono","SF Mono",Consolas,monospace}
.tag{position:absolute;left:64px;top:64px;font:700 12.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.2em;color:#D97757;text-transform:uppercase}
.title{position:absolute;left:62px;top:88px;width:400px;font-weight:700;font-size:40px;line-height:1.08;letter-spacing:-.025em}
.sub{position:absolute;left:64px;width:370px;font-size:17px;line-height:1.5;color:#B5ACA4}
.beats{position:absolute;left:64px;width:370px}
.beat{position:relative;padding:9px 0 9px 22px;font-size:16px;line-height:1.4;color:#F1ECE7;opacity:0;transition:none}
.beat:before{content:"";position:absolute;left:0;top:13px;width:8px;height:8px;border-radius:50%;background:#4A413B}
.beat.on{opacity:.42}
.beat.now{opacity:1}
.beat.now:before{background:#D97757;box-shadow:0 0 0 4px rgba(217,119,87,.2)}
.beat b{color:#F2B84B;font-weight:600}
.beat code,.sub code{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:.88em;color:#F1ECE7;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:4px}
.dots{position:absolute;left:64px;bottom:34px;display:flex;gap:6px}
.dots i{display:block;height:4px;width:18px;border-radius:2px;background:#fff;opacity:.12}
.dots i.done{opacity:.35}
.dots i.cur{opacity:1;background:#D97757;width:36px}
.brand{position:absolute;right:48px;bottom:28px;font:600 13px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;color:#6E6761;letter-spacing:.06em}
.vc{position:absolute;background:#171513;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.08);overflow:hidden}
.label{font-size:13px;color:#A59D96;text-align:center}
.pill{display:inline-block;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);font-size:16px;color:#F1ECE7}
.pill b{color:#F2B84B}
/* the terminal, as scripts/gifs.mjs draws it */
.win{position:absolute;inset:0;background:#171513;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.08);font:14px/1.55 ui-monospace,"Cascadia Mono","SF Mono",Consolas,monospace}
.bar{height:36px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#1F1C1A;border-bottom:1px solid rgba(255,255,255,.06)}
.bar i{width:12px;height:12px;border-radius:50%;display:block}
.bar span{flex:1;text-align:center;color:#8A827B;font-size:12.5px;margin-right:44px}
.log{position:absolute;left:22px;right:22px;top:52px}
.ln{white-space:pre;opacity:0;transform:translateY(4px)}
.ln.on{opacity:1;transform:none}
.you{color:#F1ECE7;background:rgba(255,255,255,.05);border-radius:6px;padding:2px 8px;display:inline-block;margin-bottom:6px}
.dot{color:#D97757}.ok{color:#4CC38A}.bad{color:#F0645A}.dim{color:#8A827B}.tool{color:#F1ECE7;font-weight:600}
.band{position:absolute;left:20px;width:720px;height:76px}
.prompt{position:absolute;left:20px;right:20px;height:44px;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 14px;color:#F1ECE7}
.prompt b{color:#8A827B;font-weight:400;margin-right:8px}
.caret{display:inline-block;width:8px;height:17px;background:#D97757;vertical-align:-3px;margin-left:1px}
.ask{position:absolute;left:20px;right:20px;border:1px solid #D97757;border-radius:10px;padding:12px 16px;background:#211A17;opacity:0}
.ask .q{white-space:pre-wrap;color:#F1ECE7;margin-bottom:8px}
.ask .q code{color:#F0645A;font-weight:600}
.opt{color:#A59D96;padding-left:18px;position:relative}
.opt.sel{color:#F1ECE7}
.opt.sel:before{content:"❯";position:absolute;left:0;color:#D97757}
`

const RUNTIME = `
const clamp = v => Math.max(0, Math.min(1, v))
const ease = v => { v = clamp(v); return 1 - Math.pow(1 - v, 3) }
const back = v => { v = clamp(v); const c = 1.7; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2) }
const $ = id => document.getElementById(id)
/** Shows the moment of \`M\` that is on at \`s\` in \`el\`, its animations wound to the right time. */
function play(el, M, s) {
  let i = 0
  while (i + 1 < M.length && M[i + 1].at <= s) i++
  if (el._i !== i) { el.innerHTML = M[i].svg; el._i = i }
  const svg = el.firstElementChild
  if (svg && svg.pauseAnimations) { svg.pauseAnimations(); svg.setCurrentTime(Math.max(0, s - M[i].at)) }
  return i
}
/** Elements marked data-in rise (or pop) in at that second, and fade at data-out. */
function fx(s) {
  for (const el of document.querySelectorAll('[data-in]')) {
    const a = (el.dataset.fx === 'pop' ? back : ease)((s - Number(el.dataset.in)) / Number(el.dataset.d || 0.5))
    const o = el.dataset.out ? 1 - ease((s - Number(el.dataset.out)) / 0.4) : 1
    el.style.opacity = Math.max(0, Math.min(1, a)) * o
    el.style.transform = el.dataset.fx === 'pop' ? 'scale(' + (0.4 + 0.6 * a) + ')' : el.dataset.fx === 'left' ? 'translateX(' + (1 - a) * -30 + 'px)' : el.dataset.fx === 'none' ? '' : 'translateY(' + (1 - a) * 16 + 'px)'
  }
  for (const el of document.querySelectorAll('.beat')) {
    const on = s >= Number(el.dataset.at)
    el.classList.toggle('on', on)
    el.classList.toggle('now', on && s < Number(el.dataset.until))
  }
  for (const el of document.querySelectorAll('[data-at]:not(.beat)')) el.classList.toggle('on', s >= Number(el.dataset.at))
}
function typed(el, text, from, to, s) {
  el.textContent = text.slice(0, Math.round(clamp((s - from) / (to - from)) * text.length))
}
`

const SCENES = []
const CHAPTERS = ['Intro', 'Moods', 'A turn', 'Limits', 'Shield', 'Watch', 'Details', 'Wardrobe', 'Levels', 'Days', 'Share', 'Install']

/**
 * One scene: the left column tells (a tag, a title, a line, then beats that
 * light up in turn), the right shows. `seek(s)` puts everything where it is.
 */
function scene({ name, chapter, dur, tag, title, sub, beats = [], body, script = '', bare = false, sfx = [], film = 'tour', fade = 0.4 }) {
  const subTop = 98 + Math.ceil(title.length / 21) * 44
  const left = bare ? '' : `<div class="tag" data-in="0.15">${tag}</div>
<div class="title" data-in="0.25">${title}</div>
<div class="sub" data-in="0.45" style="top:${subTop}px">${sub}</div>
<div class="beats" style="top:${subTop + 30 + Math.ceil(sub.replace(/<[^>]+>/g, '').length / 40) * 26}px">${beats.map(([at, text], i) => `<div class="beat" data-at="${at}" data-until="${beats[i + 1]?.[0] ?? 1e9}">${text}</div>`).join('')}</div>`
  const ch = CHAPTERS.indexOf(chapter)
  const dots = `<div class="dots">${CHAPTERS.map((c, i) => `<i class="${i < ch ? 'done' : i === ch ? 'cur' : ''}"></i>`).join('')}</div><div class="brand">mochi · for Claude Code</div>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div id="stage">${left}${body}${film === 'tour' ? dots : ''}</div>
<script>${RUNTIME}
const DUR = ${dur}
${script}
window.seek = s => {
  fx(s)
  if (window.scene) window.scene(s)
  const f = Math.min(ease(s / ${fade}), 1 - ease((s - DUR + ${fade}) / ${fade}))
  $('stage').style.opacity = f
}
</script></body></html>`
  SCENES.push({ name, chapter, film, dur, html, sfx: sfx.filter(x => x.sound).map(({ at, sound }) => ({ at, sound })) })
}

const winChrome = title => `<div class="bar"><i style="background:#F0645A"></i><i style="background:#F2B84B"></i><i style="background:#4CC38A"></i><span>${esc(title)}</span></div>`
const ln = (at, html) => `<div class="ln" data-at="${at}">${html}</div>`
const tool = (at, name, arg) => ln(at, `<span class="dot">●</span> <span class="tool">${name}</span><span class="dim">(</span>${esc(arg)}<span class="dim">)</span>`)
const out = (at, html) => ln(at, `  <span class="dim">⎿</span>  ${html}`)
const say = (at, text) => ln(at, `<span class="dot">●</span> ${esc(text)}`)

// ---------- 1. hello ----------

{
  const M = mascotMoments([
    { at: 0, mood: 'wave', wear: { head: 'beanie', held: 'mug' } },
    { at: 3.6, mood: 'pleased', wear: { head: 'beanie', held: 'mug' } },
    { at: 5.6, mood: 'wink', wear: { head: 'beanie', held: 'mug' } },
  ])
  const chips = ['🎭 <b>30</b> moods', '🛡️ a <b>shield</b>', '📊 <b>limit</b> rings', `👒 <b>${ITEMS}</b> things to wear`, '🏅 <b>18</b> badges']
  scene({
    name: 'intro', chapter: 'Intro', dur: 7.5, bare: true, tag: '', title: '', sub: '', sfx: [{ at: 0.5, sound: 'ding' }],
    body: `<div id="m" data-in="0.2" data-fx="pop" data-d="0.8" style="position:absolute;left:${W / 2 - 150}px;top:70px;width:300px;height:300px"></div>
<div data-in="1.0" style="position:absolute;left:0;right:0;top:372px;text-align:center;font-weight:800;font-size:76px;letter-spacing:-.04em">Mochi</div>
<div data-in="1.6" style="position:absolute;left:0;right:0;top:470px;text-align:center;font-size:22px;color:#B5ACA4">A little clay friend that lives above your <span style="color:#D97757;font-weight:600">Claude Code</span> prompt.</div>
<div style="position:absolute;left:0;right:0;top:540px;display:flex;justify-content:center;gap:10px">${chips.map((c, i) => `<span class="pill" data-in="${2.6 + i * 0.22}" data-fx="pop">${c}</span>`).join('')}</div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => play($('m'), M, s)`,
  })
}

// ---------- 2. moods ----------

{
  const MOODS = Object.keys(POSES)
  const grid = MOODS.map(mood => ({ mood, svg: svgFor({ mood, scene: { context: 20, agents: 0, outfit: outfit({}) }, from: null }, 0) }))
  const seq = ['idle', 'thinking', 'reading', 'searching', 'writing', 'running', 'error', 'dizzy', 'success', 'party', 'proud', 'sleeping']
  const SEQ_AT = 8.6
  const morph = mascotMoments(seq.map((mood, i) => ({ at: SEQ_AT + i * 0.95, mood, label: moodLabel(mood) })))
  const CELL = 120
  const cells = grid.map((g, i) => `<div style="position:absolute;left:${478 + (i % 6) * 125}px;top:${112 + Math.floor(i / 6) * 106}px;width:${CELL}px" data-in="${0.6 + i * 0.07}" data-fx="pop" data-out="${SEQ_AT - 0.6}">
<div class="g" id="g${i}" style="width:${CELL - 26}px;height:${CELL - 26}px;margin:0 auto"></div><div class="label" style="white-space:nowrap;font-size:12.5px">${esc(moodLabel(g.mood))}</div></div>`).join('')
  scene({
    name: 'moods', chapter: 'Moods', dur: 21, tag: '01 · It feels what Claude does',
    title: 'Thirty moods, one for every moment',
    sub: 'Mochi follows every tool call: thinking, reading, searching, typing, running a command, waiting for you.',
    beats: [
      [1.2, 'A face for <b>every tool</b> Claude calls'],
      [4.0, 'Joy for a green test run, <b>dizzy</b> after three errors'],
      [SEQ_AT, '<b>No jump cuts</b>: each pose eases out of the last'],
      [14.5, 'Asleep when you are away, awake when you are back'],
    ],
    body: `${cells}
<div id="big" data-in="${SEQ_AT - 0.1}" data-fx="pop" style="position:absolute;left:${478 + 380 - 170}px;top:120px;width:340px;height:340px"></div>
<div id="bl" data-in="${SEQ_AT}" style="position:absolute;left:478px;width:760px;top:478px;text-align:center;font-size:30px;font-weight:700;color:#F2B84B"></div>
<div data-in="${SEQ_AT + 0.4}" style="position:absolute;left:478px;width:760px;top:528px;text-align:center" class="mono"><span id="bs" style="color:#8A827B;font-size:14px"></span></div>`,
    script: `const G = ${JSON.stringify(grid.map(g => [{ at: 0, svg: g.svg }]))}
const B = ${JSON.stringify(morph)}
window.scene = s => {
  if (s < ${SEQ_AT}) G.forEach((g, i) => play($('g' + i), g, s))
  if (s >= ${SEQ_AT - 0.2}) {
    const i = play($('big'), B, Math.max(s, ${SEQ_AT}))
    $('bl').textContent = B[i].label
    $('bs').textContent = B.map((b, k) => k === i ? '● ' : '○ ').join('')
  }
}`,
  })
}

// ---------- 3. a whole turn ----------

{
  const prompt = 'add a dark mode toggle to the settings page'
  const settings = { tool: 'Read', file_path: 'src/settings.tsx' }
  const grep = { tool: 'Grep', pattern: 'theme' }
  const edit1 = { tool: 'Edit', file_path: 'src/settings.tsx' }
  const test = { tool: 'Bash', command: 'npm test' }
  const edit2 = { tool: 'Edit', file_path: 'src/theme.ts' }
  const wear = { head: 'beanie', held: 'mug' }
  const t1 = [ok('read'), ok('search'), ok('edit')]
  const D = 1.5
  const moments = bandMoments([
    { at: 0, r: { mood: 'wave', line: st.ready }, ctx: 9, five: 22, recent: [] },
    { at: D + 3.0, r: onPrompt(prompt, false), ctx: 11, five: 22, busy: true, recent: [] },
    { at: D + 4.6, r: beforeTool(settings), ctx: 14, five: 23, busy: true, recent: [run('read')] },
    { at: D + 6.0, r: beforeTool(grep), ctx: 17, five: 23, busy: true, recent: [ok('read'), run('search')] },
    { at: D + 7.4, r: beforeTool(edit1), ctx: 21, five: 24, busy: true, recent: [ok('read'), ok('search'), run('edit')], changed: 1 },
    { at: D + 9.2, r: beforeTool(test), ctx: 24, five: 25, busy: true, recent: [...t1, run('bash')], changed: 1 },
    { at: D + 10.9, r: afterTool(test, { isError: true, text: '2 failed' }, 1, 4), ctx: 26, five: 25, busy: true, recent: [...t1, fail('bash')], changed: 1 },
    { at: D + 12.9, r: beforeTool(edit2), ctx: 28, five: 26, busy: true, recent: [...t1, fail('bash'), run('edit')], changed: 2 },
    { at: D + 14.3, r: beforeTool(test), ctx: 30, five: 26, busy: true, recent: [...t1, fail('bash'), ok('edit'), run('bash')], changed: 2 },
    { at: D + 15.8, r: afterTool(test, { isError: false, text: '48 passed' }, 0, 4), ctx: 31, five: 27, busy: true, recent: [...t1, fail('bash'), ok('edit'), ok('bash')], changed: 2 },
    { at: D + 18.4, r: onTurnEnd({ reason: 'completed', seconds: 102, tools: 6, edits: 2, errors: 0 }), ctx: 32, five: 27, recent: [...t1, fail('bash'), ok('edit'), ok('bash')], changed: 2 },
  ], wear)
  const log = [
    ln(D + 3.0, `<span class="you">&gt; ${esc(prompt)}</span>`),
    say(D + 3.7, 'Let me see how the theme is wired first.'),
    tool(D + 4.6, 'Read', 'src/settings.tsx'),
    tool(D + 6.0, 'Search', 'pattern: "theme"'),
    tool(D + 7.4, 'Update', 'src/settings.tsx'),
    out(D + 8.0, '<span class="ok">+42</span> <span class="bad">−8</span> <span class="dim">lines</span>'),
    tool(D + 9.2, 'Bash', 'npm test'),
    out(D + 10.9, '<span class="bad">✗ 2 failed</span> <span class="dim">· theme.test.ts</span>'),
    tool(D + 12.9, 'Update', 'src/theme.ts'),
    tool(D + 14.3, 'Bash', 'npm test'),
    out(D + 15.8, '<span class="ok">✓ 48 passed</span>'),
    say(D + 18.4, 'Dark mode is in: Settings → Appearance → Theme.'),
  ].join('')
  const WH = 492
  scene({
    name: 'turn', chapter: 'A turn', dur: D + 23, tag: '02 · One real turn', sfx: moments,
    title: 'Watch a whole turn, live',
    sub: 'Above the prompt, the <b style="color:#F1ECE7">band</b>: Mochi\'s face, what is happening in plain words, the last tool calls and the limit rings.',
    beats: [
      [D + 3.0, 'You ask; Mochi <b>listens</b>'],
      [D + 4.6, 'It <b>reads</b> and <b>searches</b> with Claude'],
      [D + 7.4, 'Types along while Claude <b>edits</b>'],
      [D + 10.9, 'Tests fail: the square turns <b>red</b>, Mochi frowns'],
      [D + 15.8, '48 pass: it <b>celebrates</b>'],
      [D + 18.4, 'Ends <b>proud</b>, with time, tools and edits'],
    ],
    body: `<div style="position:absolute;left:478px;top:${(H - WH) / 2 - 6}px;width:760px;height:${WH}px" data-in="0.3"><div class="win">${winChrome('claude — ~/shop')}
<div class="log">${log}</div>
<div class="band" id="band" style="top:${WH - 140}px"></div>
<div class="prompt" style="top:${WH - 58}px"><b>&gt;</b><span id="typed"></span><span class="caret" id="caret"></span></div></div></div>`,
    script: `const M = ${JSON.stringify(moments)}
window.scene = s => {
  play($('band'), M, s)
  typed($('typed'), ${JSON.stringify(prompt)}, ${D + 0.7}, ${D + 2.6}, s < ${D + 3} ? s : -1)
  $('caret').style.opacity = Math.floor(s * 2.5) % 2 === 0 || (s > ${D + 0.6} && s < ${D + 3}) ? 1 : 0
}`,
  })
}

// ---------- the wardrobe ----------

/** A small, steady random, so the film comes out the same on every run. */
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

{
  const rand = rng(7)
  const pick = list => list[Math.floor(rand() * list.length)]
  const look = (mood, extra = 0.5) => {
    const wear = { head: pick(SLOT_ITEMS.head) }
    if (rand() < extra) wear.face = pick(SLOT_ITEMS.face)
    if (rand() < extra) wear.neck = pick(SLOT_ITEMS.neck)
    if (canHold(mood) && rand() < 0.75) wear.held = pick(SLOT_ITEMS.held)
    if (rand() < 0.7) wear.ground = pick(SLOT_ITEMS.ground)
    return { mood, wear }
  }
  const happy = ['wave', 'pleased', 'idle', 'love', 'wink', 'success']
  const SLOT_S = 0.9
  const showLooks = [
    { mood: 'wave', wear: { head: 'beanie', held: 'mug' } },
    { mood: 'proud', wear: { head: 'crown', face: 'monocle', ground: 'cat' } },
    { mood: 'thinking', wear: { head: 'wizard', neck: 'scarf', ground: 'robot' } },
    { mood: 'pleased', wear: { head: 'astronaut', ground: 'rocket', held: 'flag' } },
    { mood: 'love', wear: { head: 'flowercrown', face: 'heartglasses', ground: 'hedgehog' } },
    { mood: 'wink', wear: { head: 'pirate', face: 'eyepatch', ground: 'chest' } },
    { mood: 'idle', wear: { head: 'dragon', neck: 'goldchain', ground: 'campfire' } },
    { mood: 'success', wear: { head: 'viking', face: 'beard', ground: 'axolotl' } },
    { mood: 'wave', wear: { head: 'unicorn', face: 'starglasses', held: 'wand' } },
    { mood: 'pleased', wear: { head: 'chefhat', neck: 'bowtie', held: 'whisk', ground: 'cake' } },
    { mood: 'idle', wear: { head: 'catears', face: 'catwhiskers', neck: 'bellcollar', ground: 'cat' } },
    { mood: 'party', wear: { head: 'partyhat', neck: 'medal', held: 'balloon', ground: 'gift' } },
    { mood: 'wink', wear: { head: 'tophat', face: 'monocle', neck: 'necktie', ground: 'penguin' } },
    { mood: 'sleeping', wear: { head: 'nightcap', ground: 'lavalamp' } },
  ].map(l => ({ ...l, wear: canHold(l.mood) ? l.wear : { ...l.wear, held: null } }))
  const montage = mascotMoments(showLooks.map((l, i) => ({ at: 0.8 + i * SLOT_S, mood: l.mood, wear: l.wear, label: Object.values(l.wear).filter(Boolean).map(itemName).join(' · ') })))
  const GRID_AT = 0.8 + showLooks.length * SLOT_S + 0.4
  const cols = 8
  const heads = [...SLOT_ITEMS.head].sort(() => rand() - 0.5)
  const many = Array.from({ length: 24 }, (_, i) => ({ ...look(happy[i % happy.length], 0.45), head: heads[i] })).map(l => ({ ...l, wear: { ...l.wear, head: l.head } }))
  const tiles = many.map(l => [{ at: 0, svg: svgFor({ mood: l.mood, scene: { context: 20, agents: 0, outfit: outfit(l.wear) }, from: null }, 0) }])
  const counts = SLOTS.map(s => `<span class="pill" style="font-size:14px;padding:6px 12px"><b>${SLOT_ITEMS[s].length}</b> ${esc(t().item.slot[s].toLowerCase())}</span>`)
  scene({
    name: 'wardrobe', chapter: 'Wardrobe', dur: GRID_AT + 10, tag: '07 · A wardrobe that grows',
    title: `${ITEMS} things to wear, earned by real work`,
    sub: 'Every turn, edit, commit and working day earns experience. Levels, habits and hard badges unlock new things to wear.',
    beats: [
      [0.8, '<b>Hats</b>, glasses, scarves, things to hold and friends beside'],
      [5.5, 'Mix any of them: <code>/mochi wear crown</code>'],
      [GRID_AT, 'Or let Mochi <b>dress itself</b> for the moment'],
      [GRID_AT + 4, 'Coffee in the morning, a night cap after midnight'],
    ],
    body: `<div id="m" data-in="0.5" data-out="${GRID_AT - 0.5}" style="position:absolute;left:${858 - 160}px;top:96px;width:320px;height:320px"></div>
<div id="n" data-in="0.8" data-out="${GRID_AT - 0.5}" style="position:absolute;left:478px;width:760px;top:440px;text-align:center;font-size:24px;font-weight:700;color:#F2B84B"></div>
<div data-in="1.2" data-out="${GRID_AT - 0.5}" style="position:absolute;left:478px;width:760px;top:500px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap">${counts.join('')}</div>
${tiles.map((_, i) => `<div data-in="${GRID_AT + i * 0.08}" data-fx="pop" style="position:absolute;left:${478 + (i % cols) * 95}px;top:${112 + Math.floor(i / cols) * 150}px;width:95px;height:140px"><div id="t${i}" style="width:95px;height:95px"></div><div class="label" style="font-size:11px;line-height:1.3">${esc(itemName(many[i].wear.head))}</div></div>`).join('')}`,
    script: `const M = ${JSON.stringify(montage)}
const T = ${JSON.stringify(tiles)}
window.scene = s => {
  if (s < ${GRID_AT}) {
    const i = play($('m'), M, s)
    $('n').textContent = M[i].label
    $('n').style.opacity = Math.min(Number($('n').style.opacity || 1), clamp((s - M[i].at) / 0.2))
  } else T.forEach((m, i) => play($('t' + i), m, s - ${GRID_AT}))
}`,
  })
}

// ---------- 3. the limit rings ----------

const MIN = 60_000
const sl = (name, tokens) => ({ name, tokens, color: '' })
const slicesAt = ctx => [sl('System prompt', 8000), sl('System tools', 14000), sl('MCP tools', 22000), sl('Memory files', 6000), sl('Messages', Math.max(0, ctx * 2000 - 50000))]

{
  const wear = { head: 'gradcap', face: 'glasses' }
  const r3 = [ok('read'), ok('search'), ok('edit')]
  const squeeze = contextWarning({ ...NO_ENV, context: 84, tokens: 168_000, window: 200_000, compactAt: 167_000, slices: slicesAt(84) }, 2) || 'context almost full'
  const M = bandMoments([
    { at: 0, r: beforeTool({ tool: 'Edit', file_path: 'src/checkout/pay.ts' }), ctx: 38, five: 44, busy: true, recent: [ok('read'), ok('search'), run('edit')], changed: 2, slices: slicesAt(38) },
    { at: 3.8, r: beforeTool({ tool: 'Bash', command: 'npm run build' }), ctx: 55, five: 66, busy: true, recent: [...r3, run('bash')], changed: 3, slices: slicesAt(55), forecast: { five_hour: NOW + 95 * MIN } },
    { at: 7.6, r: beforeTool({ tool: 'Edit', file_path: 'src/cart.ts' }), ctx: 71, five: 86, busy: true, recent: [...r3, ok('bash'), run('edit')], changed: 4, slices: slicesAt(71), warn: 1, forecast: { five_hour: NOW + 22 * MIN } },
    { at: 11.4, r: { mood: 'squeezed', line: squeeze }, ctx: 85, five: 91, busy: true, recent: [...r3, ok('bash'), ok('edit')], changed: 4, slices: slicesAt(85), warn: 2, forecast: { five_hour: NOW + 12 * MIN } },
    { at: 15.4, r: { mood: 'party', line: t().limit.back(t().limit.long.five_hour), sound: 'ding' }, ctx: 21, five: 1, resetIn: 300, recent: [...r3, ok('bash'), ok('edit')], changed: 4, slices: slicesAt(21) },
  ], wear, { branch: 'feat/checkout' })
  const Z = 2.85
  scene({
    name: 'limits', chapter: 'Limits', dur: 21, sfx: M, tag: '03 · Your limits, at a glance',
    title: 'Your limits, always in sight',
    sub: 'No more typing <code>/usage</code> every ten minutes. Three rings: the <b style="color:#F1ECE7">context window</b>, the <b style="color:#F1ECE7">5-hour session</b> and the <b style="color:#F1ECE7">week</b>.',
    beats: [
      [0.6, 'Each ring fills as you work, with the time to its reset'],
      [3.8, 'Burning fast? It says <b>when</b> you run out: <code>full 16:35</code>'],
      [7.6, 'Amber, then <b>red</b> as it gets close'],
      [11.4, 'The context ring knows what is inside it and where <b>auto-compact</b> kicks in'],
      [15.4, 'Good news too: Mochi tells you when a limit <b>resets</b>'],
    ],
    body: `<div class="vc" data-in="0.3" style="left:478px;top:112px;width:760px;height:116px"><div id="band" style="position:absolute;left:20px;top:20px;width:720px;height:76px"></div></div>
<div class="vc" data-in="0.9" style="left:478px;top:252px;width:760px;height:${Math.round(76 * Z) + 24}px"><div style="position:absolute;left:0;top:12px;width:760px;height:${Math.round(76 * Z)}px;overflow:hidden"><div id="zoom" style="position:absolute;left:${-458 * Z}px;top:0;width:720px;height:76px;transform:scale(${Z});transform-origin:0 0"></div></div></div>
<div style="position:absolute;left:478px;top:${252 + Math.round(76 * Z) + 44}px;width:760px;display:flex;justify-content:center;gap:10px">
<span class="pill" data-in="1.4" data-fx="pop">🧠 <b>context</b> · what's in it</span><span class="pill" data-in="1.6" data-fx="pop">⏱️ <b>session</b> · 5 hours</span><span class="pill" data-in="1.8" data-fx="pop">📅 <b>week</b> · 7 days</span></div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => { play($('band'), M, s); play($('zoom'), M, s) }`,
  })
}

// ---------- 4. the shield, three times ----------

/** One stop by the shield, as register.tsx runs it: the call, the scared face and question, Stop, the halted face. */
function shieldAct({ name, n, title, sub, beats, prompt, call, toolName, toolArg, ask, what, mild = false, wear, after, dur = 13 }) {
  const isEdit = call.tool !== 'Bash'
  const d = t().shield
  const opts = [isEdit ? d.write : d.run, d.stop, d.always]
  const moments = bandMoments([
    { at: 0, r: { mood: 'idle', line: st.ready }, ctx: 14, five: 31, recent: [] },
    { at: 2.4, r: onPrompt(prompt, false), ctx: 15, five: 31, busy: true, recent: [] },
    { at: 3.4, r: beforeTool(call), ctx: 17, five: 32, busy: true, recent: [run(isEdit ? 'edit' : 'bash')] },
    { at: 4.0, r: { mood: mild ? 'nervous' : 'scared', line: `${st.awaitingApproval} · ${what}`, ...(isEdit && !mild ? { sound: 'alarm' } : {}) }, ctx: 17, five: 32, busy: true, recent: [run(isEdit ? 'edit' : 'bash')] },
    { at: 8.4, r: { mood: 'denied', line: `${st.halted} · ${what}` }, ctx: 17, five: 32, recent: [fail(isEdit ? 'edit' : 'bash')] },
  ], wear)
  const log = [
    ln(2.4, `<span class="you">&gt; ${esc(prompt)}</span>`),
    tool(3.4, toolName, toolArg),
    out(8.4, `<span class="bad">Stopped by Mochi’s shield</span> <span class="dim">· ${esc(after)}</span>`),
  ].join('')
  const WH = 520
  scene({
    name, chapter: 'Shield', dur, tag: `04 · The shield · ${n}/3`, title, sub, beats, sfx: moments,
    body: `<div style="position:absolute;left:478px;top:${(H - WH) / 2 - 6}px;width:760px;height:${WH}px" data-in="0.3"><div class="win">${winChrome('claude — ~/shop')}
<div class="log">${log}</div>
<div class="ask" id="ask" style="top:112px"><div class="q" style="color:#D97757;font-weight:700;margin-bottom:6px">🛡️ Mochi</div><div class="q">${ask}</div>${opts.map((o, i) => `<div class="opt" id="o${i}">${esc(o)}</div>`).join('')}</div>
<div class="band" id="band" style="top:${WH - 140}px"></div>
<div class="prompt" style="top:${WH - 58}px"><b>&gt;</b><span id="typed"></span><span class="caret" id="caret"></span></div></div></div>`,
    script: `const M = ${JSON.stringify(moments)}
window.scene = s => {
  play($('band'), M, s)
  typed($('typed'), ${JSON.stringify(prompt)}, 0.5, 2.0, s < 2.4 ? s : -1)
  $('caret').style.opacity = Math.floor(s * 2.5) % 2 === 0 || (s > 0.5 && s < 2.4) ? 1 : 0
  $('ask').style.opacity = s < 4.4 ? clamp((s - 4.1) / 0.3) : s < 8.4 ? 1 : 1 - clamp((s - 8.4) / 0.25)
  const sel = s < 6.6 ? 0 : 1
  for (let i = 0; i < 3; i++) $('o' + i).classList.toggle('sel', i === sel)
}`,
  })
}

const askHtml = (question, mark) => question.split('\n\n').map(p => (p === mark ? `<code>${esc(p)}</code>` : esc(p).replace(esc(mark), `<code>${esc(mark)}</code>`))).join('\n\n')

{
  const cmd = 'rm -rf ./dist ~/'
  const what = danger(cmd)
  shieldAct({
    name: 'shield-rm', n: 1, title: 'Stops what you can’t undo',
    sub: 'Every command Claude runs, through Bash or PowerShell, and every edit it makes is read first.',
    beats: [[3.4, 'Claude reaches for <code>rm -rf</code>'], [4.0, 'Mochi is <b>scared</b> and says in plain words what would be lost'], [6.6, 'You pick <b>Stop</b>'], [8.4, 'Nothing is deleted. Claude is told not to retry']],
    prompt: 'clean up the old build folders', call: { tool: 'Bash', command: cmd }, toolName: 'Bash', toolArg: cmd,
    ask: askHtml(t().shield.question(what, cmd), cmd), what, wear: { head: 'hardhat' }, after: 'nothing was deleted',
  })
}
{
  const cmd = 'git push --force origin main'
  const found = weigh(dangers(cmd), cmd, 'feat/checkout', 'main')
  const what = found.map(x => sayDanger(x)).join(' · ')
  shieldAct({
    name: 'shield-push', n: 2, title: 'Force pushes, judged by branch',
    sub: 'Onto <code>main</code>, <code>master</code>, <code>trunk</code> or <code>develop</code> it asks and names the branch. On your own branch, just a nervous look.',
    beats: [[3.4, 'A force push onto <b>main</b>'], [4.0, 'The question names the branch it would rewrite'], [6.6, '<b>Always allow here</b> remembers per repository'], [8.4, 'History stays as it was']],
    prompt: 'push my fix, force it if you have to', call: { tool: 'Bash', command: cmd }, toolName: 'Bash', toolArg: cmd,
    ask: askHtml(t().shield.question(what, cmd), cmd), what, wear: { head: 'viking', face: 'beard' }, after: 'main was not touched',
  })
}
{
  const content = 'export const awsKey = "AKIA4HZQ7WLN3XTBPRLE"\n'
  const found = editSecrets({ tool: 'Write', file_path: 'C:/shop/src/config.ts', content }, null)
  const what = found.map(x => sayDanger(x)).join(' · ')
  shieldAct({
    name: 'shield-secret', n: 3, title: 'Secrets stay out of your history',
    sub: 'Live keys and tokens (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, private keys) and files like <code>.env</code>.',
    beats: [[3.4, 'Claude is about to write a key into a file'], [4.0, 'Mochi asks, and shows it <b>masked</b>'], [6.6, 'Placeholders and test values go through'], [8.4, 'The key never reaches the file, or a commit']],
    prompt: 'wire up the S3 upload with my key', call: { tool: 'Write', file_path: 'src/config.ts' }, toolName: 'Write', toolArg: 'src/config.ts',
    ask: askHtml(t().shield.editQuestion(what, 'config.ts'), found[0]?.detail ?? ''), what, wear: { head: 'explorer', face: 'sunglasses' }, after: 'the key was not written',
  })
}

// ---------- 5. what else it notices ----------

{
  const test = { tool: 'Bash', command: 'npm test' }
  const fails = []
  let w = NEW_WATCH
  for (let i = 0; i < 3; i++) {
    const r = watchCall(w, test, true, 'Error: ENOENT: no such file, open fixtures/user.json')
    w = r.watch
    fails.push(r.alarm)
  }
  const alarm = fails[2] ?? 'same command failed 3 times in a row'
  const api = { id: 'a', label: 'api', state: 'asking', line: 'waiting for approval', since: NOW - 6 * MIN, at: NOW, branch: 'main', stateAt: NOW - 6 * MIN }
  const b = [run('bash')]
  const ended = onTurnEnd({ reason: 'aborted', seconds: 48, tools: 3, edits: 0, errors: 3 })
  const M = bandMoments([
    { at: 0, r: beforeTool(test), ctx: 41, five: 52, busy: true, recent: b },
    { at: 1.4, r: afterTool(test, { isError: true, text: 'ENOENT' }, 1, 2), ctx: 42, five: 52, busy: true, recent: [fail('bash')] },
    { at: 2.4, r: beforeTool(test), ctx: 43, five: 53, busy: true, recent: [fail('bash'), run('bash')] },
    { at: 3.8, r: afterTool(test, { isError: true, text: 'ENOENT' }, 2, 2), ctx: 44, five: 53, busy: true, recent: [fail('bash'), fail('bash')] },
    { at: 4.8, r: beforeTool(test), ctx: 45, five: 54, busy: true, recent: [fail('bash'), fail('bash'), run('bash')] },
    { at: 6.2, r: afterTool(test, { isError: true, text: 'ENOENT' }, 3, 2), ctx: 46, five: 54, busy: true, recent: [fail('bash'), fail('bash'), fail('bash')] },
    { at: 9.0, r: ended, ctx: 46, five: 54, recent: [fail('bash'), fail('bash'), fail('bash')] },
    { at: 10.2, r: ended, ctx: 46, five: 54, recent: [fail('bash'), fail('bash'), fail('bash')], peers: [api] },
  ], { head: 'baseballcap', held: 'tea' })
  const err = '<span class="bad">✗ Error: ENOENT</span> <span class="dim">· fixtures/user.json</span>'
  const log = [
    ln(0.2, '<span class="you">&gt; run the tests and fix what breaks</span>'),
    tool(0.3, 'Bash', 'npm test'), out(1.4, err),
    tool(2.4, 'Bash', 'npm test'), out(3.8, err),
    tool(4.8, 'Bash', 'npm test'), out(6.2, err),
    ln(9.0, '  <span class="dim">⎿  Interrupted · What should Claude do instead?</span>'),
  ].join('')
  const icon = svgFor({ mood: 'pleased', scene: { context: 20, agents: 0, outfit: outfit({}) }, from: null }, 0)
  const toast = (id, at, out, text) => `<div class="vc" data-in="${at}" data-out="${out}" data-fx="left" style="left:${W - 430}px;top:40px;width:400px;height:78px;background:#262220;border-radius:10px;padding:12px 14px 12px 68px">
<div style="position:absolute;left:12px;top:12px;width:46px;height:46px">${icon}</div>
<div style="font-size:12.5px;color:#A59D96;margin-bottom:3px">Mochi · shop</div><div style="font-size:14px;line-height:1.35;color:#F1ECE7">${esc(text)}</div></div>`
  const WH = 492
  scene({
    name: 'watch', chapter: 'Watch', dur: 15, sfx: M, tag: '05 · It keeps an eye out',
    title: 'Catches a loop before your limit does',
    sub: 'The same command failing again and again, the same error coming back, the same call returning the same thing.',
    beats: [
      [0.4, 'Claude runs the same failing command'],
      [6.2, 'Three in a row: Mochi is <b>dizzy</b> and tells you to press <b>Esc</b>'],
      [10.2, '<b>Every chat</b> on your machine: the one waiting for you comes first'],
      [11.6, '<b>Notifications</b> when a long turn ends or a chat needs you. Go make tea.'],
    ],
    body: `<div style="position:absolute;left:478px;top:${(H - WH) / 2 + 20}px;width:760px;height:${WH}px" data-in="0.3"><div class="win">${winChrome('claude — ~/shop')}
<div class="log">${log}</div>
<div class="band" id="band" style="top:${WH - 140}px"></div>
<div class="prompt" style="top:${WH - 58}px"><b>&gt;</b><span class="caret"></span></div></div></div>
${toast('t1', 6.6, 11.0, t().note.loop(alarm, 'npm test'))}
${toast('t2', 11.6, 14.2, t().chats.waitingLong('api', '6m'))}`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => play($('band'), M, s)`,
  })
}

// ---------- 6. the details pane ----------

const days = Object.fromEntries(Array.from({ length: 75 }, (_, i) => [
  new Date(NOW - i * 864e5).toISOString().slice(0, 10),
  i % 6 === 5 ? {} : { turns: 2 + (i * 7) % 11, tools: 30 + (i * 13) % 40, edits: 8 + (i * 5) % 20, errors: i % 4 ? 0 : 1, commits: 1 + (i % 3), cost: 1, secs: 2400 + (i * 977) % 7000, night: i % 5 ? 0 : 1, add: 120 + (i * 31) % 300, del: 50 + (i * 17) % 200, early: i % 7 ? 0 : 1, langs: 3 }]))
const history = summarize([days], '2026-10-10')

{
  const files = [
    { code: ' M', path: 'src/cart.ts', add: 18, del: 4 }, { code: ' M', path: 'src/checkout/pay.ts', add: 42, del: 11 },
    { code: '??', path: 'src/checkout/receipt.ts' }, { code: ' M', path: 'src/theme.ts', add: 9, del: 2 }, { code: ' D', path: 'src/old.ts', add: 0, del: 31 }]
  const env = {
    ...NO_ENV,
    context: 58, agents: 0, turnTools: 5, tokens: 116_000, window: 200_000, compactAt: 167_000,
    slices: slicesAt(58),
    allSlices: [...slicesAt(58), sl('Free space', 51000), sl('Autocompact buffer', 33000)].map((s, i) => ({ ...s, kind: i === 5 ? 'free' : i === 6 ? 'buffer' : 'used' })),
    limits: [{ kind: 'five_hour', percent: 72, resetsAt: NOW + 95 * MIN }, { kind: 'seven_day', percent: 41, resetsAt: NOW + 3 * 864e5 }],
    samples: [{ kind: 'five_hour', at: NOW - 30 * MIN, p: 52 }, { kind: 'five_hour', at: NOW, p: 72 }],
    cost: 3.42, startedAt: NOW - 94 * MIN, last: '1m 12s · 8 tools',
    kinds: { read: 21, edit: 9, bash: 12, search: 7, web: 2, agent: 3 },
    turns: Array.from({ length: 12 }, (_, i) => ({ at: NOW - (12 - i) * 6 * MIN, seconds: 20 + (i * 37) % 160, tools: 3 + i % 7, edits: i % 3, errors: i === 5 ? 1 : 0, cost: 0.2 })),
    files: [{ path: 'C:/shop/src/cart.ts', reads: 3, edits: 2, at: NOW - 2 * MIN, add: 18, del: 4 }, { path: 'C:/shop/src/checkout/pay.ts', reads: 2, edits: 3, at: NOW - 9 * MIN, add: 42, del: 11 }],
    git: { branch: 'feat/checkout', ahead: 2, behind: 0, root: 'C:/shop', lastCommit: NOW - 40 * MIN, changed: files.length, files },
    lastEdit: { path: 'C:/shop/src/cart.ts', at: NOW - 2 * MIN, ctx: 'export function total(items) {', old: ['  return items.reduce((a, i) => a + i.price, 0)'], new: ['  const sum = items.reduce((a, i) => a + i.price * i.qty, 0)', '  return Math.round(sum * 100) / 100'], add: 2, del: 1 },
    diff: { path: 'src/cart.ts', more: 0, lines: [{ kind: 'ctx', text: 'export function total(items) {' }, { kind: 'old', text: '  return items.reduce((a, i) => a + i.price, 0)' }, { kind: 'new', text: '  const sum = items.reduce((a, i) => a + i.price * i.qty, 0)' }, { kind: 'new', text: '  return Math.round(sum * 100) / 100' }, { kind: 'ctx', text: '}' }] },
    me: { id: 'me', label: 'shop', state: 'busy', line: 'editing cart.ts', since: NOW - 70000, at: NOW, branch: 'feat/checkout', stateAt: NOW - 70000 },
    peers: [
      { id: 'a', label: 'api', state: 'asking', line: 'waiting for approval', since: NOW - 9 * MIN, at: NOW, branch: 'main', stateAt: NOW - 4 * MIN },
      { id: 'b', label: 'docs', state: 'busy', line: 'running build', since: NOW - 12 * MIN, at: NOW, branch: 'docs-refresh', isWorktree: true, stateAt: NOW - 12 * MIN },
      { id: 'c', label: 'infra', state: 'idle', line: '', since: 0, at: NOW, branch: 'main', stateAt: NOW - 50 * MIN }],
    history, tz: 0, badges: ['green', 'push', 'tidy'],
    ci: { sha: 'a1b2c3d4e5f6', pushedAt: NOW - 12 * MIN, state: 'passed', total: 4, done: 4, failed: [], startedAt: NOW - 11 * MIN, endedAt: NOW - 8 * MIN },
    pr: { number: 128, title: 'Checkout totals', review: 'approved', passed: 6, failed: 0, pending: 0 },
  }
  const svg = detailSvg(env, NOW, 720)
  const tall = detailHeight(svg)
  const VIEW = 540
  const travel = Math.max(0, tall + 40 - VIEW)
  scene({
    name: 'details', chapter: 'Details', dur: 16, tag: '06 · The details pane',
    title: 'Click the rings, and it all opens up',
    sub: 'This session, every chat on your machine, your CI and pull request, and every changed file, one click away.',
    beats: [
      [0.8, 'Rings with a forecast: <b>full by</b> when, at this pace'],
      [3.6, '<b>Every changed file</b>, the lines added and removed, with its diff'],
      [7.0, 'Every chat and what it is doing; CI runs and your <b>pull request</b>'],
      [10.4, 'The context by category, your turns and a <b>calendar</b> of your days'],
    ],
    body: `<div class="vc" data-in="0.3" style="left:478px;top:${(H - VIEW) / 2 - 6}px;width:760px;height:${VIEW}px;background:#1E1B19"><div id="pane" style="position:absolute;left:20px;top:20px;width:720px;height:${tall}px">${svg}</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:40px;background:linear-gradient(transparent,#1E1B19)"></div></div>`,
    script: `const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v) }
window.scene = s => {
  const k = 0.33 * smooth((s - 2.6) / 2.4) + 0.33 * smooth((s - 6.2) / 2.4) + 0.34 * smooth((s - 9.6) / 3)
  $('pane').style.transform = 'translateY(' + (-${travel} * k) + 'px)'
}`,
  })
}

// ---------- 8. levels and badges ----------

{
  const env = { ...NO_ENV, history }
  const lvl = levelSvg(env, NOW, 720)
  const earned = new Set(['green', 'push', 'steady', 'comeback', 'tidy', 'bird', 'polyglot', 'marathon', 'week', 'hundred', 'regular'])
  const NEW = 'owl'
  const BADGE_AT = 9.4
  const wear = { head: 'partyhat', neck: 'medal' }
  const M = bandMoments([
    { at: 0, r: onTurnEnd({ reason: 'completed', seconds: 74, tools: 9, edits: 3, errors: 0 }), ctx: 34, five: 40, recent: [ok('read'), ok('edit'), ok('bash')], wear: { head: 'gradcap' } },
    { at: 3.2, r: { mood: 'party', line: [st.level(12), st.newItems(itemName('wizard'))].join(' · '), sound: 'party' }, ctx: 34, five: 40, recent: [ok('read'), ok('edit'), ok('bash')], wear: { head: 'wizard', neck: 'medal' } },
    { at: BADGE_AT, r: { mood: 'proud', line: st.ready }, ctx: 36, five: 41, recent: [ok('read'), ok('edit'), ok('bash')], wear },
    { at: BADGE_AT + 4.2, r: { mood: 'party', line: t().fun.newBadge(badgeName(NEW)), sound: 'party' }, ctx: 36, five: 41, recent: [ok('read'), ok('edit'), ok('bash')], wear: { ...wear, ground: 'cat' } },
  ], wear)
  const cell = (b, i) => {
    const x = 478 + (i % 6) * 127
    const y = 104 + Math.floor(i / 6) * 128
    const isNew = b === NEW
    const icon = isNew
      ? `<div style="position:absolute;inset:0">${badgeSvg(b, false)}</div><div data-in="${BADGE_AT + 4.2}" data-fx="pop" data-d="0.7" style="position:absolute;inset:0">${badgeSvg(b, true)}</div>`
      : badgeSvg(b, earned.has(b))
    return `<div data-in="${BADGE_AT + 0.3 + i * 0.09}" data-fx="pop" style="position:absolute;left:${x}px;top:${y}px;width:120px;text-align:center">
<div style="position:relative;width:58px;height:58px;margin:0 auto 8px">${icon}</div>
<div style="font-size:13.5px;font-weight:600;color:${earned.has(b) || isNew ? '#F1ECE7' : '#6E6761'}">${esc(badgeName(b))}</div>
<div style="font-size:11px;line-height:1.3;color:#8A827B;height:29px;overflow:hidden">${esc(badgeHint(b))}</div></div>`
  }
  scene({
    name: 'levels', chapter: 'Levels', dur: 19, sfx: M, tag: '08 · Levels & badges',
    title: 'Real work, real rewards',
    sub: 'Experience from every turn, edit, commit and day. Eighteen badges, each celebrated once.',
    beats: [
      [0.6, 'Your <b>level</b>, its experience and the next thing to unlock'],
      [3.2, 'A <b>level-up</b> is a party, with something new to wear'],
      [BADGE_AT, 'A first green test run, a comeback, a tidy day, night owl, polyglot…'],
      [BADGE_AT + 4.2, 'And hard ones: a 30-day streak, 500 commits, 10,000 lines removed'],
    ],
    body: `<div class="vc" data-in="0.3" data-out="${BADGE_AT - 0.4}" style="left:478px;top:120px;width:760px;height:${Math.min(300, detailHeight(lvl) + 40)}px;background:#1E1B19"><div style="position:absolute;left:20px;top:20px;width:720px;height:${detailHeight(lvl)}px">${lvl}</div></div>
<div id="hero" data-in="0.5" data-out="${BADGE_AT - 0.4}" data-fx="pop" style="position:absolute;left:${858 - 120}px;top:256px;width:240px;height:240px"></div>
${BADGES.map(cell).join('')}
<div class="vc" data-in="0.6" style="left:478px;top:${H - 76 - 40 - 66}px;width:760px;height:116px"><div id="band" style="position:absolute;left:20px;top:20px;width:720px;height:76px"></div></div>`,
    script: `const M = ${JSON.stringify(M)}
const HERO = ${JSON.stringify(mascotMoments([{ at: 0, mood: 'proud', wear: { head: 'gradcap', neck: 'medal' } }, { at: 3.2, mood: 'party', wear: { head: 'wizard', neck: 'medal', ground: 'gift' } }]))}
window.scene = s => { play($('band'), M, s); if (s < ${BADGE_AT}) play($('hero'), HERO, s) }`,
  })
}

// ---------- 9. special days ----------

{
  const own = { birthday: '04-23', firstDay: '2024-10-28' }
  const list = [
    ['halloween', '10-31', { head: 'witchhat', ground: 'pumpkin' }],
    ['birthday', 'your birthday', { head: 'partyhat', ground: 'cake' }],
    ['newYear', 'New Year', { head: 'tophat', neck: 'bowtie', ground: 'gift' }],
    ['hanami', 'sakura season', { head: 'sakura' }],
    ['hacktoberfest', 'October', { neck: 'pin', head: 'beanie' }],
    ['anniversary', 'the day you met', { neck: 'rosette', ground: 'cake' }],
    ['piDay', '03-14', { face: 'nerdglasses', held: 'pencil' }],
    ['friday13', 'Friday the 13th', { ground: 'cat' }],
  ]
  const tiles = list.map(([name, when, wear]) => {
    const g = greeting(name, '2026-10-28', own)
    let mood = g.mood
    if (wear.held && !canHold(mood)) mood = 'pleased'
    return { line: g.line, when, svg: svgFor({ mood, scene: { context: 20, agents: 0, outfit: outfit(wear) }, from: null }, 0) }
  })
  scene({
    name: 'days', chapter: 'Days', dur: 12, tag: '09 · Special days',
    title: 'Dressed for the day',
    sub: 'Special days dress Mochi in what it has earned, and it says so.',
    beats: [
      [0.8, 'Halloween, New Year, sakura season, Hacktoberfest, π day, even Friday the 13th'],
      [4.5, 'And <b>your birthday</b>: <code>/mochi birthday 04-23</code>, and the day you met'],
      [7.5, 'Two hours without a break? It suggests a <b>stretch</b>'],
    ],
    body: tiles.map((tile, i) => `<div data-in="${0.6 + i * 0.25}" data-fx="pop" style="position:absolute;left:${478 + (i % 4) * 190}px;top:${110 + Math.floor(i / 4) * 270}px;width:190px;text-align:center">
<div id="d${i}" style="width:170px;height:170px;margin:0 auto"></div>
<div style="font-size:17px;font-weight:700;color:#F2B84B;margin-top:4px">${esc(tile.line)}</div>
<div style="font-size:13px;color:#8A827B">${esc(tile.when)}</div></div>`).join(''),
    script: `const D = ${JSON.stringify(tiles.map(tile => [{ at: 0, svg: tile.svg }]))}
window.scene = s => D.forEach((m, i) => play($('d' + i), m, s))`,
  })
}

// ---------- 10. show it off ----------

{
  const card = cardSvg(history, outfit({ head: 'crown', face: 'monocle', neck: 'medal', ground: 'cat' }))
  const wrapped = wrappedSvg(wrappedOf([{ label: 'shop', days }], 'month', '2026-10-03'), outfit({ head: 'wizard', neck: 'scarf' }))
  const SWAP = 6.2
  const label = (at, out, text) => `<div class="mono" data-in="${at}" ${out ? `data-out="${out}"` : ''} style="position:absolute;left:478px;width:760px;top:96px;text-align:center;font-size:20px;color:#F2B84B">${text}</div>`
  scene({
    name: 'share', chapter: 'Share', dur: 13, tag: '10 · Show it off',
    title: 'Pictures worth sharing',
    sub: 'SVG files that read on light and dark pages and need nothing outside themselves.',
    beats: [
      [0.6, '<code>/mochi card</code>: today\'s outfit, level and streaks, for your <b>GitHub profile</b>'],
      [SWAP, '<code>/mochi wrapped</code>: your <b>month</b> in one picture, or your year'],
      [9.6, '<code>/mochi snap</code>: the band and the pane, as they are right now'],
    ],
    body: `${label(0.4, SWAP - 0.3, '/mochi card')}${label(SWAP, 0, '/mochi wrapped')}
<div data-in="0.6" data-out="${SWAP - 0.3}" data-fx="pop" style="position:absolute;left:${858 - 371}px;top:180px;width:742px">${card.replace('<svg', '<svg style="width:100%;height:auto;display:block;filter:drop-shadow(0 30px 60px rgba(0,0,0,.5))"')}</div>
<div data-in="${SWAP + 0.2}" data-fx="pop" style="position:absolute;left:${858 - 270}px;top:140px;width:540px">${wrapped.replace('<svg', '<svg style="width:100%;height:auto;display:block;max-height:520px;filter:drop-shadow(0 30px 60px rgba(0,0,0,.5))"')}</div>`,
  })
}

// ---------- the end: install ----------

{
  const M = mascotMoments([
    { at: 0, mood: 'party', wear: { head: 'partyhat', neck: 'medal', ground: 'gift' } },
    { at: 4.5, mood: 'wave', wear: { head: 'partyhat', neck: 'medal', ground: 'gift' } },
  ])
  const cmd = '/plugin install mochi --marketplace oztrkemree/mochi'
  scene({
    name: 'outro', chapter: 'Install', dur: 9, bare: true, tag: '', title: '', sub: '', sfx: [{ at: 0.4, sound: 'party' }],
    body: `<div id="m" data-in="0.2" data-fx="pop" style="position:absolute;left:110px;top:150px;width:380px;height:380px"></div>
<div data-in="0.6" style="position:absolute;left:560px;top:170px;font-size:15px;font-weight:700;letter-spacing:.2em;color:#D97757" class="mono">INSTALL IN 10 SECONDS</div>
<div data-in="0.8" style="position:absolute;left:556px;top:196px;font-size:52px;font-weight:800;letter-spacing:-.03em">Say hi to Mochi.</div>
<div data-in="1.1" class="vc mono" style="left:560px;top:290px;width:640px;height:64px;padding:20px 22px;font-size:17px;color:#F1ECE7"><span style="color:#8A827B">&gt; </span><span id="cmd"></span><span class="caret" id="caret"></span></div>
<div data-in="3.6" style="position:absolute;left:560px;top:384px;font-size:18px;color:#B5ACA4;width:640px;line-height:1.6">Needs Claude Code 2.1.293 or later. Nothing to configure.</div>
<div style="position:absolute;left:560px;top:440px;display:flex;gap:10px;flex-wrap:wrap;width:660px">${['🌍 <b>16</b> languages', '🔒 <b>no</b> network', '📄 MIT'].map((c, i) => `<span class="pill" data-in="${4 + i * 0.25}" data-fx="pop">${c}</span>`).join('')}</div>
<div data-in="5.4" style="position:absolute;left:560px;top:520px;font-size:22px;font-weight:600;color:#F2B84B" class="mono">github.com/oztrkemree/mochi</div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => {
  play($('m'), M, s)
  typed($('cmd'), ${JSON.stringify(cmd)}, 1.4, 3.2, s)
  $('caret').style.opacity = Math.floor(s * 2.5) % 2 === 0 || (s > 1.3 && s < 3.3) ? 1 : 0
}`,
  })
}

// ---------- the short cut: 25 seconds for X and Reddit ----------

/** A big line across the top, readable with the sound off; <em> marks the word in Mochi's orange. */
const caption = (html, at = 0.05) => `<div data-in="${at}" data-d="0.35" style="position:absolute;left:0;right:0;top:30px;text-align:center;font-weight:800;font-size:46px;letter-spacing:-.025em;line-height:1.15">${html.replace(/<em>/g, '<em style="font-style:normal;color:#D97757">')}</div>`

/** The terminal, larger, under a caption. */
function bigTerm(log, WH, ask = '') {
  const k = 1.2
  return `<div data-in="0.05" data-d="0.3" style="position:absolute;left:${(W - 760 * k) / 2}px;top:112px;width:760px;height:${WH}px"><div style="position:absolute;inset:0;transform:scale(${k});transform-origin:0 0"><div class="win">${winChrome('claude — ~/shop')}
<div class="log">${log}</div>${ask}
<div class="band" id="band" style="top:${WH - 140}px"></div>
<div class="prompt" style="top:${WH - 58}px"><b>&gt;</b><span class="caret"></span></div></div></div></div>`
}

{
  const code = ['function isAdmin(user) {', '  if (user.isAdmin == true) {', '    return true', '  } else {', '    return false', '  }', '}']
  const M = mascotMoments([
    { at: 0, mood: 'wave', wear: { head: 'beanie', held: 'mug' } },
    { at: 1.55, mood: 'shocked', wear: { head: 'beanie' } },
    { at: 2.45, mood: 'denied', wear: { head: 'beanie' } },
  ])
  scene({
    name: 'short-hook', chapter: '', film: 'short', fade: 0.12, dur: 3.6, bare: true, tag: '', title: '', sub: '',
    sfx: [{ at: 1.55, sound: 'oops' }],
    body: `<div data-in="0.1" data-d="0.35" style="position:absolute;left:0;right:0;top:46px;text-align:center;font-weight:800;font-size:58px;letter-spacing:-.03em">I gave Claude Code a pet.</div>
<div data-in="1.5" data-d="0.3" style="position:absolute;left:0;right:0;top:120px;text-align:center;font-weight:800;font-size:58px;letter-spacing:-.03em;color:#D97757">It started judging my code.</div>
<div class="vc mono" data-in="0.9" data-fx="left" style="left:150px;top:300px;width:480px;padding:22px 24px;font-size:19px;line-height:1.6;color:#E9E3DD;white-space:pre">${code.map(l => esc(l).replace('== true', '<span style="background:rgba(240,100,90,.25);color:#F0645A;border-radius:4px">== true</span>')).join('\n')}</div>
<div id="m" data-in="0.05" data-fx="pop" style="position:absolute;left:700px;top:240px;width:420px;height:420px"></div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => play($('m'), M, s)`,
  })
}

{
  const test = { tool: 'Bash', command: 'npm test' }
  const r3 = [ok('read'), ok('search'), ok('edit')]
  const M = bandMoments([
    { at: 0, r: onPrompt('add a dark mode toggle', false), ctx: 11, five: 22, busy: true, recent: [] },
    { at: 0.6, r: beforeTool({ tool: 'Read', file_path: 'src/settings.tsx' }), ctx: 14, five: 23, busy: true, recent: [run('read')] },
    { at: 1.4, r: beforeTool({ tool: 'Edit', file_path: 'src/settings.tsx' }), ctx: 20, five: 24, busy: true, recent: [ok('read'), ok('search'), run('edit')], changed: 1 },
    { at: 2.3, r: beforeTool(test), ctx: 23, five: 25, busy: true, recent: [...r3, run('bash')], changed: 1 },
    { at: 3.0, r: afterTool(test, { isError: true, text: '2 failed' }, 1, 4), ctx: 25, five: 25, busy: true, recent: [...r3, fail('bash')], changed: 1 },
    { at: 4.0, r: afterTool(test, { isError: false, text: '48 passed' }, 0, 4), ctx: 30, five: 26, busy: true, recent: [...r3, fail('bash'), ok('edit'), ok('bash')], changed: 2 },
  ], { head: 'beanie', held: 'mug' })
  const log = [
    ln(0, '<span class="you">&gt; add a dark mode toggle</span>'),
    tool(0.6, 'Read', 'src/settings.tsx'),
    tool(1.4, 'Update', 'src/settings.tsx'),
    tool(2.3, 'Bash', 'npm test'),
    out(3.0, '<span class="bad">✗ 2 failed</span>'),
    tool(3.5, 'Update', 'src/theme.ts'),
    tool(3.7, 'Bash', 'npm test'),
    out(4.0, '<span class="ok">✓ 48 passed</span>'),
  ].join('')
  scene({
    name: 'short-react', chapter: '', film: 'short', fade: 0.12, dur: 5.4, bare: true, tag: '', title: '', sub: '', sfx: M,
    body: caption('It feels <em>everything</em> Claude does.') + bigTerm(log, 470),
    script: `const M = ${JSON.stringify(M)}
window.scene = s => play($('band'), M, s)`,
  })
}

{
  const cmd = 'rm -rf ./dist ~/'
  const what = danger(cmd)
  const d = t().shield
  const call = { tool: 'Bash', command: cmd }
  const M = bandMoments([
    { at: 0, r: onPrompt('clean up the old build folders', false), ctx: 15, five: 31, busy: true, recent: [] },
    { at: 0.5, r: beforeTool(call), ctx: 17, five: 32, busy: true, recent: [run('bash')] },
    { at: 0.9, r: { mood: 'scared', line: `${st.awaitingApproval} · ${what}` }, ctx: 17, five: 32, busy: true, recent: [run('bash')] },
    { at: 3.3, r: { mood: 'denied', line: `${st.halted} · ${what}` }, ctx: 17, five: 32, recent: [fail('bash')] },
  ], { head: 'hardhat' })
  const log = [
    ln(0, '<span class="you">&gt; clean up the old build folders</span>'),
    tool(0.5, 'Bash', cmd),
    out(3.3, '<span class="bad">Stopped by Mochi’s shield</span> <span class="dim">· nothing was deleted</span>'),
  ].join('')
  const ask = `<div class="ask" id="ask" style="top:110px"><div class="q" style="color:#D97757;font-weight:700;margin-bottom:6px">🛡️ Mochi</div><div class="q">${askHtml(d.question(what, cmd), cmd)}</div>${[d.run, d.stop, d.always].map((o, i) => `<div class="opt" id="o${i}">${esc(o)}</div>`).join('')}</div>`
  scene({
    name: 'short-shield', chapter: '', film: 'short', fade: 0.12, dur: 4.8, bare: true, tag: '', title: '', sub: '', sfx: M,
    body: caption('And it stops what you <em>can’t undo</em>.') + bigTerm(log, 500, ask),
    script: `const M = ${JSON.stringify(M)}
window.scene = s => {
  play($('band'), M, s)
  $('ask').style.opacity = s < 1.2 ? clamp((s - 1.0) / 0.2) : s < 3.3 ? 1 : 1 - clamp((s - 3.3) / 0.2)
  for (let i = 0; i < 3; i++) $('o' + i).classList.toggle('sel', i === (s < 2.3 ? 0 : 1))
}`,
  })
}

{
  const r = [ok('read'), ok('edit'), run('bash')]
  const M = bandMoments([
    { at: 0, r: beforeTool({ tool: 'Edit', file_path: 'src/cart.ts' }), ctx: 40, five: 52, busy: true, recent: r, slices: slicesAt(40) },
    { at: 1.3, r: beforeTool({ tool: 'Bash', command: 'npm run build' }), ctx: 58, five: 71, busy: true, recent: r, slices: slicesAt(58), forecast: { five_hour: NOW + 95 * MIN } },
    { at: 2.6, r: beforeTool({ tool: 'Edit', file_path: 'src/pay.ts' }), ctx: 76, five: 89, busy: true, recent: r, slices: slicesAt(76), warn: 1, forecast: { five_hour: NOW + 18 * MIN } },
  ], { head: 'gradcap', face: 'glasses' })
  const Z = 3.6
  scene({
    name: 'short-limits', chapter: '', film: 'short', fade: 0.12, dur: 4.4, bare: true, tag: '', title: '', sub: '',
    body: caption('Your limits, with a <em>forecast</em>.') + `<div class="vc" data-in="0.05" style="left:${(W - 260 * Z) / 2}px;top:150px;width:${Math.round(260 * Z)}px;height:${Math.round(76 * Z) + 30}px"><div style="position:absolute;left:0;top:15px;width:100%;height:${Math.round(76 * Z)}px;overflow:hidden"><div id="band" style="position:absolute;left:${-458 * Z}px;top:0;width:720px;height:76px;transform:scale(${Z});transform-origin:0 0"></div></div></div>
<div style="position:absolute;left:0;right:0;top:${150 + Math.round(76 * Z) + 60}px;display:flex;justify-content:center;gap:12px"><span class="pill" data-in="0.3" data-fx="pop">🧠 <b>context</b></span><span class="pill" data-in="0.45" data-fx="pop">⏱️ <b>5-hour</b> session</span><span class="pill" data-in="0.6" data-fx="pop">📅 <b>week</b></span></div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => play($('band'), M, s)`,
  })
}

{
  const looks = [
    { mood: 'wave', wear: { head: 'crown', face: 'monocle', ground: 'cat' } },
    { mood: 'pleased', wear: { head: 'astronaut', ground: 'rocket' } },
    { mood: 'wink', wear: { head: 'pirate', face: 'eyepatch', ground: 'chest' } },
    { mood: 'idle', wear: { head: 'dragon', neck: 'goldchain', ground: 'campfire' } },
    { mood: 'success', wear: { head: 'viking', face: 'beard', ground: 'axolotl' } },
    { mood: 'wave', wear: { head: 'unicorn', face: 'starglasses' } },
    { mood: 'pleased', wear: { head: 'chefhat', neck: 'bowtie', ground: 'cake' } },
    { mood: 'party', wear: { head: 'partyhat', neck: 'medal', ground: 'gift' } },
  ]
  const STEP = 0.52
  const M = mascotMoments(looks.map((l, i) => ({ at: 0.15 + i * STEP, ...l, label: Object.values(l.wear).filter(Boolean).map(itemName).join(' · ') })))
  scene({
    name: 'short-wear', chapter: '', film: 'short', fade: 0.12, dur: 4.6, bare: true, tag: '', title: '', sub: '', sfx: [{ at: 0.15 + 7 * STEP, sound: 'party' }],
    body: caption(`<em>${ITEMS}</em> things to wear. Earned by real work.`) + `<div id="m" style="position:absolute;left:${W / 2 - 200}px;top:130px;width:400px;height:400px"></div>
<div id="n" style="position:absolute;left:0;right:0;top:560px;text-align:center;font-size:26px;font-weight:700;color:#F2B84B"></div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => { const i = play($('m'), M, s); $('n').textContent = M[i].label }`,
  })
}

{
  const M = mascotMoments([{ at: 0, mood: 'party', wear: { head: 'partyhat', neck: 'medal', ground: 'gift' } }, { at: 1.6, mood: 'wave', wear: { head: 'partyhat', neck: 'medal', ground: 'gift' } }])
  scene({
    name: 'short-end', chapter: '', film: 'short', fade: 0.2, dur: 3.4, bare: true, tag: '', title: '', sub: '',
    body: `<div id="m" data-in="0" data-fx="pop" data-d="0.4" style="position:absolute;left:120px;top:150px;width:400px;height:400px"></div>
<div data-in="0.15" style="position:absolute;left:580px;top:190px;font-size:78px;font-weight:800;letter-spacing:-.04em">Mochi</div>
<div data-in="0.3" style="position:absolute;left:584px;top:290px;font-size:26px;color:#B5ACA4">for <span style="color:#D97757;font-weight:700">Claude Code</span> · free &amp; open source</div>
<div class="vc mono" data-in="0.5" style="left:584px;top:360px;width:600px;padding:18px 20px;font-size:16px"><span style="color:#8A827B">&gt; </span>/plugin install mochi --marketplace oztrkemree/mochi</div>
<div class="mono" data-in="0.7" style="position:absolute;left:584px;top:460px;font-size:24px;font-weight:600;color:#F2B84B">github.com/oztrkemree/mochi</div>`,
    script: `const M = ${JSON.stringify(M)}
window.scene = s => play($('m'), M, s)`,
  })
}

// ---------- the sound: Mochi's own blips over a soft loop ----------

const { clip } = await import('../hooks/sound.ts')

/** The film's soundtrack as a 16-bit mono WAV: a quiet C–G–Am–F loop, and Mochi's sounds where its reactions play them. */
function soundtrack(scenes, bpm) {
  const R = 44100
  const starts = []
  let total = 0
  for (const s of scenes) {
    starts.push(total)
    total += Math.round(s.dur * FPS) / FPS
  }
  const n = Math.ceil(total * R)
  const mix = new Float32Array(n)
  const hz = m => 440 * 2 ** ((m - 69) / 12)
  const voice = (at, dur, f, gain, shape) => {
    const from = Math.floor(at * R)
    const len = Math.floor(dur * R)
    for (let i = 0; i < len && from + i < n; i++) {
      const x = i / R
      const env = shape === 'pad' ? Math.min(1, x / 0.7, (dur - x) / 0.9)
        : shape === 'bass' ? Math.exp(-x * 2.2) * Math.min(1, x / 0.01)
        : Math.exp(-x * 5.5) * Math.min(1, x / 0.004)
      const w = 2 * Math.PI * f * x
      const v = shape === 'pad' ? Math.sin(w + 0.4 * Math.sin(w * 0.5)) * 0.6 + Math.sin(w * 1.003) * 0.4
        : shape === 'bass' ? Math.sin(w)
        : Math.sin(w) * 0.75 + Math.sin(w * 2) * 0.2 + Math.sin(w * 3) * 0.05
      mix[from + i] += v * env * gain
    }
  }
  const BEAT = 60 / bpm
  const BAR = BEAT * 4
  const CHORDS = [[48, 55, 64, 67], [43, 55, 59, 62], [45, 52, 60, 64], [41, 53, 57, 60]]
  for (let bar = 0; bar * BAR < total; bar++) {
    const at = bar * BAR
    const c = CHORDS[bar % 4]
    for (const m of c.slice(1)) voice(at, BAR + 0.5, hz(m), 0.022, 'pad')
    voice(at, BEAT * 2, hz(c[0] - 12), 0.07, 'bass')
    voice(at + BEAT * 2, BEAT * 2, hz(c[0] - 12), 0.05, 'bass')
    const arp = [c[1] + 12, c[2] + 12, c[3] + 12, c[2] + 24, c[3] + 12, c[2] + 12, c[1] + 12, c[3]]
    arp.forEach((m, k) => {
      if (bar % 8 < 2 && k % 2) return
      voice(at + (k * BEAT) / 2, 0.9, hz(m), k % 2 ? 0.022 : 0.032, 'pluck')
    })
  }
  // Mochi's blips, read back from the very WAVs the plugin plays.
  scenes.forEach((s, k) => {
    for (const { at, sound } of s.sfx) {
      const wav = Buffer.from(clip(sound), 'base64')
      const rate = wav.readUInt32LE(24)
      const data = wav.subarray(44)
      const from = Math.floor((starts[k] + at) * R)
      const len = Math.floor((data.length * R) / rate)
      for (let i = 0; i < len && from + i < n; i++) {
        const p = (i * rate) / R
        const j = Math.floor(p)
        const a = (data[j] - 128) / 127
        const b = ((data[j + 1] ?? 128) - 128) / 127
        mix[from + i] += (a + (b - a) * (p - j)) * 0.55
      }
    }
  })
  const out = Buffer.alloc(44 + n * 2)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + n * 2, 4)
  out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(R, 24)
  out.writeUInt32LE(R * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / (1.5 * R), (n - i) / (3 * R))
    out.writeInt16LE(Math.round(Math.tanh(mix[i] * fade * 2.4) * 32000), 44 + i * 2)
  }
  return out
}

/** Lays the soundtrack under a silent film. */
function mux(ffmpeg, work, silent, target, scenes) {
  const wav = join(work, 'sound.wav')
  writeFileSync(wav, soundtrack(scenes, scenes[0].film === 'short' ? 116 : 92))
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', target], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error('ffmpeg could not add the sound.')
}

// ---------- taking the frames ----------

function findBrowser() {
  const list = [
    process.env.BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const found = list.find(p => p && existsSync(p))
  if (!found) throw new Error('No Chrome or Edge found; set BROWSER to one.')
  return found
}

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg'
  const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' })
  if (py.status === 0) return py.stdout.trim()
  throw new Error('No ffmpeg found; put one on PATH, set FFMPEG, or pip install imageio-ffmpeg.')
}

async function tab(port) {
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

async function open(port, work, s) {
  const t = await tab(port)
  const file = join(work, `${s.name}.html`)
  writeFileSync(file, s.html)
  await t.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false })
  await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  await t.send('Page.enable')
  await t.send('Page.navigate', { url: pathToFileURL(file).href })
  await new Promise(r => setTimeout(r, 1500))
  return t
}

const shot = async (t, s) => (await t.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })).data

/** One scene's frames, straight into ffmpeg. */
async function render(port, work, ffmpeg, s) {
  const t = await open(port, work, s)
  const file = join(work, `${s.name}.mp4`)
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-color_range', 'tv', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => enc.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg stopped on ${s.name}`)))))
  const count = Math.round(s.dur * FPS)
  for (let i = 0; i < count; i++) {
    await t.send('Runtime.evaluate', { expression: `seek(${i / FPS})` })
    const buf = Buffer.from(await shot(t), 'base64')
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r))
  }
  enc.stdin.end()
  await done
  t.ws.close()
  console.log(`${s.name}: ${count} frames`)
  return file
}

SCENES.sort((a, b) => CHAPTERS.indexOf(a.chapter) - CHAPTERS.indexOf(b.chapter))
const [only, at] = process.argv.slice(2)
const tour = SCENES.filter(s => s.film === 'tour')
const chosen = only === 'short' ? SCENES.filter(s => s.film === 'short') : only && only !== 'sound' ? SCENES.filter(s => s.name === only) : tour
if (chosen.length === 0) throw new Error(`No scene named ${only}; there are ${SCENES.map(s => s.name).join(', ')}.`)

const work = mkdtempSync(join(tmpdir(), 'mochi-video-'))
const port = 9300 + Math.floor(Math.random() * 500)
const browser = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'profile')}`, '--hide-scrollbars', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' })

try {
  mkdirSync(join(ROOT, 'docs'), { recursive: true })
  if (only === 'sound') {
    // Only the soundtrack, laid again under the film already made.
    const ffmpeg = findFfmpeg()
    const target = join(ROOT, 'docs', 'mochi-demo.mp4')
    const silent = join(work, 'silent.mp4')
    spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', target, '-an', '-c', 'copy', silent], { stdio: 'inherit' })
    mux(ffmpeg, work, silent, target, tour)
    console.log(`${target}: sound laid`)
  } else if (at !== undefined) {
    const t = await open(port, work, chosen[0])
    await t.send('Runtime.evaluate', { expression: `seek(${Number(at)})` })
    const png = join(tmpdir(), `mochi-${only}-${at}.png`)
    writeFileSync(png, Buffer.from((await t.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    console.log(png)
  } else {
    const ffmpeg = findFfmpeg()
    // A few scenes at once, each in its own tab.
    const files = new Array(chosen.length)
    let next = 0
    await Promise.all(Array.from({ length: Math.min(4, chosen.length) }, async () => {
      while (next < chosen.length) {
        const k = next++
        files[k] = await render(port, work, ffmpeg, chosen[k])
      }
    }))
    const list = join(work, 'list.txt')
    writeFileSync(list, files.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'))
    const target = join(ROOT, 'docs', only === 'short' ? 'mochi-short.mp4' : only ? `demo-${only}.mp4` : 'mochi-demo.mp4')
    const silent = join(work, 'silent.mp4')
    const cat = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { stdio: 'inherit' })
    if (cat.status !== 0) throw new Error('ffmpeg could not join the scenes.')
    mux(ffmpeg, work, silent, target, chosen)
    console.log(`${target}: ${Math.round(chosen.reduce((a, s) => a + s.dur, 0))} s`)
  }
} finally {
  browser.kill()
  await new Promise(r => setTimeout(r, 500))
  rmSync(work, { recursive: true, force: true, maxRetries: 5 })
}
