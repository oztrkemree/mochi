import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { Badge, History, Item, Outfit } from '../../types'
import { badgeHint, badgeLook, badgeName, badgesOf, provenBy } from '../../hooks/badges'
import { dayKey } from '../../hooks/facts'
import { lang, pickLang, setLang, t } from '../../hooks/i18n'
import { type Choice, type Look, type Slot, SLOT_ITEMS, choiceFrom, choiceText, dressAs, hintFor, itemName, itemShort, levelOf, lookFrom, skinName, skinNow, slotName, xpOf } from '../../hooks/level'
import { itemIcon, svgFor } from '../../hooks/rig'
import { SKINS, type Skin, skinOf, skinsAt } from '../../hooks/skins'
import { bestOutfit, cardSvg } from '../../hooks/share'
import { BADGE_PLACE, CATS, type Cat, type Feat, TIERS, featsOf, tally } from './feats'
import { type Effort, effortOf, sumOf } from './effort'
import { growthOf, historyOf } from './growth'
import { SIGN, medalSvg } from './medal'
import { KEY, NAME_MAX, type Saved, outfitsFrom, removed, saved, wearable } from './outfits'
import { loadSettings } from './settings'
import { startSettings } from './settings-page'
import { chosen, lookNow } from './wardrobe'
import { words } from './words'
import { PERIODS, type WorkState, drawWork } from './work-tab'
import { SPANS, quotaOf, usageOf } from './usage'
import { type Feed, type UsageState, drawUsage } from './usage-tab'
import { stillOf } from './world'

/**
 * Mochi's room: a window of its own, opened from the pocket. Mochi stands in
 * the light, dressed as it is, and tries on what the pointer rests on; beside
 * it, the wardrobe, the achievements and the settings. A choice here is written to
 * prefs.json, so the Mochi in the corner and the mod's wear it too.
 */

const $ = (id: string) => document.getElementById(id)!
const tz = () => -new Date().getTimezoneOffset()
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}
const svgIn = (className: string, svg: string) => {
  const node = el('span', className)
  // The mod's own drawings, made here from its own data.
  node.innerHTML = svg
  return node
}
/** A tick drawn in white, for what is worn. */
const TICK = '<svg viewBox="0 0 18 18"><path d="M5 9.2l2.6 2.6L13 6.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const CARD = '<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="8" r="1.8" fill="currentColor"/><path d="M9 7h3.5M9 9.5h2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'

let history: History | null = null
let modLook: Look | null = null
let prefs: Choice | null = null
let badges: Badge[] = []
let look: Look | null = null
const TABS = ['wardrobe', 'feats', 'work', 'usage', 'settings'] as const
type Tab = (typeof TABS)[number]
const isTab = (v: unknown): v is Tab => (TABS as readonly unknown[]).includes(v)
/** The tab asked for (the tray's Settings), else the one last open. */
let tab: Tab = (() => {
  const asked = new URLSearchParams(location.search).get('tab')
  const last = localStorage.getItem('roomTab')
  return isTab(asked) ? asked : isTab(last) ? last : 'wardrobe'
})()
let isSettingsUp = false
let shelf: Slot | 'colour' = 'colour'
/** Where the work went, for the Work tab; the stretch shown is kept between openings. */
let effort: Effort | null = null
let work: WorkState = { period: Math.min(PERIODS.length - 1, Math.max(0, Number(localStorage.getItem('workPeriod') ?? PERIODS.length - 1) || 0)), focus: null }
/** What CodeBurn last counted, for the Usage tab: kept between openings (a month's count takes CodeBurn half a minute), counted again when older than five minutes. */
let usageSt: UsageState = { span: Math.min(SPANS.length - 1, Math.max(0, Number(localStorage.getItem('usageSpan') ?? 1) || 0)) }
const feed: Feed = { report: null, quota: [], claude: [], busy: false, error: '' }
const counting = new Set<string>()
const USAGE_FRESH_MS = 5 * 60_000

