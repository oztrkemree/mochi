/**
 * What the person's coding agents used and cost, as CodeBurn counts it (`codeburn status --format menubar-json`, the
 * same report its own menu bar app reads), and the providers' limit windows (`codeburn quota --format json`). Mochi
 * does not price tokens itself: CodeBurn reads Claude Code's and Codex's own logs and knows each model's rates. The
 * report is taken field by field, so a field CodeBurn renames or drops reads as nothing, not as an error.
 */

type Obj = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const opt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {})
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((o): o is Obj => typeof o === 'object' && o !== null && !Array.isArray(o)) : [])

export const SPANS = ['today', 'week', '30days', 'month'] as const
export type Span = (typeof SPANS)[number]

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
/** A stretch of CodeBurn's timeline (an hour, or a day for long spans): when it starts (epoch ms), what it cost, by model. */
export type Point = { at: number; cost: number; tokens: number; models: { name: string; cost: number }[] }
export type Usage = {
  /** When CodeBurn made the report (epoch ms). */
  at: number
  /** Costs come in US dollars; `rate` turns them into `currency`, the one the person chose in CodeBurn. */
  currency: string
  rate: number
  cost: number
  calls: number
  sessions: number
  /** Of the turns that edited, the share that needed no second try (0-1); null when nothing was edited. */
  oneShot: number | null
  /** Of the input read, the percent that came from the cache (0-100). */
  cacheHit: number
  tokens: Tokens
  streak: number
  providers: { id: string; name: string; cost: number; calls: number; sessions: number; tokens: Tokens }[]
  models: { name: string; cost: number; calls: number; tokens: Tokens; perEdit: number | null; oneShot: number | null }[]
  projects: { name: string; path: string; cost: number; sessions: number }[]
  activities: { name: string; cost: number; turns: number; oneShot: number | null }[]
  tools: { name: string; calls: number }[]
  mcp: { name: string; calls: number }[]
  skills: { name: string; turns: number; cost: number }[]
  subagents: { name: string; calls: number; cost: number }[]
  prs: { label: string; url: string; cost: number; sessions: number }[]
  branches: { name: string; cost: number; sessions: number }[]
  reworked: { path: string; edits: number; sessions: number }[]
  live: { project: string; branch: string; model: string; provider: string; used: number; window: number; idle: number }[]
  retry: { cost: number; retries: number }
  routing: { cost: number; baseline: string }
  findings: { title: string; impact: string; cost: number }[]
  /** The span's timeline, as CodeBurn splits it (an hour each for short spans), for today's hours. */
  points: Point[]
  /** Every day CodeBurn knows, from local midnight, each with its top models: the days of a span add up to its `cost`. */
  days: Point[]
}

const tokensOf = (o: Obj): Tokens => ({ input: num(o.inputTokens), output: num(o.outputTokens), cacheRead: num(o.cacheReadTokens), cacheWrite: num(o.cacheWriteTokens) })
export const tokenSum = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite
/** A share given as 0-1 or as 0-100, as a share 0-1. CodeBurn gives both. */
const share = (v: unknown) => {
  const n = opt(v)
  return n === null ? null : n > 1 ? n / 100 : n
}

/** A model as people say it: the timeline names Claude's by id ("claude-opus-5-5" is "Opus 5.5"); others as they come. */
export function modelName(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id)
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : id
}

