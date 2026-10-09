import type { Dict } from './i18n'
import { t } from './i18n'

// Two watches over the tool calls: the shield, which names what a command
// would destroy before it runs, and the loop watch, which notices the model
// trying the same thing again and again without getting anywhere.

/** Commands that cannot be undone, each with what it would do, in plain words. */
const DANGERS: [RegExp, keyof Dict['danger']][] = [
  [/:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/, 'forkBomb'],
  [/\brm\s+(-[a-z]*r[a-z]*\s+|-[a-z]*\s+-[a-z]*r[a-z]*\s+|--recursive\s+)/i, 'rm'],
  [/\bfind\b[^|;&]*\s-delete\b/, 'findDelete'],
  [/\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/, 'forcePush'],
  [/\bgit\s+reset\s+[^|;&]*--hard\b/, 'resetHard'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'clean'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'checkoutDot'],
  [/\bgit\s+branch\s+(-D|--delete\s+--force)\b/, 'branchDelete'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'stashDrop'],
  [/\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, 'dropTable'],
  [/\bdelete\s+from\s+\w+\s*(;|$|")/i, 'deleteAll'],
  [/\bmkfs\b|\bdd\s+if=/, 'disk'],
  [/\bch(mod|own)\s+-R\b/, 'chmod'],
  [/\b(kubectl\s+delete|terraform\s+destroy|docker\s+(system\s+prune|volume\s+(rm|prune)))\b/, 'infra'],
  [/\bgh\s+repo\s+delete\b/, 'repoDelete'],
  [/\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b/, 'publish'],
  [/(^|[\s;&|(])sudo\s/, 'sudo'],
]

/** Which kind of command that cannot be undone this is, or null. */
export function dangerKey(cmd: string): keyof Dict['danger'] | null {
  for (const [re, what] of DANGERS) if (re.test(cmd)) return what
  return null
}

/** What the command would do that cannot be undone, in the language in use, or null. */
export function danger(cmd: string): string | null {
  const key = dangerKey(cmd)
  return key === null ? null : t().danger[key]
}

// ---------- the loop watch ----------

const hash = (s: string): string => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v))

/** What makes two calls the same call: the tool and the inputs that matter. */
export function signature(args: Record<string, unknown> & { tool: string }): string {
  const pick = (...keys: string[]) => keys.map(k => str(args[k])).join('\u0000')
  switch (args.tool) {
    case 'Bash': return `Bash:${pick('command')}`
    case 'Read': return `Read:${pick('file_path', 'offset', 'limit')}`
    case 'Edit':
    case 'MultiEdit': return `${args.tool}:${hash(pick('file_path', 'old_string', 'new_string', 'edits'))}`
    case 'Write': return `Write:${pick('file_path')}:${hash(pick('content'))}`
    case 'Grep':
    case 'Glob': return `${args.tool}:${pick('pattern', 'path', 'glob', 'type')}`
    case 'WebFetch': return `WebFetch:${pick('url')}`
  }
  const { tool, ...rest } = args
  return `${tool}:${hash(JSON.stringify(rest))}`
}

/** An error or a result reduced to what stays the same between two tries: numbers and spacing gone. */
export function gist(text: string): string {
  return hash(text.slice(0, 600).toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim())
}

/** Calls whose result is expected to repeat while waiting on something. */
const isPolling = (args: Record<string, unknown> & { tool: string }): boolean =>
  /^(Monitor|BashOutput|TaskOutput|TaskGet|ScheduleWakeup)$/.test(args.tool) || (args.tool === 'Bash' && /\bsleep\b|\bwatch\b|--watch\b/.test(str(args.command)))

export type Watch = {
  /** Per call: how often this turn, failures in a row, the last result and how often it came back unchanged. */
  calls: Record<string, { fails: number; out: string; same: number }>
  /** Per error: how often this turn. */
  errors: Record<string, number>
  /** Alarms already raised this turn. */
  said: string[]
}

export const NEW_WATCH: Watch = { calls: {}, errors: {}, said: [] }

/**
 * Notes one finished call; returns the alarm to raise, if this call makes a loop:
 * the same call failing three times in a row, the same error three times from
 * any calls, or the same call bringing back the same result four times.
 */
export function watchCall(w: Watch, args: Record<string, unknown> & { tool: string }, isFail: boolean, text: string): { watch: Watch; alarm: string | null } {
  const sig = signature(args)
  const out = gist(text)
  const was = w.calls[sig]
  const fails = isFail ? (was?.fails ?? 0) + 1 : 0
  const same = was && was.out === out ? was.same + 1 : 1
  const errors = isFail && text.trim() !== '' ? { ...w.errors, [out]: (w.errors[out] ?? 0) + 1 } : w.errors
  const calls = { ...w.calls, [sig]: { fails, out, same } }

  let key: string | null = null
  let alarm: string | null = null
  if (fails >= 3) {
    key = `fail:${sig}`
    alarm = t().loopAlarm.sameFail(fails)
  } else if (isFail && (errors[out] ?? 0) >= 3) {
    key = `error:${out}`
    alarm = t().loopAlarm.sameError(errors[out] ?? 3)
  } else if (!isFail && same >= 4 && !isPolling(args)) {
    key = `same:${sig}`
    alarm = t().loopAlarm.sameResult(same)
  }
  if (key === null || w.said.includes(key)) return { watch: { ...w, calls, errors }, alarm: null }
  return { watch: { calls, errors, said: [...w.said, key] }, alarm }
}