/** What Mochi has on, as it stands at rest; with an item tried on, that item in its slot. */
function outfit(trying: Item | null = null): Outfit {
  if (!look) return bestOutfit([])
  const now = Date.now()
  if (trying === null) return dressAs(look, 'idle', now)
  const slot = (Object.keys(SLOT_ITEMS) as Slot[]).find(s => SLOT_ITEMS[s].includes(trying))!
  return dressAs({ ...look, pick: { ...look.pick, [slot]: trying } }, 'idle', now)
}

/** The colour Mochi wears now: the chosen one, while the level opens it. */
const wornSkin = () => skinNow(prefs?.skin, history)

function drawMochi(trying: Item | null = null, tryingSkin: string | null = null) {
  const skin = tryingSkin ?? wornSkin()
  const svg = svgFor({ mood: 'idle', scene: { context: -1, agents: 0, outfit: outfit(trying), ...(skin ? { skin } : {}) }, from: null })
  // Held still: the room never redraws on a clock.
  $('mochi').innerHTML = stillOf(svg)
  const name = trying ? itemName(trying) : tryingSkin ? skinName(tryingSkin) : ''
  $('mochi').setAttribute('aria-label', name || t().ui.wardrobe)
  $('trying').textContent = name
}

function drawPlate() {
  if (!history) return
  const g = growthOf(history)
  const d = t().detail
  $('level').textContent = d.levelN(g.level)
  ;($('xp') as HTMLElement).style.width = `${Math.round((g.into / Math.max(1, g.span)) * 100)}%`
  $('next').textContent = d.toNext(String(g.toNext))
  const facts = $('facts')
  facts.replaceChildren()
  for (const [value, label] of [[g.streak, d.streak], [g.today, d.today], [g.activeDays, t().share.activeDays]] as const) {
    const fact = el('div')
    fact.append(el('dt', '', String(value)), el('dd', '', label))
    facts.append(fact)
  }
  $('won').replaceChildren(...badges.map(b => {
    const look = badgeLook(b)
    const medal = svgIn('', medalSvg(look.ink, look.sign, BADGE_PLACE[b].tier, true))
    medal.title = badgeName(b)
    return medal
  }))
}

function drawTabs() {
  const tabs = $('tabs')
  tabs.replaceChildren()
  const open = look?.items.length ?? 0
  const all = Object.values(SLOT_ITEMS).flat().length
  for (const [name, label, count] of [['wardrobe', t().ui.wardrobe, `${open}/${all}`], ['feats', words().feats.title, history ? (({ done, all }) => `${done}/${all}`)(tally(featsOf(history, badges))) : ''], ['work', words().work.tab, ''], ['usage', words().usage.tab, ''], ['settings', t().pane.tabs.settings, '']] as const) {
    const b = el('button', '', label)
    b.type = 'button'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', String(tab === name))
    if (count) b.append(el('small', '', count))
    b.addEventListener('click', () => show(name))
    tabs.append(b)
  }
}

const LOCK = '<svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.6" fill="currentColor"/><path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'

/** A skin's paint, as a swatch shows it: its colour, or the run of its colours. */
const paintOf = (k: Skin) => (k.swatch.length === 1 ? k.swatch[0]! : `linear-gradient(135deg, ${k.swatch.join(', ')})`)

/**
 * The wardrobe: a rail of shelves (Mochi's colour, then each slot with what it
 * has on there), and the shelf open beside it: its colours or its things, those
 * that can be worn first. Resting on one, Mochi tries it on; pressing it wears it.
 */
