import { baseName } from './facts'
import type { Danger, Rule } from './guard'
import { isOff, rulesNow, sayKey } from './guard'
import { t } from './i18n'
import type { Dict } from './i18n'

// The shield's judgement beyond its list of commands: the person's own rules,
// how risky a force push is by the branch it rewrites, what they always allow
// in a repository, and secrets about to be written or put into git.

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

// ---------- the person's own rules ----------

/**
 * Reads ~/.claude/mochi/shield.json, which may hold:
 *
 *   {
 *     "add": [{ "match": "terraform apply", "says": "changes the live infrastructure" }],
 *     "off": ["publish", "sudo"]
 *   }
 *
 * `match` is a regular expression tried on every shell command, case ignored;
 * `says` what such a command would do (optional). `off` names built-in kinds
 * not to ask about: the keys of `danger` in lang/en.ts, and `secret` (or one
 * kind of it, `secret:aws`), `secretFile` and `secretEdit`. What cannot be
 * used (a pattern that does not compile, the file not being JSON) is in `bad`.
 */
export function parseRules(text: string): { mine: Rule[]; off: string[]; bad: string[] } {
  if (text.trim() === '') return { mine: [], off: [], bad: [] }
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    return { mine: [], off: [], bad: ['JSON'] }
  }
  const { add, off } = (typeof file === 'object' && file !== null ? file : {}) as { add?: unknown; off?: unknown }
  const mine: Rule[] = []
  const bad: string[] = []
  for (const entry of Array.isArray(add) ? add : []) {
    const { match, says } = (typeof entry === 'object' && entry !== null ? entry : {}) as { match?: unknown; says?: unknown }
    try {
      if (typeof match !== 'string' || match === '') throw new Error('no match')
      mine.push({ key: `mine:${match}`, re: new RegExp(match, 'i'), says: str(says).trim() })
    } catch {
      bad.push(typeof match === 'string' ? match : JSON.stringify(entry ?? null).slice(0, 60))
    }
  }
  return { mine, off: Array.isArray(off) ? off.filter((k): k is string => typeof k === 'string') : [], bad }
}

// ---------- the branch a force push rewrites ----------

/** Branches that are some repository's default, besides the one the remote names. */
const DEFAULTS = ['main', 'master', 'trunk', 'develop']

/** Options of `git push` that take the next word as their value. */
const VALUED = ['-o', '--push-option', '--repo', '--receive-pack', '--exec']

