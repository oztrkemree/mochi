import type { Platform } from './system'

// What Mochi keeps, and how the person takes it out or clears it: its own
// store and the JSON files under ~/.claude/mochi, nothing anywhere else.
// Paths here are relative to that folder: '' is its top, 'days' the history.

/** What /mochi reset clears. */
export type Scope = 'level' | 'history' | 'all'

const isExport = (dir: string, name: string) => dir === '' && name.startsWith('export-')

/** Whether an export takes this file: every JSON file Mochi keeps but the other chats' presence and earlier exports. */
export const isExported = (dir: string, name: string): boolean => name.endsWith('.json') && dir !== 'live' && !isExport(dir, name)

/**
 * Whether a reset of `scope` removes this file. The level's memory goes with
 * the history it was counted from, so the levels earned again are celebrated
 * again. Exports stay: they are the person's own copies.
 */
export function isCleared(scope: Scope, dir: string, name: string): boolean {
  if (!name.endsWith('.json') || isExport(dir, name)) return false
  if (dir === '' && name === 'level.json') return true
  if (scope === 'history') return dir === 'days'
  return scope === 'all'
}

/** One file of everything Mochi keeps: its store, and each file by its path, as JSON where it parses. */
export function exportOf(at: number, version: string, store: Record<string, unknown>, files: Record<string, string>) {
  const parsed: Record<string, unknown> = {}
  for (const [path, text] of Object.entries(files)) {
    try {
      parsed[path] = JSON.parse(text)
    } catch {
      parsed[path] = text
    }
  }
  return { mochi: version, exportedAt: new Date(at).toISOString(), store, files: parsed }
}

const FORM_SURFACE: Record<string, string> = { desktop: 'Claude desktop app', terminal: 'Terminal', vscode: 'VS Code' }
const OS: Record<Platform, string> = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }

/** The version at the head of a text ("2.1.293 (Claude Code)" is 2.1.293), so nothing else rides along; '' when there is none. */
const version = (v: string) => /^[\w.+-]{1,32}/.exec(v.trim())?.[0] ?? ''

/**
 * A new bug report on GitHub, its form filled with the versions (the unknown
 * left out), the system, the surface and the language: nothing of the
 * person's, their files or their prompts.
 */
export function feedbackUrl(v: { mochi: string; claude: string; platform: Platform; surface: string; lang: string }): string {
  const versions = [
    ...(version(v.claude) ? [`Claude Code ${version(v.claude)}`] : []),
    ...(version(v.mochi) ? [`Mochi ${version(v.mochi)}`] : []),
    OS[v.platform],
    v.lang,
  ].join(' · ')
  const fields = { template: 'bug_report.yml', surface: FORM_SURFACE[v.surface] ?? 'Other', versions }
  return `https://github.com/oztrkemree/mochi/issues/new?${Object.entries(fields).map(([k, x]) => `${k}=${encodeURIComponent(x)}`).join('&')}`
}