function drawWardrobe(into: HTMLElement) {
  if (!look || !history) return
  const l = look
  const worn = outfit()
  const open = new Set(l.items)
  const level = levelOf(xpOf(history)).level
  const skinWorn = wornSkin() ?? 'clay'
  const box = el('div', 'wardrobe')
  const rail = el('nav', 'rail')
  const shelfButton = (key: Slot | 'colour', icon: HTMLElement, name: string, count: string) => {
    const b = el('button')
    b.type = 'button'
    b.setAttribute('aria-pressed', String(key === shelf))
    b.append(icon, el('span', 'name', name), el('small', '', count))
    b.addEventListener('click', () => {
      shelf = key
      draw()
    })
    rail.append(b)
  }
  const dot = el('span', 'paint')
  dot.style.background = paintOf(skinOf(skinWorn)!)
  shelfButton('colour', dot, t().ui.colour, `${skinsAt(level).length}/${SKINS.length}`)
  for (const slot of (Object.keys(SLOT_ITEMS) as Slot[])) {
    const on = worn[slot]
    shelfButton(slot, on ? svgIn('on', itemIcon(on, true)) : el('span', 'none'), slotName(slot), `${SLOT_ITEMS[slot].filter(i => open.has(i)).length}/${SLOT_ITEMS[slot].length}`)
  }
  const side = el('section', 'shelf')
  const head = el('header')
  const title = el('div')
  if (shelf === 'colour') {
    title.append(el('h2', '', t().ui.colour), el('p', '', t().ui.unlockedOf(skinsAt(level).length, SKINS.length)))
    head.append(title)
    const grid = el('div', 'swatches')
    for (const k of SKINS) {
      const isOpen = level >= k.level
      const b = el('button', 'swatch')
      b.type = 'button'
      b.disabled = !isOpen
      b.setAttribute('aria-pressed', String(skinWorn === k.id))
      const paint = el('span', 'paint')
      paint.style.background = paintOf(k)
      if (!isOpen) paint.append(svgIn('lock', LOCK))
      b.append(paint, el('b', '', skinName(k.id)), el('small', '', isOpen ? ' ' : words().levelN(k.level)))
      if (isOpen) {
        b.addEventListener('pointerenter', () => drawMochi(null, k.id))
        b.addEventListener('focus', () => drawMochi(null, k.id))
        b.addEventListener('pointerleave', () => drawMochi())
        b.addEventListener('blur', () => drawMochi())
        b.addEventListener('click', () => wearSkin(k.id))
      }
      grid.append(b)
    }
    side.append(head, grid)
  } else {
    const slot = shelf
    title.append(el('h2', '', slotName(slot)), el('p', '', t().ui.unlockedOf(SLOT_ITEMS[slot].filter(i => open.has(i)).length, SLOT_ITEMS[slot].length)))
    const ways = el('div', 'ways')
    for (const [label, item] of [[t().ui.auto, undefined], [t().ui.nothing, null]] as const) {
      const b = el('button', '', label)
      b.type = 'button'
      b.setAttribute('aria-pressed', String(l.pick[slot] === item))
      b.addEventListener('click', () => choose(slot, item))
      ways.append(b)
    }
    head.append(title, ways)
    const grid = el('div', 'grid')
    for (const item of [...SLOT_ITEMS[slot].filter(i => open.has(i)), ...SLOT_ITEMS[slot].filter(i => !open.has(i))]) {
      const isOpen = open.has(item)
      const b = el('button', 'item')
      b.type = 'button'
      b.disabled = !isOpen
      b.setAttribute('aria-pressed', String(worn[slot] === item))
      b.title = isOpen ? itemName(item) : hintFor(item)
      b.append(svgIn('pic', itemIcon(item, isOpen)), el('b', '', itemShort(item)))
      if (!isOpen) b.append(el('small', '', hintFor(item)), svgIn('lock', LOCK))
      b.append(svgIn('tick', TICK))
      if (isOpen) {
        b.addEventListener('pointerenter', () => drawMochi(item))
        b.addEventListener('focus', () => drawMochi(item))
        b.addEventListener('pointerleave', () => drawMochi())
        b.addEventListener('blur', () => drawMochi())
        b.addEventListener('click', () => choose(slot, worn[slot] === item ? null : item))
      }
      grid.append(b)
    }
    side.append(head, grid)
  }
  box.append(rail, side)
  into.append(box)
  drawLooks(into)
}

/** A colour chosen: worn at once, and written beside the wardrobe's choice. */
function wearSkin(id: string) {
  prefs = { at: Date.now(), pick: prefs?.pick ?? modLook?.pick ?? {}, ...(id === 'clay' ? {} : { skin: id }) }
  drawMochi()
  draw()
  void invoke('write_shared', { name: 'prefs.json', text: choiceText(prefs) })
}

