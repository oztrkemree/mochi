import type { Env, Mood } from '../types'
import { dayKey, warnLevel } from './facts'
import { isShell } from './guard'
import { t } from './i18n'
import { levelOf, xpOf } from './level'

// The coach: a tip now and then about Claude Code, a question when the person
// keeps giving the same instruction, the first-run tour and what is new. Every
// rule lives here; register.tsx only shows them.

const HOUR = 60 * 60_000

/** The tips, most useful first: when several wait, the first one shows. */
export const TIPS = ['rewind', 'permissions', 'compact', 'mcp', 'plan', 'commit', 'rings', 'wear'] as const
export type TipId = (typeof TIPS)[number]

/** Tips a situation called for, with when and what about (a program for `permissions`). */
export type Pending = Partial<Record<TipId, { at: number; arg: string }>>

/** What outlives the chat, in `coach.json`: the tips shown, and the instructions given per project. */
export type CoachLog = {
  /** Times each tip was shown, ever. */
  shown: Partial<Record<TipId, number>>
  /** When the last tip was shown, its local day and how many that day. */
  at: number
  day: string
  today: number
  /** Per project root, how often each instruction was given; -1 once added or declined for good. */
  rules: Record<string, Record<string, number>>
}

export const NO_LOG: CoachLog = { shown: {}, at: 0, day: '', today: 0, rules: {} }

/** A tip shows at most this often ever, this many a day, and while its situation is this recent. */
export const MAX_SHOWN = 2
const PER_DAY = 3
const FRESH_MS = 30 * 60_000

const isObject = (v: unknown): v is Record<string, never> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `coach.json` as written, completed; anything unreadable starts over. */
export function readLog(text: string): CoachLog {
  try {
    const v = JSON.parse(text) as Partial<CoachLog>
    return {
      shown: isObject(v.shown) ? v.shown : {},
      at: typeof v.at === 'number' ? v.at : 0,
      day: typeof v.day === 'string' ? v.day : '',
      today: typeof v.today === 'number' ? v.today : 0,
      rules: isObject(v.rules) ? v.rules : {},
    }
  } catch {
    return NO_LOG
  }
}

/** The tips waiting whose situation is recent enough. */
export const freshTips = (pending: Pending, now: number): TipId[] => TIPS.filter(id => {
  const p = pending[id]
  return p !== undefined && now - p.at <= FRESH_MS
})

/**
 * The tip to show now: one an hour, three a day, each twice ever; null when
 * none may. A tip seen before comes back only on a day no tip has shown yet.
 */
export function pickTip(log: CoachLog, pending: Pending, now: number, tz: number): TipId | null {
  const isNewDay = log.day !== dayKey(now, tz)
  if (now - log.at < HOUR || (!isNewDay && log.today >= PER_DAY)) return null
  return freshTips(pending, now).find(id => {
    const n = log.shown[id] ?? 0
    return n === 0 || (n < MAX_SHOWN && isNewDay)
  }) ?? null
}

export function shownTip(log: CoachLog, id: TipId, now: number, tz: number): CoachLog {
  const day = dayKey(now, tz)
  return { ...log, shown: { ...log.shown, [id]: (log.shown[id] ?? 0) + 1 }, at: now, day, today: log.day === day ? log.today + 1 : 1 }
}

/** A tip's face line and its toast; `arg` is the program for `permissions`, the count of changed files for `commit`. */
export function tipLines(id: TipId, arg: string): { line: string; text: string } {
  const d = t().coach.tips
  switch (id) {
    case 'permissions': return { line: d.permissions.line, text: d.permissions.text(arg) }
    case 'commit': return { line: d.commit.line, text: d.commit.text(Number(arg) || 0) }
    default: return d[id]
  }
}

