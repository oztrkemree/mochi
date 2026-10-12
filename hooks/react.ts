import type { Mood } from '../types'
import { age, baseName } from './facts'
import { danger, isShell } from './guard'
import { t } from './i18n'
import { clip } from './text'

/** What the mascot does in answer to something: a mood, a short status, how long it holds. */
export type Reaction = { mood: Mood; line: string; holdMs: number; sound?: SoundName }

export type SoundName = 'ding' | 'oops' | 'party' | 'alarm'

const short = (text: string, max = 40): string => clip(text.replace(/\s+/g, ' ').trim(), max)

const base = (path: unknown): string => (typeof path === 'string' ? baseName(path) : t().word.file)

const host = (url: unknown): string => {
  if (typeof url !== 'string') return 'web'
  const m = /^[a-z]+:\/\/(?:[^/@]*@)?([^/]+)/i.exec(url)
  return m?.[1] ?? short(url, 30)
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Claude Code's own name for the mode where a workflow's agents do the work: kept as it is in every language. */
export const ULTRA = 'ultracode'

/** 75 → "1m 15s", 9 → "9s", 4000 → "1h 6m", in the language's units. */
export const duration = (seconds: number): string => {
  const u = t().unit
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return u(s, 's')
  const m = Math.floor(s / 60)
  if (m >= 60) return m % 60 === 0 ? u(Math.floor(m / 60), 'h') : `${u(Math.floor(m / 60), 'h')} ${u(m % 60, 'm')}`
  return s % 60 === 0 ? u(m, 'm') : `${u(m, 'm')} ${u(s % 60, 's')}`
}

// ---------- reading tool calls ----------

type Args = Record<string, unknown> & { tool: string }

export const isScary = (cmd: string): boolean => danger(cmd) !== null

export const isTest = (cmd: string): boolean =>
  /(^|[\s;&|])(npm|yarn|pnpm|bun)\s+(run\s+)?test\b|\b(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test|cargo\s+test|xcodebuild\s+.*\btest\b|swift\s+test|gradlew?\s+test|dotnet\s+test|claude\s+plugin\s+test/i.test(cmd)

export const isCommit = (cmd: string): boolean => /git\s+commit\b/i.test(cmd)
export const isPush = (cmd: string): boolean => /git\s+push\b/i.test(cmd)

/** Tools that wait on the person rather than run. */
export const waitsOnPerson = (tool: string): boolean => tool === 'AskUserQuestion' || tool === 'ExitPlanMode'

/** What the call is, in a few words: `npm test`, `app.ts`, `github.com`. */
export function subject(e: Args): string {
  switch (e.tool) {
    case 'Bash':
    case 'PowerShell': return short(str(e.command), 36)
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
    case 'Write': return base(e.file_path)
    case 'NotebookEdit': return base(e.notebook_path)
    case 'Grep':
    case 'Glob': return `'${short(str(e.pattern) || '...', 28)}'`
    case 'WebFetch': return host(e.url)
    case 'WebSearch': return `'${short(str(e.query), 28)}'`
    case 'Agent':
    case 'Task': return short(str(e.description) || str(e.subagent_type) || t().word.agent, 30)
    case 'Skill': return short(str(e.skill), 28)
    case 'ToolSearch': return `'${short(str(e.query), 28)}'`
    // A saved workflow's name, or the `name` of an inline script's `meta`.
    // A re-run by `scriptPath` has the file's name, which the harness gives as `<name>-wf_<run>.js`.
    case 'Workflow': return short(str(e.name) || /\bname:\s*['"`]([^'"`]+)['"`]/.exec(str(e.script))?.[1]
      || baseName(str(e.scriptPath)).replace(/(-wf_[\w-]+)?\.[cm]?[jt]s$/, '') || 'workflow', 30)
  }
  if (e.tool.startsWith('mcp__')) {
    const [, server = '', name = ''] = e.tool.split('__')
    return short(`${server.replace(/^plugin_[^_]*_/, '').replace(/^[0-9a-f-]{36}$/, 'mcp')} ${name}`, 32)
  }
  return e.tool
}

/** The mascot's face while a tool runs. */
export function beforeTool(e: Args): Reaction {
  const tool = e.tool
  const s = subject(e)
  const w = t().st
  const at = (mood: Mood, verb: string): Reaction => ({ mood, line: `${verb} · ${s}`, holdMs: 0 })
  switch (tool) {
    case 'Read': return at('reading', w.reading)
    case 'Grep':
    case 'Glob':
    case 'LS':
    case 'ToolSearch': return at('searching', w.searching)
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit': return at('writing', w.editing)
    case 'Write': return at('writing', w.creating)
    case 'Bash':
    case 'PowerShell': {
      const c = str(e.command)
      if (isScary(c)) return { mood: 'scared', line: `${w.careful} · ${s}`, holdMs: 0, sound: 'alarm' }
      if (isTest(c)) return { mood: 'nervous', line: `${w.test} · ${s}`, holdMs: 0 }
      return at('running', w.running)
    }
    case 'WebFetch': return at('web', w.opening)
    case 'WebSearch': return at('web', w.searching)
    case 'Agent':
    case 'Task': return at('agent', w.agent)
    case 'Workflow': return at('agent', ULTRA)
    case 'AskUserQuestion': return { mood: 'asking', line: w.waitingAnswer, holdMs: 0 }
    case 'ExitPlanMode': return { mood: 'asking', line: w.waitingPlan, holdMs: 0 }
    case 'EnterPlanMode': return { mood: 'thinking', line: w.planning, holdMs: 0 }
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate': return { mood: 'writing', line: w.todo, holdMs: 0 }
    case 'Skill': return at('reading', w.reading)
    case 'Artifact': return { mood: 'writing', line: w.publishing, holdMs: 0 }
  }
  if (/Claude_Browser|claude-in-chrome/i.test(tool)) return { mood: 'web', line: w.browsing, holdMs: 0 }
  if (tool.startsWith('mcp__')) return { mood: 'web', line: s, holdMs: 0 }
  return { mood: 'thinking', line: s, holdMs: 0 }
}

export type Outcome = { deny?: string; isError?: true; text?: string }

const REFUSED = /doesn't want to proceed|user (rejected|denied|declined)|permission.*denied|was rejected/i

/**
 * The mascot's answer once a tool has run, or null to keep the face it had.
 * `errorRun` counts failures in a row, this one included.
 */
export function afterTool(e: Args, out: Outcome, errorRun: number, seconds: number): Reaction | null {
  const c = isShell(e.tool) ? str(e.command) : ''
  const s = subject(e)
  const w = t().st
  if (out.deny !== undefined || (out.isError && REFUSED.test(out.text ?? ''))) {
    return { mood: 'denied', line: `${w.denied} · ${s}`, holdMs: 5000 }
  }
  if (out.isError) {
    if (isTest(c)) return { mood: 'error', line: w.testsFailed, holdMs: 8000, sound: 'oops' }
    if (errorRun >= 3) return { mood: 'dizzy', line: `${w.errorsInRow(errorRun)} · ${s}`, holdMs: 7000, sound: 'oops' }
    return { mood: 'error', line: `${w.error} · ${s}`, holdMs: 5000, sound: 'oops' }
  }
  if (isTest(c)) return { mood: 'party', line: `${w.testsPassed} · ${duration(seconds)}`, holdMs: 7000, sound: 'party' }
  if (isCommit(c)) return { mood: 'proud', line: w.committed, holdMs: 6000, sound: 'ding' }
  if (isPush(c)) return { mood: 'party', line: w.pushed, holdMs: 6000, sound: 'party' }
  return null
}

// ---------- reading prompts ----------

/** A brief reaction to what the person sent, before the model's own work takes over. */
export function onPrompt(text: string, wasAsleep: boolean): Reaction {
  const said = text.trim()
  const low = said.toLocaleLowerCase()
  const thinking = t().st.thinking
  if (wasAsleep) return { mood: 'shocked', line: t().st.wokeUp, holdMs: 1500 }
  // The keyword that sends the work to a workflow's agents: Mochi is ready before the first one starts.
  if (/\bultra[ -]?code\b/.test(low)) return { mood: 'agent', line: ULTRA, holdMs: 0 }
  // Thanks and praise, in the languages Mochi speaks.
  if (/te[sş]ekk[uü]r|sa[gğ]ol|eyvallah|\beyv\b|thanks|thank you|\bthx\b|\btsk\b|harika|s[uü]per|m[uü]kemmel|aferin|bravo|helal|efsane|perfect|awesome|great job|gracias|danke|merci|obrigad|grazie|dzi[eę]kuj[eę]|dzi[eę]ki|terima kasih|makasih|спасибо|дякую|谢谢|ありがとう|감사|고마워|धन्यवाद|शुक्रिया|شكر/.test(low)) {
    return { mood: 'pleased', line: thinking, holdMs: 2500 }
  }
  const letters = said.replace(/[^\p{L}]/gu, '')
  const upper = letters.replace(/[^\p{Lu}]/gu, '')
  if (letters.length >= 8 && upper.length / letters.length > 0.7) return { mood: 'shocked', line: thinking, holdMs: 2000 }
  // Frustration: it still does not work, why, again.
  if (/[cç]al[ıi][sş]m[ıi]yor|bozuk|olmad[ıi]|olmam[ıi][sş]|\bneden\b|\bniye\b|\bwtf\b|\byine\b|(^|\s)h[aâ]l[aâ](\s|$|[.,!?])|sa[cç]ma|yanl[ıi][sş]|\baq\b|\?\?|doesn'?t work|not working|\bbroken\b|\bstill\b|\bwhy\b|\bagain\b|no funciona|funktioniert nicht|ne marche pas|não funciona|non funziona|nie dzia[lł]a|tidak berfungsi|не работает|не працює|不行|动不了|動かない|안 돼|안돼|काम नहीं कर|لا يعمل/.test(low)) {
    return { mood: 'nervous', line: thinking, holdMs: 2500 }
  }
  return { mood: 'thinking', line: thinking, holdMs: 0 }
}

// ---------- ultracode, and background agents ----------

/** The parts that are there, joined: background agents' lines have no `ultracode` in front. */
const parts = (...xs: string[]) => xs.filter(x => x !== '').join(' · ')

/** While a workflow's agents (or background ones, `head` '') run: how many of those started have finished, and how many work now. */
export const flowLine = (running: number, total: number, head = ULTRA): string => parts(head, `${total - running}/${total}`, t().st.agents(running))

/** Once they have all finished: how many there were and how long it took; a run none of whose agents answered was stopped, not done. */
export function flowEnd(agents: number, answered: number, seconds: number, head = ULTRA): Reaction {
  const w = t().st
  if (answered === 0) return { mood: 'shocked', line: parts(head, w.stopped), holdMs: 6000 }
  return { mood: 'party', line: parts(head, w.done, w.agents(agents), duration(seconds)), holdMs: 12_000, sound: 'party' }
}

// ---------- the end of a turn ----------

export type TurnSummary = { reason: string; seconds: number; tools: number; edits: number; errors: number }

export function onTurnEnd(s: TurnSummary): Reaction {
  const w = t().st
  if (s.reason === 'aborted') return { mood: 'shocked', line: w.stopped, holdMs: 5000 }
  if (s.reason === 'error') return { mood: 'error', line: w.apiError, holdMs: 8000, sound: 'oops' }
  if (s.reason === 'refusal') return { mood: 'denied', line: w.refused, holdMs: 8000 }
  const parts = [`${w.done} · ${duration(s.seconds)}`]
  if (s.tools > 0) parts.push(w.tools(s.tools))
  if (s.edits > 0) parts.push(w.edits(s.edits))
  const line = parts.join(' · ')
  if (s.seconds > 180 || s.tools > 25) return { mood: 'tired', line, holdMs: 12000, sound: 'ding' }
  if (s.edits > 0 && s.errors === 0) return { mood: 'proud', line, holdMs: 10000, sound: 'ding' }
  return { mood: 'success', line, holdMs: 8000, sound: 'ding' }
}

/** The status shown once nothing is happening. */
export function restLine(mood: Mood, quietMs: number): string {
  const w = t().st
  if (mood === 'sleeping' || mood === 'sleepy') return w.idle(age(quietMs) || duration(quietMs / 1000))
  if (mood === 'listening') return w.listening
  if (mood === 'thinking') return w.thinking
  return w.ready
}