/** The looks kept in this browser; none when storage cannot be read. */
function looksKept(): Saved[] {
  try {
    return outfitsFrom(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

/** Writes the kept looks; when storage refuses, nothing is kept. */
function putLooks(list: Saved[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage refused: the look is not kept.
  }
}

/** A saved look worn: its whole pick becomes the person's choice at once. */
function wearLook(s: Saved) {
  if (!look) return
  prefs = { at: Date.now(), pick: wearable(s.pick, look.items), ...(prefs?.skin ? { skin: prefs.skin } : {}) }
  look = lookNow(history, modLook, prefs, tz())
  drawMochi()
  draw()
  void invoke('write_shared', { name: 'prefs.json', text: choiceText(prefs) })
}

/** The saved looks under the shelves: a name keeps the look worn now; each kept look is a chip that wears it, with a remove. */
function drawLooks(into: HTMLElement) {
  const w = words().outfits
  const block = el('section', 'w-sec')
  block.append(el('h3', '', w.title))
  const form = el('form', 'ways')
  const input = el('input')
  input.type = 'text'
  input.placeholder = w.name
  input.maxLength = NAME_MAX
  const keep = el('button', '', w.save)
  keep.type = 'submit'
  form.append(input, keep)
  form.addEventListener('submit', e => {
    e.preventDefault()
    if (!look || input.value.trim() === '') return
    putLooks(saved(looksKept(), input.value, look.pick))
    draw()
  })
  block.append(form)
  const all = looksKept()
  if (all.length === 0) block.append(el('p', 'w-note', w.none))
  const chips = el('div', 'w-chips')
  for (const s of all) {
    const chip = el('span', 'w-chip')
    const wear = el('button', '', s.name)
    wear.type = 'button'
    wear.addEventListener('click', () => wearLook(s))
    const drop = el('button', '', '×')
    drop.type = 'button'
    drop.setAttribute('aria-label', w.remove)
    drop.addEventListener('click', () => {
      putLooks(removed(looksKept(), s.name))
      draw()
    })
    chip.append(wear, drop)
    chips.append(chip)
  }
  block.append(chips)
  into.append(block)
}

/** Each theme's colour, for the face of its milestones' medals. */
const CAT_INK: Record<Cat, string> = { talk: '#7AA2F7', code: '#4CC38A', ship: '#FF9E63', time: '#B794F6', steady: '#F0645A', mochi: '#D97757' }

/** An achievement's medal: a badge in its own colour and sign, a milestone in its theme's colour with the sign of what it counts. */
function iconOf(f: Feat): string {
  if (f.badge) {
    const look = badgeLook(f.badge)
    return medalSvg(look.ink, look.sign, f.tier, f.done)
  }
  return medalSvg(CAT_INK[f.cat], SIGN[f.metric!] ?? '', f.tier, f.done)
}

const bar = (done: number, all: number) => {
  const track = el('div', 'meter')
  const fill = el('i')
  fill.style.width = `${all > 0 ? Math.round((done / all) * 100) : 0}%`
  track.append(fill)
  return track
}

/** Achievements: how many are done, by tier; then each theme with its own count, its badges and milestones, done or how far along. */
function drawFeats(into: HTMLElement) {
  if (!history) return
  const w = words().feats
  const n = new Intl.NumberFormat(lang())
  const feats = featsOf(history, badges)
  const all = tally(feats)
  const top = el('div', 'overall')
  const sum = el('div', 'sum')
  sum.append(el('strong', '', `${all.done}`), el('span', '', `/ ${all.all}`), el('p', '', w.done(all.done, all.all)), bar(all.done, all.all))
  const tiers = el('div', 'tiers')
  for (const tier of TIERS) {
    const c = tally(feats.filter(f => f.tier === tier))
    const row = el('div', `tier ${tier}`)
    row.append(el('b', '', w.tiers[tier]), el('span', '', `${c.done}/${c.all}`), bar(c.done, c.all))
    tiers.append(row)
  }
  top.append(sum, tiers)
  into.append(top)
  for (const cat of CATS) {
    const mine = feats.filter(f => f.cat === cat).sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier))
    const c = tally(mine)
    const section = el('section', 'cat')
    const head = el('header')
    head.append(el('h2', '', w.cats[cat]), el('span', '', `${c.done}/${c.all}`), bar(c.done, c.all))
    const grid = el('div', 'feats')
    for (const f of mine) {
      const card = el('div', f.done ? 'feat done' : 'feat')
      const text = el('div', 'text')
      const name = f.badge ? badgeName(f.badge) : w.name[f.id] ?? f.id
      const hint = f.badge ? badgeHint(f.badge) : w.metric[f.metric!](n.format(f.target))
      text.append(el('b', '', name), el('span', 'hint', hint))
      if (!f.done && f.target > 1) {
        const progress = el('div', 'progress')
        progress.append(bar(f.now, f.target), el('small', '', `${n.format(f.now)} / ${n.format(f.target)}`))
        text.append(progress)
      }
      card.append(svgIn('pic', iconOf(f)), text, el('em', `tag ${f.tier}`, w.tiers[f.tier]))
      grid.append(card)
    }
    section.append(head, grid)
    into.append(section)
  }
}

function show(name: Tab) {
  if ((tab === 'work' || tab === 'usage') && name !== tab) $('said').textContent = ''
  tab = name
  localStorage.setItem('roomTab', name)
  draw()
  if (name === 'usage') void countUsage()
}

function draw() {
  drawTabs()
  const panel = $('panel')
  // The settings' markup stays in the page; the rest is drawn afresh.
  panel.hidden = tab === 'settings'
  $('settings').hidden = tab !== 'settings'
  if (tab === 'settings') {
    if (!isSettingsUp) {
      isSettingsUp = true
      void startSettings(speakAgain)
    }
    return
  }
  const y = panel.scrollTop
  panel.replaceChildren()
  if (tab === 'wardrobe') drawWardrobe(panel)
  else if (tab === 'feats') drawFeats(panel)
  else if (tab === 'usage') {
    drawUsage(panel, feed, usageSt, next => {
      usageSt = next
      localStorage.setItem('usageSpan', String(next.span))
      void countUsage()
    }, () => void countUsage(true))
    // Mochi says one thing of the money: how much the cache spared, when it spared most of it.
    const hit = feed.report?.cacheHit ?? 0
    $('said').textContent = hit >= 90 ? words().usage.thrifty(new Intl.NumberFormat(lang(), { style: 'percent', maximumFractionDigits: 1 }).format(Math.floor(hit * 10) / 1000)) : ''
  } else if (effort) {
    drawWork(panel, effort, work, next => {
      work = next
      localStorage.setItem('workPeriod', String(next.period))
      draw()
    })
    // Mochi says one thing of the stretch: the turns after midnight, if there were any.
    const from = effort.days.length - Math.min(PERIODS[work.period] ?? 42, effort.days.length)
    const night = [...effort.projects, effort.unmatched].reduce((s, p) => s + sumOf(p.daily, from).night, 0)
    $('said').textContent = night > 0 ? words().work.yawn(new Intl.NumberFormat(lang()).format(night)) : ''
  }
  // Drawn again in place: the panel stays where it was scrolled to.
  panel.scrollTop = y
}

/** The language changed in the settings: the room says everything again in it. */
function speakAgain() {
  document.title = words().room
  drawCard()
  drawMochi()
  drawPlate()
  draw()
}

function drawCard() {
  const card = $('card')
  card.innerHTML = CARD
  card.append(words().card)
}

/** A choice made here: worn at once, and written for the Mochi in the corner and the mod's to wear too. */
function choose(slot: Slot, item: Item | null | undefined) {
  prefs = { at: Date.now(), pick: chosen(prefs?.pick ?? modLook?.pick ?? {}, slot, item), ...(prefs?.skin ? { skin: prefs.skin } : {}) }
  look = lookNow(history, modLook, prefs, tz())
  drawMochi()
  draw()
  void invoke('write_shared', { name: 'prefs.json', text: choiceText(prefs) })
}

const parse = (text: string | null): unknown => {
  try {
    return text === null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

/** The Usage tab's numbers: what was kept, at once; then CodeBurn asked again if they are old (or `force`), one count of a span at a time. */
async function countUsage(force = false) {
  const span = SPANS[usageSt.span] ?? 'week'
  const kept = (key: string) => localStorage.getItem(`usage:${key}`)
  feed.report = usageOf(parse(kept(span)))
  feed.quota = quotaOf(parse(kept('quota')))
  // Claude's limits as Mochi's own chats last heard them (its corner window keeps them), for when CodeBurn cannot tell them.
  const heard = parse(localStorage.getItem('limits'))
  feed.claude = Array.isArray(heard) ? heard.filter((x): x is { kind: string; p: number; resetsAt: number } => typeof x?.kind === 'string' && typeof x?.p === 'number').map(x => ({ label: x.kind, used: x.p, resetsAt: Number(x.resetsAt) || 0 })) : []
  const isOld = !feed.report || Date.now() - feed.report.at > USAGE_FRESH_MS
  if ((!force && !isOld) || counting.has(span)) {
    feed.busy = counting.has(span)
    if (feed.report) feed.error = ''
    if (tab === 'usage') draw()
    return
  }
  counting.add(span)
  feed.busy = true
  if (tab === 'usage') draw()
  const ask = (key: string, kind: string) => invoke<string>('usage', { kind, span: key }).then(text => {
    localStorage.setItem(`usage:${kind === 'quota' ? 'quota' : key}`, text)
    return ''
  }).catch((e: unknown) => (e === 'missing' ? 'missing' : 'failed'))
  const [status] = await Promise.all([ask(span, 'status'), ask('', 'quota')]).finally(() => counting.delete(span))
  // Drawn only if the span asked for is still the one shown.
  if ((SPANS[usageSt.span] ?? 'week') !== span) return
  feed.error = status as Feed['error']
  feed.busy = false
  feed.report = usageOf(parse(kept(span)))
  feed.quota = quotaOf(parse(kept('quota')))
  if (tab === 'usage') draw()
}

/** Everything read again: the room is opened often, and other Mochis count and choose too. */
async function read() {
  const now = Date.now()
  const files = await invoke<string[]>('read_all_days').catch(() => [])
  history = historyOf(files, dayKey(now, tz()))
  const repos = parse(await invoke<string | null>('read_shared', { name: 'repos.json' }).catch(() => null))
  effort = effortOf(files, typeof repos === 'object' && repos !== null && !Array.isArray(repos) ? Object.keys(repos) : [], dayKey(now, tz()))
  modLook = lookFrom(parse(await invoke<string | null>('read_look').catch(() => null)))
  prefs = choiceFrom(await invoke<string | null>('read_shared', { name: 'prefs.json' }).catch(() => null))
  const kept = badgesOf(parse(await invoke<string | null>('read_shared', { name: 'badges.json' }).catch(() => null))) ?? []
  badges = [...new Set([...kept, ...provenBy(history)])]
  look = lookNow(history, modLook, prefs, tz())
  drawMochi()
  drawPlate()
  draw()
  if (tab === 'usage') void countUsage()
}

function start() {
  const settings = loadSettings()
  setLang(settings.lang === 'auto' ? (pickLang(navigator.language) ?? 'en') : settings.lang)
  document.documentElement.lang = lang()
  document.documentElement.dir = lang() === 'ar' ? 'rtl' : 'ltr'
  document.title = words().room
  drawCard()
  $('card').addEventListener('click', () => void (async () => {
    const path = await invoke<string | null>('save_share', { name: 'mochi-card.svg', svg: cardSvg(history, outfit()) })
    $('said').textContent = path === null ? t().share.failed('~/.claude/mochi/share') : t().share.cardSaved(path)
  })())
  void read()
  addEventListener('focus', () => void read())
  // Asked for a tab while open (the tray's Settings).
  void listen<string>('tab', e => {
    if (isTab(e.payload)) show(e.payload)
  })
}
start()