/** The words after `git <sub>` in each part of a command line, quotes taken off and git's own options skipped. */
function gitCalls(cmd: string, sub: string): string[][] {
  const calls: string[][] = []
  for (const part of cmd.split(/&&|\|\||[;|\n]/)) {
    const w = part.trim().split(/\s+/).map(x => x.replace(/^["']+|["']+$/g, ''))
    let i = w.findIndex(x => /^git(\.exe)?$/i.test(x)) + 1
    if (i === 0) continue
    while ((w[i] ?? '').startsWith('-')) i += w[i] === '-C' || w[i] === '-c' ? 2 : 1
    if (w[i] === sub) calls.push(w.slice(i + 1))
  }
  return calls
}

/** Where one refspec of a push lands: `+main` and `HEAD:main` on main, `HEAD` (or `@`) on the branch checked out. */
function landsOn(ref: string, current: string): string {
  const name = (ref.replace(/^\+/, '').split(':').pop() ?? '').replace(/^refs\/heads\//, '')
  return name === 'HEAD' || name === '@' ? current : name
}

/**
 * How risky the force pushes in a command are: `loud` when one rewrites a
 * default branch (named), `calm` when each keeps a lease on a branch that is
 * none, `ask` otherwise, and whenever unsure. `current` is the branch checked
 * out, `head` the one the remote names as its default ('' when unknown).
 */
export function pushRisk(cmd: string, current: string, head: string): { risk: 'loud' | 'calm' | 'ask'; branch: string } {
  const defaults = head === '' ? DEFAULTS : [...DEFAULTS, head]
  // After a change of folder, or with git pointed elsewhere, the branch checked out may be another repository's.
  const isElsewhere = /(^|[\s;&|(])(cd|pushd|chdir|set-location|sl|push-location)\s/i.test(cmd) || /\s(-C|--git-dir|--work-tree)[\s=]/.test(cmd)
  const here = isElsewhere || current === 'HEAD' ? '' : current
  let risk: 'calm' | 'ask' | null = null
  for (const rest of gitCalls(cmd, 'push')) {
    const flags = rest.filter(w => w.startsWith('-'))
    const refs = rest.filter((w, i) => !w.startsWith('-') && !VALUED.includes(rest[i - 1] ?? '')).slice(1)
    const isLease = flags.some(f => f.startsWith('--force-with-lease'))
    const isForce = flags.some(f => f === '--force' || /^-[a-zA-Z]*f/.test(f)) || refs.some(r => r.startsWith('+'))
    if (!isLease && !isForce) continue
    if (flags.some(f => /^--(all|mirror|branches)$/.test(f))) return { risk: 'loud', branch: head || 'main' }
    const lands = refs.length === 0 ? [here] : refs.map(r => landsOn(r, here))
    const hit = lands.find(b => defaults.includes(b))
    if (hit !== undefined) return { risk: 'loud', branch: hit }
    risk = isForce || lands.includes('') || risk === 'ask' ? 'ask' : 'calm'
  }
  return { risk: risk ?? 'ask', branch: '' }
}

/**
 * The dangers found, weighed by the branch a force push rewrites: onto a
 * default branch it asks loudly, under a key of its own (allowing force pushes
 * elsewhere never allows this one); leased onto another branch it does not ask.
 */
export function weigh(found: Danger[], cmd: string, current: string, head: string): Danger[] {
  if (!found.some(x => x.key === 'forcePush')) return found
  const { risk, branch } = pushRisk(cmd, current, head)
  const rest = found.filter(x => x.key !== 'forcePush')
  if (risk === 'calm') return rest
  return risk === 'ask' ? found : [{ key: `forcePush:${branch}`, detail: '' }, ...rest]
}

// ---------- always allowed here ----------

/** What is always allowed, by repository, as the store keeps it; anything malformed is left out. */
export function allowedOf(saved: unknown): Record<string, string[]> {
  const all: Record<string, string[]> = {}
  if (typeof saved !== 'object' || saved === null) return all
  for (const [root, keys] of Object.entries(saved)) if (Array.isArray(keys)) all[root] = keys.filter((k): k is string => typeof k === 'string')
  return all
}

/** The list with these kinds allowed in this repository too. */
export const allow = (all: Record<string, string[]>, root: string, keys: string[]): Record<string, string[]> =>
  ({ ...all, [root]: [...new Set([...(all[root] ?? []), ...keys])] })

/** A repository's folder as a key: one separator, no trailing one, the drive in capitals, so git's spelling and the session's meet. */
export const repoKey = (path: string): string => path.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^[a-z]:/, d => d.toUpperCase())

/** What /mochi shield says beside on or off: what is always allowed where, and the person's own rules. */
export function shieldLines(all: Record<string, string[]>, d: Dict = t()): string[] {
  const lines = Object.entries(all).filter(([, keys]) => keys.length > 0).map(([root, keys]) => d.guard.allowedIn(root, keys.map(k => sayKey(k, d)).join(' · ')))
  if (lines.length > 0) lines.push(d.guard.forget)
  const { mine, off } = rulesNow()
  if (mine.length + off.length > 0) lines.push(d.guard.rules(mine.length, off.length))
  return lines
}

// ---------- secrets ----------

type SecretKind = keyof Dict['guard']['kind']

/** Secrets known by their shape. A private key counts with its body only, so code that looks for the header is no key. */
const SHAPES: [RegExp, SecretKind][] = [
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY[A-Z ]*-----(?:\s|\\[rn])*(?:Proc-Type:|[A-Za-z0-9+/]{40})/g, 'privateKey'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, 'aws'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g, 'github'],
  [/\bsk-(?:(?:ant|proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})/g, 'apiKey'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, 'slack'],
  [/\b[rs]k_live_[A-Za-z0-9]{20,}/g, 'stripe'],
]

/** A name that holds a secret, as the end of a longer one: API_KEY, clientSecret, db_password, SECRET_KEY_BASE. */
const NAME = String.raw`[\w.-]*(?:api[_-]?key|secret|token|passw(?:or)?d|access[_-]?key|auth[_-]?key|private[_-]?key)(?:[_-]?(?:base|value|key))*`

/**
 * Such a name given a quoted value, in code or config; or a bare one on a line
 * of its own, as .env, shells and YAML write it (no brackets or commas: that is code).
 */
const QUOTED = new RegExp(String.raw`\b(?<name>${NAME})["']?\s*[:=]\s*(?<q>["'\x60])(?<value>[^"'\x60\s]{16,200})\k<q>`, 'gi')
const BARE = new RegExp(String.raw`^\s*(?:export\s+)?(?<name>${NAME})\s*[:=]\s*(?<value>[^\s"'#(),;{}<>\[\]]{16,200})\s*$`, 'gim')

/** Values that are plainly no real secret: placeholders, templates, links and paths, the environment, examples, runs of one character. */
const FAKE = /x{4,}|\*{3,}|\.{3}|[<>]|\$\{|\{\{|:\/\/|^\.?\/|\benv\.|example|sample|dummy|fake|placeholder|your|changeme|change_me|redacted|replace|insert|todo|(.)\1{5,}|0123456|123456789|abcdefgh/i

/** Names rather than secrets: words in one case joined by dots, dashes or underscores (`reset_password_token_2`). */
const WORDS = /^[a-z]+(?:[._-][a-z0-9]+)+$|^[A-Z]+(?:[._-][A-Z0-9]+)+$/

/** Test folders and files, where a value that says it is made up is taken at its word. */
const TEST_PATH = /(^|[\\/])(tests?|__tests__|spec|fixtures?|__fixtures__|testdata|mocks?|__mocks__)[\\/]|\.(test|spec)\.[a-z]+$/i
const MADE_UP = /test|mock|fixture|stub|spec/i

/** Bits per character: random keys have many, words and placeholders few. */
function entropy(s: string): number {
  const n: Record<string, number> = {}
  for (const c of s) n[c] = (n[c] ?? 0) + 1
  return Object.values(n).reduce((e, k) => e - (k / s.length) * Math.log2(k / s.length), 0)
}

/** A value shown without giving it away: its first four characters and its last two. */
const mask = (v: string): string => (v.length < 12 ? '••••••' : `${v.slice(0, 4)}••••••${v.slice(-2)}`)

/** The secrets in a text: kind, value, and how to show it. `path` is the file it goes to. */
export function secretsIn(text: string, path = ''): { kind: SecretKind; value: string; shown: string }[] {
  const isTest = TEST_PATH.test(path)
  const isReal = (v: string, needsDigit: boolean) =>
    !FAKE.test(v) && (!needsDigit || /\d/.test(v)) && entropy(v) >= (isTest ? 3.5 : 3) && !(isTest && MADE_UP.test(v))
  const found: { kind: SecretKind; value: string; shown: string }[] = []
  for (const [re, kind] of SHAPES) {
    for (const m of text.matchAll(re)) {
      if (kind === 'privateKey' || isReal(m[0], kind === 'apiKey')) found.push({ kind, value: m[0], shown: kind === 'privateKey' ? '' : mask(m[0]) })
    }
  }
  for (const re of [QUOTED, BARE]) {
    for (const m of text.matchAll(re)) {
      const v = m.groups?.value ?? ''
      if (/[a-z]/i.test(v) && !WORDS.test(v) && isReal(v, true) && !found.some(f => v.includes(f.value) || f.value.includes(v))) {
        found.push({ kind: 'generic', value: v, shown: `${m.groups?.name ?? ''} ${mask(v)}` })
      }
    }
  }
  return found
}

/** Files that hold secrets by their name: .env (not its examples), SSH and TLS private keys, credentials. */
export function isSecretFile(path: string): boolean {
  const name = baseName(path).toLowerCase()
  return (/^\.env(\..+)?$/.test(name) && !/\.(example|sample|template|dist|defaults?|schema)$/.test(name))
    || /^(\.envrc|id_(rsa|dsa|ecdsa|ed25519)|credentials(\.(json|ya?ml|xml|csv))?|\.netrc|\.pgpass|\.pypirc|secrets?\.(json|ya?ml|toml))$/.test(name)
    || /\.(pem|key|p12|pfx|jks|keystore)$/.test(name)
}

/** Each kind once, those the person turned off left out. */
const kept = (list: Danger[]): Danger[] => list.filter((x, i) => !isOff(x.key) && list.findIndex(y => y.key === x.key) === i)

/**
 * What a Write, Edit or MultiEdit would add that looks secret; `before` is the
 * file as it stands, null when there is none. A file of secrets is where they
 * belong, so it is not searched; changing one that exists asks instead.
 */
export function editSecrets(args: Record<string, unknown> & { tool: string }, before: string | null): Danger[] {
  const path = str(args.file_path)
  if (isSecretFile(path)) return args.tool === 'Write' && before === null ? [] : kept([{ key: 'secretEdit', detail: '' }])
  const edits: Record<string, unknown>[] = args.tool === 'Write' ? [{ old_string: before ?? '', new_string: args.content }]
    : args.tool === 'Edit' ? [args]
    : Array.isArray(args.edits) ? (args.edits as Record<string, unknown>[]) : []
  return kept(edits.flatMap(e => secretsIn(str(e.new_string), path).filter(s => !str(e.old_string).includes(s.value)))
    .map(s => ({ key: `secret:${s.kind}`, detail: s.shown })))
}

/** The pathspecs a command's `git add` names (`.` for -A and -u alone); null when it adds nothing. */
export function gitAdds(cmd: string): string[] | null {
  const calls = gitCalls(cmd, 'add')
  if (calls.length === 0) return null
  return calls.flatMap(rest => {
    const specs = rest.filter(w => !w.startsWith('-'))
    return specs.length === 0 && rest.some(w => /^(-A|--all|-u|--update)$/.test(w)) ? ['.'] : specs
  })
}

/** The files a `git add` of these pathspecs takes, among those git lists as new or changed (from the same folder). */
export function addedFiles(specs: string[], listed: string[]): string[] {
  const takes = (spec: string, file: string) => {
    const s = spec.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
    return s === '' || s === '.' || s === ':/' || s === '*' || file === s || file.startsWith(`${s}/`)
  }
  return [...specs, ...listed.filter(f => specs.some(s => takes(s, f)))]
}

/** What a command's `git commit` would record: `staged`, or `all` when it adds first (-a, or a `git add` before it); null when it commits nothing. */
export function commitScan(cmd: string): 'staged' | 'all' | null {
  const calls = gitCalls(cmd, 'commit')
  if (calls.length === 0) return null
  const isAll = gitCalls(cmd, 'add').length > 0 || calls.some(rest => rest.some(w => w === '--all' || /^-[a-zA-Z]*a/.test(w)))
  return isAll ? 'all' : 'staged'
}

/** A unified diff read into the files it touches and the lines it adds to each; `+++` names a file only in a file's header. */
export function diffAdds(diff: string): { path: string; added: string }[] {
  const files: { path: string; added: string }[] = []
  let isHead = false
  for (const line of diff.split(/\r?\n/)) {
    const last = files[files.length - 1]
    if (line.startsWith('diff --git ')) isHead = true
    else if (isHead && line.startsWith('+++ ')) {
      files.push({ path: line.slice(4).replace(/^b\//, '').trim(), added: '' })
      isHead = false
    } else if (!isHead && line.startsWith('+') && last !== undefined) last.added += `${line.slice(1)}\n`
  }
  return files.filter(f => f.path !== '/dev/null')
}

/**
 * What a command would put into git that looks secret: a file of secrets
 * among `added` (what its `git add` takes) or `files`, and a secret the lines
 * of `files` add (its commit's diff, and new files it adds and commits at once).
 */
export function shellSecrets(added: string[], files: { path: string; added: string }[]): Danger[] {
  const file = [...added, ...files.map(f => f.path)].find(isSecretFile)
  const found: Danger[] = file === undefined ? [] : [{ key: 'secretFile', detail: baseName(file) }]
  for (const f of files) {
    if (!isSecretFile(f.path)) for (const s of secretsIn(f.added, f.path)) found.push({ key: `secret:${s.kind}`, detail: s.shown })
  }
  return kept(found)
}