/** What a permission was asked for, as the person would allow it: a command's program, an MCP server, or the tool. */
export function permKey(tool: string, input: Record<string, unknown>): string {
  if (isShell(tool) && typeof input.command === 'string') {
    // `cd app && npm test` asks about npm.
    const run = input.command.split(/&&|\|\||[;|]/).map(s => s.trim()).find(s => s !== '' && !/^cd(\s|$)/i.test(s)) ?? ''
    return run.split(/\s+/)[0] || tool
  }
  if (tool.startsWith('mcp__')) return tool.split('__')[1] || tool
  return tool
}

/** How the end of a turn went, beyond what Env holds. */
export type TurnNote = { reason: string; errorRun: number; isLongFirst: boolean; hasPlanned: boolean; hasPick: boolean; canClick: boolean }

/** The tips the end of a turn calls for. */
export function turnTips(v: Env, turn: TurnNote, now: number): TipId[] {
  const top = [...v.slices].sort((a, b) => b.tokens - a.tokens)[0]
  const git = v.git
  return TIPS.filter(id => {
    switch (id) {
      case 'rewind': return turn.reason === 'aborted' || turn.errorRun >= 3
      case 'compact': return warnLevel(v) >= 1
      case 'mcp': return top !== undefined && top.name.toLowerCase() === 'mcp tools' && v.window > 0 && top.tokens / v.window >= 0.05
      case 'plan': return turn.isLongFirst && !turn.hasPlanned
      case 'commit': return git !== null && git.changed >= 10 && (git.lastCommit === 0 || now - git.lastCommit > HOUR)
      // Only where the rings can be clicked: elsewhere the tour already pointed to /mochi details.
      case 'rings': return turn.canClick && (v.history?.total.turns ?? 0) >= 20
      case 'wear': return levelOf(xpOf(v.history)).level >= 2 && !turn.hasPick
      default: return false
    }
  })
}

/** The tips still waiting, less those about how things stood that no longer do: a /compact or a commit since answers them. */
export function stillPending(pending: Pending, v: Env, now: number): Pending {
  const holds = turnTips(v, { reason: '', errorRun: 0, isLongFirst: false, hasPlanned: true, hasPick: true, canClick: true }, now)
  return Object.fromEntries(Object.entries(pending).filter(([id]) => !['compact', 'mcp', 'commit'].includes(id) || holds.includes(id as TipId)))
}

/** The tour's moods, step by step. */
export const TOUR_MOODS: Mood[] = ['wave', 'pleased', 'proud']

// ---------- instructions the person keeps giving ----------

/** The third time an instruction is given, Mochi offers to add it to CLAUDE.md. */
export const ASK_AT = 3

/**
 * A sentence that sets a standing rule, one pattern or two per language: an
 * opening word (always, never, use…), or a closing one where the verb comes
 * last. A complaint ("doesn't work", "не работает") is no rule, so the
 * negatives want a verb that asks.
 */
