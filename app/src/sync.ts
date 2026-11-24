/** One file in a folder of days: its name, when it was last written (ms) and its size. */
export type Entry = { name: string; mtime: number; size: number }

/** How much newer a file must be to be copied over its twin: two seconds, so a clock that rounds does not copy back and forth. */
export const SLACK_MS = 2_000

/** Whether a file name is one of a chat's days files and nothing that leaves the folder. */
export const isDaysFile = (name: string): boolean => /^[A-Za-z0-9_-]{1,140}\.json$/.test(name)

/** What to copy between this computer's days and the shared folder's: `pull` into this computer, `push` out of it. Nothing is ever deleted. */
export function planOf(local: readonly Entry[], shared: readonly Entry[]): { pull: string[]; push: string[] } {
  const usable = (es: readonly Entry[]): Map<string, Entry> =>
    new Map(es.filter(e => isDaysFile(e.name) && Number.isFinite(e.mtime) && e.size > 0).map((e): [string, Entry] => [e.name, e]))
  const here = usable(local)
  const there = usable(shared)
  const pull: string[] = []
  const push: string[] = []
  for (const name of [...new Set([...here.keys(), ...there.keys()])].sort()) {
    const l = here.get(name)
    const s = there.get(name)
    if (!l) pull.push(name)
    else if (!s) push.push(name)
    else if (s.mtime - l.mtime > SLACK_MS) pull.push(name)
    else if (l.mtime - s.mtime > SLACK_MS) push.push(name)
  }
  return { pull, push }
}
