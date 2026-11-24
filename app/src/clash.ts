/** How close in time two chats' edits to one file must be to clash, in ms. */
export const CLASH_MS = 30 * 60_000

/** One chat's edit of one file. */
export type Edit = { chat: string; path: string; at: number }

// shortcut: notebooks are not seen, the hook passes no notebook_path; keep it in agents.rs (kept_short) when two chats in one notebook matter
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit']

/** The edit a hook call made: a file-editing tool's finished call with a path; null for anything else. */
export function editOf(chat: string, name: string, event: Record<string, unknown>, at: number): Edit | null {
  const input = event.tool_input as { file_path?: unknown } | undefined
  if (name !== 'PostToolUse' || typeof event.tool_name !== 'string' || !EDIT_TOOLS.includes(event.tool_name)) return null
  if (typeof input !== 'object' || input === null || typeof input.file_path !== 'string' || input.file_path === '') return null
  return { chat, path: input.file_path, at }
}

/** The other chat that edited the same file within CLASH_MS before `fresh`, the latest such; null when none. */
export function clashOf(edits: readonly Edit[], fresh: Edit): string | null {
  const hits = edits.filter(e => e.chat !== fresh.chat && e.path === fresh.path && fresh.at - e.at <= CLASH_MS && e.at <= fresh.at)
  return hits.length === 0 ? null : hits.reduce((a, b) => (b.at > a.at ? b : a)).chat
}

/** The edits to remember after `fresh`: those still within CLASH_MS, one per chat and file (the newest). */
export function kept(edits: readonly Edit[], fresh: Edit): Edit[] {
  const recent = edits.filter(e => e.at >= fresh.at - CLASH_MS && !(e.chat === fresh.chat && e.path === fresh.path))
  return [...recent, fresh]
}

/** One name for a clash whichever chat came first, so it is said once. */
export function clashKey(a: string, b: string, path: string): string {
  return [a, b].sort().concat(path).join('\n')
}