/** The report, or null when it is not one (CodeBurn failed, or said something else). */
export function usageOf(raw: unknown): Usage | null {
  const r = obj(raw)
  const c = obj(r.current)
  if (!('cost' in c)) return null
  const money = obj(r.currency)
  const efficiency = new Map(arr(c.modelEfficiency).map(m => [str(m.name), m]))
  const timeline = obj(obj(r.history).timeline)
  const series = new Map(arr(timeline.modelSeries).map(s => [str(s.id), str(s.label)]))
  return {
    at: Date.parse(str(r.generated)) || 0,
    currency: /^[A-Z]{3}$/.test(str(money.code)) ? str(money.code) : 'USD',
    rate: num(money.rate) > 0 ? num(money.rate) : 1,
    cost: num(c.cost),
    calls: num(c.calls),
    sessions: num(c.sessions),
    oneShot: share(c.oneShotRate),
    cacheHit: num(c.cacheHitPercent),
    tokens: tokensOf(c),
    streak: num(r.streak),
    providers: arr(c.providerDetails).filter(p => p.hasUsage === true).map(p => ({ id: str(p.id), name: str(p.label) || str(p.id), cost: num(p.cost), calls: num(p.calls), sessions: num(p.sessions), tokens: tokensOf(p) })).sort((a, b) => b.cost - a.cost),
    models: arr(c.topModels).map(m => {
      const e = efficiency.get(str(m.name)) ?? {}
      return { name: str(m.name), cost: num(m.cost), calls: num(m.calls), tokens: tokensOf(m), perEdit: opt(e.costPerEdit), oneShot: share(e.oneShotRate) }
    }),
    projects: arr(c.topProjects).map(p => ({ name: str(p.name), path: str(p.id), cost: num(p.cost), sessions: num(p.sessions) })),
    activities: arr(c.topActivities).map(a => ({ name: str(a.name), cost: num(a.cost), turns: num(a.turns), oneShot: share(a.oneShotRate) })),
    tools: arr(c.tools).map(t => ({ name: str(t.name), calls: num(t.calls) })),
    mcp: arr(c.mcpServers).map(t => ({ name: str(t.name).replace(/^plugin_/, ''), calls: num(t.calls) })),
    skills: arr(c.skills).map(s => ({ name: str(s.name), turns: num(s.turns), cost: num(s.cost) })),
    subagents: arr(c.subagents).map(s => ({ name: str(s.name), calls: num(s.calls), cost: num(s.cost) })),
    prs: arr(obj(c.pullRequests).rows).map(p => ({ label: str(p.label), url: str(p.url), cost: num(p.cost), sessions: num(p.sessions) })),
    branches: arr(c.byBranch).map(b => ({ name: str(b.branch), cost: num(b.cost), sessions: num(b.sessions) })),
    reworked: arr(c.topReworkedFiles).map(f => ({ path: str(f.path), edits: num(f.edits), sessions: num(f.sessions) })),
    live: arr(obj(r.liveSessions).sessions).map(s => ({ project: str(s.project), branch: str(s.branch), model: str(s.model), provider: str(s.provider), used: num(s.contextTokens), window: num(s.contextWindow), idle: num(s.idleSeconds) })),
    retry: { cost: num(obj(c.retryTax).totalUSD), retries: num(obj(c.retryTax).retries) },
    routing: { cost: num(obj(c.routingWaste).totalSavingsUSD), baseline: str(obj(c.routingWaste).baselineModel) },
    findings: arr(obj(r.optimize).topFindings).map(f => ({ title: str(f.title), impact: str(f.impact), cost: num(f.savingsUSD) })),
    days: arr(obj(r.history).daily).flatMap(d => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d.date))
      return m ? [{ at: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime(), cost: num(d.cost), tokens: tokenSum(tokensOf(d)), models: arr(d.topModels).map(t => ({ name: str(t.name), cost: num(t.cost) })) }] : []
    }),
    points: arr(timeline.points).map(p => ({ at: Date.parse(str(p.timestamp)) || 0, cost: num(p.cost), tokens: num(p.tokens), models: arr(p.models).map(m => ({ name: modelName(series.get(str(m.seriesId)) ?? str(m.seriesId)), cost: num(m.cost) })) })).filter(p => p.at > 0).sort((a, b) => a.at - b.at),
  }
}

/** A provider's limit window: its name as the provider gives it, percent used (0-100), when it resets (epoch ms, 0 when not known). */
export type Window = { label: string; used: number; resetsAt: number }
export type Quota = { id: string; name: string; plan: string; windows: Window[] }

/** The providers signed in on this computer that tell their limits; the rest are left out. */
export function quotaOf(raw: unknown): Quota[] {
  return arr(obj(raw).providers)
    .filter(p => p.available === true)
    .map(p => ({ id: str(p.id), name: str(p.name) || str(p.id), plan: str(p.plan), windows: arr(p.windows).map(w => ({ label: str(w.label), used: Math.min(100, Math.max(0, num(w.usedPct))), resetsAt: Date.parse(str(w.resetsAt)) || 0 })) }))
    .filter(p => p.windows.length > 0)
}

/** How many days before today a span reaches back, as CodeBurn counts it: the last 7 days are today and the 7 before. */
const back = (span: Span, today: Date) => (span === 'week' ? 7 : span === '30days' ? 30 : span === 'month' ? today.getDate() - 1 : 0)

/**
 * The span's bars, oldest first: today's 24 hours from local midnight, else a day each from the span's first day to
 * today, in the computer's own days. An hour is the timeline's points in it, a day CodeBurn's own count of it (the timeline
 * of a long span can miss a few cents); a bar with nothing in it counts as nothing.
 */
export function barsOf(u: Usage, span: Span, now: number): Point[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const starts: number[] = []
  if (span === 'today') for (let h = 0; h < 24; h++) starts.push(new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).getTime())
  else for (let d = back(span, today); d >= 0; d--) starts.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - d).getTime())
  const bars: Point[] = starts.map(at => ({ at, cost: 0, tokens: 0, models: [] }))
  for (const p of span === 'today' ? u.points : u.days) {
    let i = starts.length - 1
    while (i >= 0 && starts[i]! > p.at) i--
    // Before the first bar (a point CodeBurn counted from its own midnight), or after the last bar's end.
    if (i < 0 || p.at >= (starts[i + 1] ?? starts[i]! + (span === 'today' ? 3_600_000 : 86_400_000) * 1.5)) continue
    const b = bars[i]!
    b.cost += p.cost
    b.tokens += p.tokens
    for (const m of p.models) {
      const had = b.models.find(x => x.name === m.name)
      if (had) had.cost += m.cost
      else b.models.push({ ...m })
    }
  }
  return bars
}
