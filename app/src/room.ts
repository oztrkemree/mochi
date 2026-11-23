import { invoke } from '@tauri-apps/api/core'

import type { Badge, History, Item, Outfit } from '../../types'
import { BADGES, badgeHint, badgeName, badgeSvg, badgesOf, provenBy } from '../../hooks/badges'
import { citySvg } from '../../hooks/city'
import { dayKey, local } from '../../hooks/facts'
import { lang, pickLang, setLang, t } from '../../hooks/i18n'
import { type Choice, type Look, type Slot, SLOT_ITEMS, choiceFrom, choiceText, dressAs, hintFor, itemName, itemShort, lookFrom, slotName } from '../../hooks/level'
import { itemIcon, svgFor } from '../../hooks/rig'
import { bestOutfit, cardSvg } from '../../hooks/share'
import { growthOf, historyOf } from './growth'
import { loadSettings } from './settings'
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
let tab: 'wardrobe' | 'badges' | 'city' = 'wardrobe'
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
  const won = $('won')
  won.replaceChildren(...badges.map(b => {
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
  for (const [name, label, count] of [['wardrobe', t().ui.wardrobe, `${open}/${all}`], ['badges', t().pane.names.badges, `${badges.length}/${BADGES.length}`], ['city', t().pane.city, '']] as const) {
    const b = el('button', '', label)
    b.type = 'button'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', String(tab === name))
    if (count) b.append(el('small', '', count))
    b.addEventListener('click', () => {
      tab = name
      draw()
    })
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

function drawBadges(into: HTMLElement) {
  const list = el('div', 'medals')
  for (const b of [...BADGES.filter(x => badges.includes(x)), ...BADGES.filter(x => !badges.includes(x))]) {
    const isWon = badges.includes(b)
    const row = el('div', isWon ? 'medal won' : 'medal')
    const text = el('div')
    text.append(el('b', '', badgeName(b)), el('span', '', badgeHint(b)))
    row.append(svgIn('pic', badgeSvg(b, isWon)), text)
    list.append(row)
  }
  into.append(list)
}

function drawCity(into: HTMLElement) {
  if (!history) return
  const now = Date.now()
  const city = svgIn('city', stillOf(citySvg(history.days, dayKey(now, tz()), local(now, tz()).hour, 560).svg))
  city.style.display = 'block'
  into.append(city)
}

function draw() {
  drawTabs()
  const panel = $('panel')
  panel.replaceChildren()
  if (tab === 'wardrobe') drawWardrobe(panel)
  else if (tab === 'badges') drawBadges(panel)
  else drawCity(panel)
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
  const card = $('card')
  card.innerHTML = CARD
  card.append(words().card)
  card.addEventListener('click', () => void (async () => {
    const path = await invoke<string | null>('save_share', { name: 'mochi-card.svg', svg: cardSvg(history, outfit()) })
    $('said').textContent = path === null ? t().share.failed('~/.claude/mochi/share') : t().share.cardSaved(path)
  })())
  void read()
  addEventListener('focus', () => void read())
}
start()
