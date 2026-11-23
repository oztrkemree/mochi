import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { Badge, History, Item, Outfit } from '../../types'
import { badgeHint, badgeName, badgeSvg, badgesOf, provenBy } from '../../hooks/badges'
import { citySvg } from '../../hooks/city'
import { dayKey, local } from '../../hooks/facts'
import { lang, pickLang, setLang, t } from '../../hooks/i18n'
import { type Choice, type Look, type Slot, SLOT_ITEMS, choiceFrom, choiceText, dressAs, hintFor, itemName, itemShort, lookFrom, slotName } from '../../hooks/level'
import { itemIcon, svgFor } from '../../hooks/rig'
import { bestOutfit, cardSvg } from '../../hooks/share'
import { CATS, type Cat, type Feat, TIERS, type Tier, featsOf, tally } from './feats'
import { growthOf, historyOf } from './growth'
import { loadSettings } from './settings'
import { startSettings } from './settings-page'
import { chosen, lookNow } from './wardrobe'
import { words } from './words'
import { stillOf } from './world'

/**
 * Mochi's room: a window of its own, opened from the pocket. Mochi stands in
 * the light, dressed as it is, and tries on what the pointer rests on; beside
 * it, the wardrobe, the badges and the city. A choice here is written to
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
const TABS = ['wardrobe', 'feats', 'city', 'settings'] as const
type Tab = (typeof TABS)[number]
const isTab = (v: unknown): v is Tab => (TABS as readonly unknown[]).includes(v)
/** The tab asked for (the tray's Settings), else the one last open. */
let tab: Tab = (() => {
  const asked = new URLSearchParams(location.search).get('tab')
  const last = localStorage.getItem('roomTab')
  return isTab(asked) ? asked : isTab(last) ? last : 'wardrobe'
})()
let isSettingsUp = false
let shelf: Slot = 'head'

/** What Mochi has on, as it stands at rest; with an item tried on, that item in its slot. */
function outfit(trying: Item | null = null): Outfit {
  if (!look) return bestOutfit([])
  const now = Date.now()
  if (trying === null) return dressAs(look, 'idle', now)
  const slot = (Object.keys(SLOT_ITEMS) as Slot[]).find(s => SLOT_ITEMS[s].includes(trying))!
  return dressAs({ ...look, pick: { ...look.pick, [slot]: trying } }, 'idle', now)
}

function drawMochi(trying: Item | null = null) {
  const svg = svgFor({ mood: 'idle', scene: { context: -1, agents: 0, outfit: outfit(trying) }, from: null })
  // Held still: the room never redraws on a clock.
  $('mochi').innerHTML = stillOf(svg)
  $('mochi').setAttribute('aria-label', trying ? itemName(trying) : t().ui.wardrobe)
  $('trying').textContent = trying ? itemName(trying) : ''
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
    const medal = svgIn('', badgeSvg(b, true))
    medal.title = badgeName(b)
    return medal
  }))
}

function drawTabs() {
  const tabs = $('tabs')
  tabs.replaceChildren()
  const open = look?.items.length ?? 0
  const all = Object.values(SLOT_ITEMS).flat().length
  for (const [name, label, count] of [['wardrobe', t().ui.wardrobe, `${open}/${all}`], ['feats', words().feats.title, history ? (({ done, all }) => `${done}/${all}`)(tally(featsOf(history, badges))) : ''], ['city', t().pane.city, ''], ['settings', t().pane.tabs.settings, '']] as const) {
    const b = el('button', '', label)
    b.type = 'button'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', String(tab === name))
    if (count) b.append(el('small', '', count))
    b.addEventListener('click', () => show(name))
    tabs.append(b)
  }
}

/** The wardrobe: the slots, each with what it has on; Mochi's own pick or nothing; then the slot's things, what is open first. */
function drawWardrobe(into: HTMLElement) {
  if (!look) return
  const l = look
  const worn = outfit()
  const open = new Set(l.items)
  const slots = el('div', 'slots')
  slots.setAttribute('role', 'group')
  for (const slot of (Object.keys(SLOT_ITEMS) as Slot[])) {
    const has = SLOT_ITEMS[slot].filter(i => open.has(i)).length
    const b = el('button')
    b.type = 'button'
    b.setAttribute('aria-pressed', String(slot === shelf))
    const on = worn[slot]
    b.append(on ? svgIn('on', itemIcon(on, true)) : el('span', 'none'), el('span', '', slotName(slot)), el('small', '', `${has}/${SLOT_ITEMS[slot].length}`))
    b.addEventListener('click', () => {
      shelf = slot
      draw()
    })
    slots.append(b)
  }
  const ways = el('div', 'ways')
  const choice = l.pick[shelf]
  for (const [label, item] of [[t().ui.auto, undefined], [t().ui.nothing, null]] as const) {
    const b = el('button', '', label)
    b.type = 'button'
    b.setAttribute('aria-pressed', String(choice === item))
    b.addEventListener('click', () => choose(shelf, item))
    ways.append(b)
  }
  ways.append(el('span', '', t().ui.unlockedOf(SLOT_ITEMS[shelf].filter(i => open.has(i)).length, SLOT_ITEMS[shelf].length)))
  const grid = el('div', 'grid')
  const things = [...SLOT_ITEMS[shelf].filter(i => open.has(i)), ...SLOT_ITEMS[shelf].filter(i => !open.has(i))]
  for (const item of things) {
    const isOpen = open.has(item)
    const b = el('button', 'item')
    b.type = 'button'
    b.disabled = !isOpen
    b.setAttribute('aria-pressed', String(worn[shelf] === item))
    b.title = isOpen ? itemName(item) : hintFor(item)
    b.append(svgIn('pic', itemIcon(item, isOpen)), el('b', '', itemShort(item)))
    if (!isOpen) b.append(el('small', '', hintFor(item)))
    b.append(svgIn('tick', TICK))
    if (isOpen) {
      // Rested on, Mochi tries it on; pressed, it wears it (or takes it off).
      b.addEventListener('pointerenter', () => drawMochi(item))
      b.addEventListener('focus', () => drawMochi(item))
      b.addEventListener('pointerleave', () => drawMochi())
      b.addEventListener('blur', () => drawMochi())
      b.addEventListener('click', () => choose(shelf, worn[shelf] === item ? null : item))
    }
    grid.append(b)
  }
  into.append(slots, ways, grid)
}

