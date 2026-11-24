/** How many tries in a row of the same failing step make a chat stuck. */
export const STUCK_AT = 3

/** One chat's run of the same failing step: what failed, how many times in a row, and whether it was said. */
export type Run = { key: string; fails: number; told: boolean }

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** What a hook call is a try of: the tool and the command or file it was given; null when the call is no tool's result. */
export function tryOf(name: string, event: Record<string, unknown>): { key: string; failed: boolean } | null {
  if (name !== 'PostToolUse' && name !== 'PostToolUseFailure') return null
  if (typeof event.tool_name !== 'string') return null
  const input = typeof event.tool_input === 'object' && event.tool_input !== null ? (event.tool_input as Record<string, unknown>) : {}
  const target = typeof input.command === 'string' ? input.command : text(input.file_path)
  return { key: `${event.tool_name}\n${target}`, failed: name === 'PostToolUseFailure' }
}

/** A chat's run after one more hook call, and whether it is stuck now (said once per run). */
export function stepStuck(run: Run | undefined, name: string, event: Record<string, unknown>): { run: Run | undefined; isStuck: boolean } {
  if (name === 'UserPromptSubmit' || name === 'SessionEnd') return { run: undefined, isStuck: false }
  const t = tryOf(name, event)
  if (t === null) return { run, isStuck: false }
  if (t.failed) {
    const same = run !== undefined && run.key === t.key
    const fails = same ? run.fails + 1 : 1
    const isStuck = fails >= STUCK_AT && !(same && run.told)
    return { run: { key: t.key, fails, told: (same && run.told) || isStuck }, isStuck }
  }
  if (run !== undefined && run.key === t.key) return { run: undefined, isStuck: false }
  return { run, isStuck: false }
}
