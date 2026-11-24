/** The agents whose new versions Mochi reports. */
export const AGENTS = ['claude', 'codex'] as const
/** One of the agents in AGENTS. */
export type Agent = (typeof AGENTS)[number]

/** The version in what a program printed for --version: the first run of numbers and dots like 1.2.3; null when there is none. */
export function versionOf(text: string): string | null {
  return text.match(/\d+(\.\d+)+/)?.[0] ?? null
}

/** Whether version `a` is after version `b`, number by number: 1.2.10 is after 1.2.9. */
export function isAfter(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** The part of a changelog under one version's heading, up to the next heading of the same depth; '' when there is none. */
export function sectionOf(changelog: string, version: string): string {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex(line => line.trim() === `## ${version}`)
  if (start === -1) return ''
  const rest = lines.slice(start + 1)
  const next = rest.findIndex(line => line.trim().startsWith('## '))
  return (next === -1 ? rest : rest.slice(0, next)).join('\n').trim()
}

/** The first bullet points of some Markdown, each on one line, cut to `most` characters with an ellipsis. */
export function bulletsOf(markdown: string, count = 2, most = 110): string[] {
  return markdown
    .split('\n')
    .filter(line => /^[-*] /.test(line))
    .slice(0, count)
    .map(line => line.slice(2).trim().replace(/ \(#\d+\)$/, ''))
    .map(text => (text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text))
}

/** What changed in a version, in a couple of lines: from Claude Code's changelog, or from Codex's release as GitHub gives it. */
export function changesOf(agent: Agent, text: string, version: string): string[] {
  if (agent === 'claude') return bulletsOf(sectionOf(text, version))
  let body: unknown
  try {
    body = JSON.parse(text)?.body
  } catch {
    return []
  }
  return typeof body === 'string' ? bulletsOf(body) : []
}

/** Which agents have a newer version than the one kept, and what to keep: nothing is fresh the first time a version is seen. */
export function versionNews(kept: string | null, now: Record<Agent, string | null>): { fresh: Agent[]; keep: string | null } {
  let before: Partial<Record<Agent, unknown>> = {}
  try {
    const parsed: unknown = JSON.parse(kept ?? 'null')
    if (typeof parsed === 'object' && parsed !== null) before = parsed
  } catch {
    before = {}
  }
  const fresh: Agent[] = []
  const newest: Partial<Record<Agent, string>> = {}
  let changed = false
  for (const agent of AGENTS) {
    const seen = now[agent]
    const was = typeof before[agent] === 'string' ? before[agent] : undefined
    if (seen && was && isAfter(seen, was)) fresh.push(agent)
    const best = seen && (!was || isAfter(seen, was)) ? seen : was
    if (best) newest[agent] = best
    if (best !== was) changed = true
  }
  return { fresh, keep: changed ? JSON.stringify(newest) : null }
}