const RULES: RegExp[] = [
  /^((always|never|use|prefer|avoid|don't|do not|dont) (?!(know|understand|get|think|see|care|worry|work|mind)( |$))|no (?!(worries|thanks)( |$))\S{2,}s( |$))/,
  /^(siempre|nunca|usa|utiliza|evita|prefiere|no (?!es )\S+[ae]s) /,
  // "nie" wants the infinitive at the end, as German puts it: Polish "nie działa" is a complaint.
  /^((immer|verwende|benutze|nutze|vermeide|bevorzuge|kein|keine) (?!(noch|ahnung|problem)( |$))|(nie|niemals) .*\S+en$)/,
  /^(toujours (?!(pas|rien|pareil|le même|la même|les mêmes)( |$))|jamais|utilise|utilisez|évite|évitez|privilégie|pas de (?!souci|problème)|(ne |n')(?!est|marche|fonctionne|sais|peux|comprends|vois|va )\S+ (pas|jamais)( |$))/,
  /^(sempre|nunca|use|usa|utilize|evite|prefira|não (?!pode|funciona|consegue|entende)\S+[ea]) /,
  /^(всегда|никогда|используй|используйте|избегай|не \S+(й|йте|и|ите|ь|ьте)) /,
  /(^| )(her zaman|asla|hiçbir zaman|daima) (?!.*(yor|d[ıiuü])$)/,
  / (kullan(ın|ma|mayın)?|ekleme(yin)?|yazma(yın)?|yapma(yın)?|koyma(yın)?|silme(yin)?|dokunma(yın)?|değiştirme(yin)?|oluşturma(yın)?|çalıştırma(yın)?|atma(yın)?)$/,
  /^(总是|始终|一律|永远|务必|不要|请勿|勿|使用|用(?!户)|别(?!人))/,
  /^(常に|必ず|絶対)|(使って|使用して|ないで)$/,
  /^(항상|절대|언제나) |(사용해|사용하세요|지 ?마|지 ?마세요|지 ?말아|지 ?말 ?것)(요|줘|라)?$/,
  // Italian (sempre, usa and evita are the Spanish and Portuguese patterns'): "non" with an infinitive asks, "non funziona" does not.
  /^(utilizza|preferisci|mai|non \S+re) /,
  /^(zawsze|nigdy|używaj|stosuj|unikaj|preferuj|nie \S+(j|jcie|sz|rz)) /,
  /^(завжди|ніколи|використовуй|використовуйте|уникай|уникайте|не \S+(й|йте|и|іть|ь|ьте)) /,
  /^(हमेशा|कभी (भी|नहीं|मत)) |(^| )मत \S+$|(इस्तेमाल|उपयोग|प्रयोग) (करो|करें|कीजिए|करना)$/,
  /^(selalu (?!(gagal|error|salah)( |$))|jangan (?!(khawatir|kuatir)( |$))|(gunakan|pakai|hindari|utamakan) )/,
  /^(دائما|دائمًا|أبدا|أبدًا|استخدم|استعمل|تجنب|تجنّب|لا ت\S+) |(دائما|دائمًا)$/,
]

/** Words that point at this chat (this, here, again), not at how the project works. */
const HERE = / (this|that|it|these|those|here|there|again|now|bunu|şunu|onu|bunları|bu|şu|burada|şimdi|yine|tekrar|esto|eso|esta|este|aquí|ahora|dies|diese|hier|jetzt|wieder|ça|cela|ceci|ici|maintenant|encore|isso|isto|esse|essa|aqui|agora|это|этот|эту|эти|тут|здесь|сейчас|снова|опять|이거|그거|이것|그것|여기|지금|다시|questo|questa|questi|quello|qui|qua|ora|adesso|ancora|tutaj|teraz|znowu|ponownie|tego|tę|це|цей|цю|ці|зараз|знову|यह|ये|इसे|इसको|यहाँ|यहां|अभी|फिर|दोबारा|वह|वो|ini|itu|sini|sekarang|lagi|هذا|هذه|هنا|الآن|ذلك|مجددا|مجددًا) /
const HERE_CJK = /这|那|これ|それ|ここ|今(?!後)|また/
/** Han and kana: words without spaces between them. */
const UNSPACED = /[぀-ヿ㐀-鿿]/
const PLEASE = /^((please|pls|lütfen|por favor|bitte|s'il (te|vous) pla[iî]t|пожалуйста|per favore|proszę|будь ласка|कृपया|tolong|mohon|من فضلك|لو سمحت) |请)|,? (please|lütfen|por favor|bitte|s'il (te|vous) pla[iî]t|пожалуйста|per favore|proszę|будь ласка|कृपया|من فضلك|لو سمحت)$|(ください|下さい)$/g

/** A sentence in the form an instruction is kept and compared: lower case, plain quotes, no "please", no end mark. */
export function normalRule(s: string): string {
  const trim = (x: string) => x.replace(/^[\s\-*•>"“”«»(]+|[\s"“”«».!;:,)。！…、،।]+$/g, '')
  return trim(trim(s.toLowerCase().replace(/̇/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ')).replace(PLEASE, ''))
}

const PARTS = /\n+|(?<=[.!?।])\s+|(?<=[。！？；;؟])/

/** An instruction of the prompt as the person wrote it, its letter case kept (`NODE_ENV`, `README.md`); its kept form when not found. */
export function ruleAsWritten(text: string, rule: string): string {
  const trim = (x: string) => x.replace(/^[\s\-*•>"“”«»(]+|[\s"“”«».!;:,)。！…、،।]+$/g, '')
  const part = text.split(PARTS).find(p => normalRule(p) === rule)
  return part === undefined ? rule : trim(trim(part.replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ')).replace(new RegExp(PLEASE.source, 'gi'), ''))
}

/** The standing instructions in a prompt ("use pnpm", "yorum ekleme"), normalized; three at most, none from a long paste. */
export function rulesOf(text: string): string[] {
  if (text.length > 2000) return []
  const found = new Set<string>()
  for (const part of text.split(PARTS)) {
    if (/[?？؟]/.test(part)) continue
    const s = normalRule(part)
    const words = s.split(' ').length
    const isShort = UNSPACED.test(s) ? s.length >= 4 && s.length <= 30 : words >= 2 && words <= 8 && s.length <= 60
    if (!isShort || HERE.test(` ${s.replace(/[,;:]/g, ' ')} `) || HERE_CJK.test(s)) continue
    if (RULES.some(r => r.test(s))) found.add(s)
  }
  return [...found].slice(0, 3)
}

/** A project's key in the log: its root with `/` for a separator. */
export const projectKey = (root: string): string => root.replace(/\\/g, '/').replace(/\/+$/, '')

/**
 * Counts the instructions a prompt gave in a project, the latest last, and
 * names the first now given for the third time, unless added or declined.
 * Forty instructions a project and twenty projects are kept.
 */
export function countRules(log: CoachLog, project: string, rules: readonly string[]): { log: CoachLog; ask: string | null } {
  const mine = { ...(log.rules[project] ?? {}) }
  let ask: string | null = null
  for (const r of rules) {
    const n = mine[r] ?? 0
    if (n < 0) continue
    delete mine[r]
    mine[r] = n + 1
    if (n + 1 >= ASK_AT && ask === null) ask = r
  }
  const entries = Object.entries(mine)
  const kept = Object.fromEntries([...entries.filter(([, n]) => n < 0), ...entries.filter(([, n]) => n >= 0).slice(-40)])
  const { [project]: _old, ...others } = log.rules
  return { log: { ...log, rules: Object.fromEntries(Object.entries({ ...others, [project]: kept }).slice(-20)) }, ask }
}

/** The person's answer: added or declined for good, never asked again; "not now" counts again from zero. */
export function settleRule(log: CoachLog, project: string, rule: string, isForGood: boolean): CoachLog {
  return { ...log, rules: { ...log.rules, [project]: { ...(log.rules[project] ?? {}), [rule]: isForGood ? -1 : 0 } } }
}

/** Whether a CLAUDE.md already says it, letter case and spacing aside. */
export const hasRule = (md: string, rule: string): boolean => normalRule(md).replace(/\s+/g, ' ').includes(rule)

/** CLAUDE.md with the instruction added as its last bullet, in the file's own line endings. */
export function withRule(md: string, rule: string): string {
  const nl = md.includes('\r\n') ? '\r\n' : '\n'
  return `${md}${md === '' || md.endsWith('\n') ? '' : nl}- ${rule}${nl}`
}

// ---------- what is new ----------

/** Whether version `a` ("0.3.0") comes after `b`; a missing part counts as 0. */
export function isNewer(a: string, b: string): boolean {
  const x = a.split('.').map(n => Number.parseInt(n, 10) || 0)
  const y = b.split('.').map(n => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}

type Notes = { headline: string; notes: string[] }

/** A version's notes in the language in use; null when it has none. */
export const newsFor = (version: string): Notes | null => (t().news as Record<string, Notes | undefined>)[version] ?? null

/** What /mochi news prints. */
export function newsLines(version: string): string {
  const n = newsFor(version)
  return n === null ? t().coach.noNews(version) : [`Mochi ${version} · ${n.headline}`, ...n.notes.map(x => `• ${x}`)].join('\n')
}