/** Each theme's colour, and a sign drawn in white on its medal. */
const CAT_LOOK: Record<Cat, { ink: string; sign: string }> = {
  talk: { ink: '#7AA2F7', sign: '<path d="M7 8.5h10a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-5l-3.5 2.8v-2.8H7a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2z"/>' },
  code: { ink: '#4CC38A', sign: '<path d="M9.5 9 6 12.5 9.5 16M14.5 9l3.5 3.5-3.5 3.5"/>' },
  ship: { ink: '#FF9E63', sign: '<path d="M12 6.5v8.5M8.5 10 12 6.5l3.5 3.5M7 17.5h10"/>' },
  time: { ink: '#B794F6', sign: '<circle cx="12" cy="12.5" r="5.5"/><path d="M12 9.5v3.2l2.2 1.5"/>' },
  steady: { ink: '#F0645A', sign: '<path d="M12 6c2.6 2.6 4.3 4.8 4.3 7.3a4.3 4.3 0 0 1-8.6 0c0-1.4.6-2.6 1.5-3.6.3 1.4 1.1 2.2 2 2.4-.4-2.2.1-4.1.8-6.1z"/>' },
  mochi: { ink: '#D97757', sign: '<path d="m12 6.3 1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"/>' },
}
/** Each tier's rim: bronze, silver, gold, and a colour no metal has. */
const TIER_RIM: Record<Tier, string> = { easy: '#C9875A', medium: '#C9D1D9', hard: '#F2C14E', impossible: 'url(#rim)' }

/** A milestone's medal: its theme's colour and sign, rimmed by its tier; faded and grey until it is done. */
function medalSvg(f: Feat): string {
  const look = CAT_LOOK[f.cat]
  const rim = f.tier === 'impossible' ? '<defs><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F07CB8"/><stop offset=".5" stop-color="#B794F6"/><stop offset="1" stop-color="#5FB3F0"/></linearGradient></defs>' : ''
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${rim}<g${f.done ? '' : ' opacity=".38" style="filter:grayscale(1)"'}><circle cx="12" cy="12" r="11" fill="${TIER_RIM[f.tier]}"/><circle cx="12" cy="12" r="9.2" fill="${look.ink}"/><g fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${look.sign}</g></g></svg>`
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
      card.append(svgIn('pic', f.badge ? badgeSvg(f.badge, f.done) : medalSvg(f)), text, el('em', `tag ${f.tier}`, w.tiers[f.tier]))
      grid.append(card)
    }
    section.append(head, grid)
    into.append(section)
  }
}

function drawCity(into: HTMLElement) {
  if (!history) return
  const now = Date.now()
  const city = svgIn('city', stillOf(citySvg(history.days, dayKey(now, tz()), local(now, tz()).hour, 560).svg))
  city.style.display = 'block'
  into.append(city)
}

function show(name: Tab) {
  tab = name
  localStorage.setItem('roomTab', name)
  draw()
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
  panel.replaceChildren()
  if (tab === 'wardrobe') drawWardrobe(panel)
  else if (tab === 'feats') drawFeats(panel)
  else drawCity(panel)
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
  prefs = { at: Date.now(), pick: chosen(prefs?.pick ?? modLook?.pick ?? {}, slot, item) }
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

/** Everything read again: the room is opened often, and other Mochis count and choose too. */
async function read() {
  const now = Date.now()
  history = historyOf(await invoke<string[]>('read_all_days').catch(() => []), dayKey(now, tz()))
  modLook = lookFrom(parse(await invoke<string | null>('read_look').catch(() => null)))
  prefs = choiceFrom(await invoke<string | null>('read_shared', { name: 'prefs.json' }).catch(() => null))
  const kept = badgesOf(parse(await invoke<string | null>('read_shared', { name: 'badges.json' }).catch(() => null))) ?? []
  badges = [...new Set([...kept, ...provenBy(history)])]
  look = lookNow(history, modLook, prefs, tz())
  drawMochi()
  drawPlate()
  draw()
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
