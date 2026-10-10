import type { Dict } from './i18n'
import { t } from './i18n'

// Two watches over the tool calls: the shield, which names what a command
// would destroy before it runs, and the loop watch, which notices the model
// trying the same thing again and again without getting anywhere.

/** The person's own rules: a command or an edit that writes them could turn the shield off unseen. */
export const RULES_FILE = /\.claude[\\/]+mochi[\\/]+shield\.json/i

/** Commands that cannot be undone, each with what it would do, in plain words. */
const DANGERS: [RegExp, keyof Dict['danger']][] = [
  [/:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/, 'forkBomb'],
  // rm's own short options only, so PowerShell's `rm x -Force` is not taken for -r; cloud storage's rm is a bucket's.
  [/(?<!\b(?:s3|gsutil(?:\s+-m)?|storage)\s+)\brm\s(?:[^|;&\n]*\s)?(-[dfiIv]*[rR][dfiIvrR]*|--recursive)(?=\s|$)/, 'rm'],
  [/(^|[\s;&|("'])(remove-item(property)?|ri|rp|rm|del)\b[^|;&\n]*\bhk(lm|cu|cr|u|cc):|\breg(\.exe)?\s+delete\b/i, 'registry'],
  // PowerShell's Remove-Item and its aliases with -Recurse or any prefix of it; cmd's del, rd and rmdir with /s.
  [/(^|[\s;&|("'])(?<!\b(?:s3|gsutil(?:\s+-m)?|storage)\s+)(remove-item|ri|rm|rmdir|rd|del|erase)\b[^|;&\n]*\s(-r(e(c(u(r(se?)?)?)?)?)?|\/s)(?=[\s:]|$)/i, 'rm'],
  [/\bfind\b[^|;&]*\s-delete\b/, 'findDelete'],
  [/\s-r(e(c(u(r(se?)?)?)?)?)?\b[^;&\n]*\|\s*(remove-item|ri|rm|del|erase)\b/i, 'findDelete'],
  [/\bgit\s+push\b[^|;&]*(\s--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s--force-with-lease\b|\s\+\S)/, 'forcePush'],
  [/\bgit\s+push\b[^|;&\n]*\s--mirror\b/, 'pushMirror'],
  [/\bgit\s+push\b[^|;&\n]*(\s--delete\b|\s-d\b|\s\+?:[^\s:]+)/, 'pushDelete'],
  [/\bgit\s+filter-(branch|repo)\b/, 'rewrite'],
  [/\bgit\s+reset\s+[^|;&]*--hard\b/, 'resetHard'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'clean'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'checkoutDot'],
  [/\bgit\s+branch\s+(-D|--delete\s+--force)\b/, 'branchDelete'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'stashDrop'],
  [/\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, 'dropTable'],
  [/\bdelete\s+from\s+\w+\s*(;|$|")/i, 'deleteAll'],
  [/\b(rails|rake)\s+db:(drop|reset|purge|migrate:reset)\b|\bprisma\s+(migrate\s+reset|db\s+push\b[^|;&\n]*--force-reset)\b|\bsupabase\s+db\s+reset\b|\bredis-cli\b[^|;&\n]*\bflush(all|db)\b|\bdropDatabase\s*\(|(^|[\s;&|(])dropdb\s|\bmanage\.py\s+(flush|reset_db)\b|\bheroku\s+pg:reset\b/i, 'dbWipe'],
  [/\bmkfs\b|\bdd\s+if=/, 'disk'],
  // cmd's format only at the start of a command, on a bare drive: `dotnet format C:\src` is no wipe.
  [/\b(format-volume|clear-disk|remove-partition)\b|(^|[;&|(\n])\s*format(\.com)?\s+[a-z]:(?=[\s/]|$)/i, 'wipe'],
  [/\b(stop-computer|restart-computer)\b|(^|[;&|(\n])\s*(sudo\s+)?(shutdown(\.exe)?|reboot|poweroff)\b/i, 'shutdown'],
  [/\bch(mod|own)\s+-R\b/, 'chmod'],
  [/\bkubectl\s+delete\s+(ns|namespaces?)\b/, 'namespace'],
  [/\bdocker\s+system\s+prune\b[^|;&\n]*\s(-[a-z]*a[a-z]*|--all)\b/, 'pruneAll'],
  [/\b(kubectl\s+delete\b(?!\s+(ns|namespaces?)\b)|(terraform|pulumi|cdk)\s+destroy|terraform\s+apply\b[^|;&\n]*\s-destroy|docker\s+(system\s+prune\b(?![^|;&\n]*\s(-[a-z]*a[a-z]*|--all)\b)|volume\s+(rm|prune)))\b/, 'infra'],
  [/\bhelm\s+(uninstall|delete|del)\b/, 'helm'],
  [/\baws\s+s3\s+(rm\b[^|;&\n]*\s--recursive|rb\b[^|;&\n]*\s--force|sync\b[^|;&\n]*\s--delete)\b|\bgsutil\s+(-m\s+)?rm\s+[^|;&\n]*-[a-z]*r|\bgcloud\s+storage\s+rm\b[^|;&\n]*\s(-r|--recursive)\b/i, 'bucket'],
  [/\baz\s+group\s+delete\b/i, 'azGroup'],
  [/\bgcloud\s[^|;&\n]*\s(delete|destroy)\b|\baws\s[^|;&\n]*\s(delete|terminate)-[a-z]|\baz\s+(?!group\s)[^|;&\n]*\sdelete\b|\bfirebase\s+(projects:delete|firestore:delete|database:remove|hosting:disable)\b/i, 'cloud'],
  [/\bfirebase\s+deploy\b/i, 'firebaseDeploy'],
  [/\bheroku\s+(apps:destroy|destroy)\b/i, 'heroku'],
  [/\bgh\s+repo\s+delete\b/, 'repoDelete'],
  [/\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b/, 'publish'],
  [/\b(npm|pnpm|yarn)\s+unpublish\b/, 'unpublish'],
  [/\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^;&\n]*\|\s*(sudo\s+)?((ba|z|da|k|fi)?sh|iex|invoke-expression)\b|\b(ba|z)?sh\s+(-c\s+)?["']?(\$\(|<\()\s*(curl|wget)\b|\b(iex|invoke-expression)\b[^;&\n]*\b(iwr|irm|invoke-webrequest|invoke-restmethod|downloadstring)\b/i, 'pipeShell'],
  [/(^|[\s;&|(])sudo\s/, 'sudo'],
  [RULES_FILE, 'shieldRules'],
]

/** The tools that run a shell command: Bash, and PowerShell on Windows. */
export const isShell = (tool: string): boolean => tool === 'Bash' || tool === 'PowerShell'

/** One of the person's own rules from shield.json (see shield.ts): a pattern, and what a command it matches would do. */
export type Rule = { key: string; re: RegExp; says: string }

/** A danger found in a call: its kind (a key of `danger`, or one of shield.ts's), and what to name beside its words. */
export type Danger = { key: string; detail: string }

let mine: Rule[] = []
let off: string[] = []

/** Puts the person's own rules in force, and the built-in kinds they turned off. */
export function setRules(rules: { mine: Rule[]; off: string[] }) {
  mine = rules.mine
  off = rules.off
}

/** The person's own rules and the kinds they turned off, as in force. */
export const rulesNow = () => ({ mine, off })

/** Whether the person turned a kind off: by its key, or by its family (`secret` for `secret:aws`). */
export const isOff = (key: string): boolean => off.includes(key) || off.includes(key.split(':')[0] ?? key)

/** Every kind of command that cannot be undone found in `cmd`: the person's own first, then the built-in ones left on. */
export function dangers(cmd: string): Danger[] {
  const keys = [...mine.filter(r => r.re.test(cmd)).map(r => r.key), ...DANGERS.filter(([re, key]) => !isOff(key) && re.test(cmd)).map(([, key]) => key)]
  return [...new Set(keys)].map(key => ({ key, detail: '' }))
}

/** What a kind of danger would do, in the given language. */
export function sayKey(key: string, d: Dict = t()): string {
  if (key.startsWith('mine:')) return mine.find(r => r.key === key)?.says || d.guard.yourRule
  if (key.startsWith('forcePush:')) return d.guard.forceDefault(key.slice('forcePush:'.length))
  if (key.startsWith('secret:')) return d.guard.secret((d.guard.kind as Record<string, string>)[key.slice('secret:'.length)] ?? d.guard.kind.generic)
  if (key === 'secretFile' || key === 'secretEdit') return d.guard[key]
  return (d.danger as Record<string, string>)[key] ?? key
}

/** A danger in words, with its detail: "adds what looks like a GitHub token · ghp_••••••7f". */
export const say = (x: Danger, d: Dict = t()): string => (x.detail === '' ? sayKey(x.key, d) : `${sayKey(x.key, d)} · ${x.detail}`)

/** What the command would do that cannot be undone, in the language in use, or null. */
export function danger(cmd: string): string | null {
  const first = dangers(cmd)[0]
  return first === undefined ? null : say(first)
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
    case 'Bash':
    case 'PowerShell': return `${args.tool}:${pick('command')}`
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
  /^(Monitor|BashOutput|TaskOutput|TaskGet|ScheduleWakeup)$/.test(args.tool) || (isShell(args.tool) && /\bsleep\b|\bwatch\b|--watch\b/i.test(str(args.command)))

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
