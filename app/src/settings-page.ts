import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'

import { LANGS, type Lang, lang as langNow, pickLang, setLang } from '../../hooks/i18n'
import { BREAK_MINUTES } from './breaks'
import { CHANGED, IDLE_MINUTES, JOBS, KEY, LEAVE_SECONDS, SIZES, type Settings, type Size, TALK_SECONDS, loadSettings } from './settings'
import { words } from './words'

/** Each language by its own name, as a person looks for it. */
const NATIVE: Record<Lang, string> = {
  en: 'English', tr: 'Türkçe', es: 'Español', de: 'Deutsch', fr: 'Français', pt: 'Português', ru: 'Русский', zh: '中文',
  ja: '日本語', ko: '한국어', it: 'Italiano', pl: 'Polski', uk: 'Українська', hi: 'हिन्दी', id: 'Bahasa Indonesia', ar: 'العربية',
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
let settings = loadSettings()
/** Told when the language changes, for the room around the settings to speak it too. */
let onLang = () => {}

/** Keeps the settings and tells Mochi's window at once. */
async function save(change: Partial<Settings>) {
  settings = { ...settings, ...change }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Not kept for the next start; Mochi still hears it now.
  }
  await emit(CHANGED, settings)
  if (change.lang !== undefined) {
    draw()
    onLang()
  }
}

/** A segmented choice: one button per value, the chosen one pressed. */
function segment<T extends string | number>(id: string, values: readonly T[], label: (v: T) => string, chosen: T, pick: (v: T) => void) {
  const box = $(id)
  box.replaceChildren(...values.map(v => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label(v)
    b.setAttribute('aria-pressed', String(v === chosen))
    b.addEventListener('click', () => {
      for (const other of box.children) other.setAttribute('aria-pressed', String(other === b))
      pick(v)
    })
    return b
  }))
}

function switchOf(id: string, on: boolean, change: (on: boolean) => void) {
  const input = $<HTMLInputElement>(id)
  input.checked = on
  input.onchange = () => change(input.checked)
}

const AGENTS = ['claude', 'codex'] as const

/** One agent's row: whether its hooks tell Mochi, and the button that connects or disconnects them. */
async function drawAgent(agent: (typeof AGENTS)[number]) {
  const w = words()
  const state = await invoke<string>('agent_state', { agent }).catch(() => 'broken')
  $(`${agent}State`).textContent = state === 'on' ? w.agentOn[agent] : state === 'off' ? w.agentOff : w.agentBroken
  const button = $<HTMLButtonElement>(agent)
  button.textContent = state === 'on' ? w.disconnect : w.connect
  button.disabled = state === 'broken'
  button.onclick = async () => {
    button.disabled = true
    await invoke('set_agent', { agent, on: state !== 'on' }).catch(() => undefined)
    await drawAgent(agent)
  }
}

/** Whether Mochi is Claude Code's status line, where the limits come from without the mod. */
async function drawLine() {
  const w = words()
  const state = await invoke<string>('line_state').catch(() => 'broken')
  $('lineState').textContent = state === 'on' ? w.lineOn : state === 'off' ? w.lineOff : w.agentBroken
  const button = $<HTMLButtonElement>('line')
  button.textContent = state === 'on' ? w.disconnect : w.connect
  button.disabled = state === 'broken'
  button.onclick = async () => {
    button.disabled = true
    await invoke('set_line', { on: state !== 'on' }).catch(() => undefined)
    await drawLine()
  }
}

function draw() {
  setLang(settings.lang === 'auto' ? (pickLang(navigator.language) ?? 'en') : settings.lang)
  document.documentElement.lang = langNow()
  document.documentElement.dir = langNow() === 'ar' ? 'rtl' : 'ltr'
  const w = words()
  const text: Record<string, string> = {
    'h-look': w.look, 'l-size': w.size, 'l-onTop': w.onTop, 'l-showAgents': w.showAgents, 'l-jobs': w.jobs, 'l-idle': w.hideIdle, 'l-leave': w.leaveIdle,
    'l-breakMinutes': w.breaks.setting, 'h-talk': w.talking, 'l-talk-asking': w.talkAsking, 'l-talk-done': w.talkDone, 'l-talk-failed': w.talkFailed, 'l-talk-limit': w.talkLimit, 'l-talkSeconds': w.talkSeconds, 'l-sound': w.sound, 'l-approve': w.approve, 'approveHint': w.approveHint, 'l-shield': w.shield, 'shieldHint': w.shieldHint,
    'h-language': w.language, 'l-lang': w.language, 'h-agents': w.agentsFrom, 'l-claude': w.agentName.claude, 'l-codex': w.agentName.codex, 'l-line': w.line,
    'h-startup': w.startup, 'l-atLogin': w.atLogin, 'l-place': w.place, resetPlace: w.resetPlace,
  }
  for (const [id, value] of Object.entries(text)) $(id).textContent = value

  segment('size', Object.keys(SIZES) as Size[], v => w.sizes[v], settings.size, v => void save({ size: v }))
  switchOf('onTop', settings.onTop, on => void save({ onTop: on }))
  switchOf('showAgents', settings.showAgents, on => void save({ showAgents: on }))
  segment('jobs', JOBS, v => w.jobLevels[v], settings.jobs, v => void save({ jobs: v }))
  segment('idleMinutes', IDLE_MINUTES, w.minutes, settings.idleMinutes, v => void save({ idleMinutes: v }))
  segment('breakMinutes', BREAK_MINUTES, w.minutes, settings.breakMinutes, v => void save({ breakMinutes: v }))
  segment('leaveSeconds', LEAVE_SECONDS, n => (n === 0 ? w.minutes(0) : n < 60 ? w.seconds(n) : w.minutes(n / 60)), settings.leaveSeconds, v => void save({ leaveSeconds: v }))
  for (const kind of ['asking', 'done', 'failed', 'limit'] as const) switchOf(`talk-${kind}`, settings.talk[kind], on => void save({ talk: { ...settings.talk, [kind]: on } }))
  segment('talkSeconds', TALK_SECONDS, w.seconds, settings.talkSeconds, v => void save({ talkSeconds: v }))
  switchOf('sound', settings.sound, on => void save({ sound: on }))
  switchOf('approve', settings.approve, on => void save({ approve: on }))
  switchOf('shield', settings.shield, on => void save({ shield: on }))

  const lang = $<HTMLSelectElement>('lang')
  lang.replaceChildren(new Option(w.sameAsSystem, 'auto'), ...LANGS.map(l => new Option(NATIVE[l], l)))
  lang.value = settings.lang
  lang.onchange = () => void save({ lang: lang.value as Settings['lang'] })

  $('resetPlace').onclick = () => void emit('reset-place')
  for (const agent of AGENTS) void drawAgent(agent)
  void drawLine()
}

/** The settings, in Mochi's room: drawn into its Settings tab, whose markup is room.html's. */
export async function startSettings(languageChanged: () => void) {
  onLang = languageChanged
  draw()
  const version = await getVersion().catch(() => '')
  $('version').textContent = version ? words().version(version) : ''
  const atLogin = await isEnabled().catch(() => false)
  switchOf('atLogin', atLogin, async on => {
    await (on ? enable() : disable()).catch(() => undefined)
    $<HTMLInputElement>('atLogin').checked = await isEnabled().catch(() => on)
  })
}
