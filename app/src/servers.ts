/** A dev server found listening: its process, command, port, how long it has run (seconds; 0 when unknown) and the folder it runs in ('' when unknown). */
export type Server = { pid: number; command: string; port: number; seconds: number; folder: string }

/** The commands taken for a dev server; a version after the name (python3.12) counts too. */
export const DEV_COMMANDS = ['node', 'bun', 'deno', 'python', 'ruby', 'php', 'java', 'go', 'cargo', 'dotnet', 'vite', 'next-server', 'uvicorn', 'gunicorn', 'rails', 'hugo'] as const

/** How long a server must have run to count as left running: a day. */
export const FORGOTTEN_S = 24 * 3600

const whole = (s: string): number => (/^\d+$/.test(s) ? Number(s) : Number.NaN)

/** Whether a command is one of a dev server's. */
export function isDevCommand(command: string): boolean {
  const c = command.toLowerCase()
  return DEV_COMMANDS.some(d => c === d || (c.startsWith(d) && /^[\d.]+$/.test(c.slice(d.length))))
}

/** Who listens where, from lsof's field output: one entry per process and port. */
export function listeningOf(lsof: string): { pid: number; command: string; port: number }[] {
  const out: { pid: number; command: string; port: number }[] = []
  const seen = new Set<string>()
  let pid = Number.NaN
  let command = ''
  for (const line of lsof.split('\n')) {
    const value = line.slice(1)
    if (line[0] === 'p') {
      pid = whole(value)
      command = ''
    } else if (line[0] === 'c') {
      command = value
    } else if (line[0] === 'n') {
      const port = whole(value.slice(value.lastIndexOf(':') + 1))
      const key = `${pid}:${port}`
      if (pid > 0 && port > 0 && port <= 65535 && !seen.has(key)) {
        seen.add(key)
        out.push({ pid, command, port })
      }
    }
  }
  return out
}

/** How long each process has run, in seconds, from ps's `pid etime` lines. */
export function agesOf(ps: string): Map<number, number> {
  const out = new Map<number, number>()
  for (const line of ps.split('\n')) {
    const m = /^\s*(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s*$/.exec(line)
    if (m === null) continue
    const [days, hours, minutes, seconds] = [m[2] ?? '0', m[3] ?? '0', m[4], m[5]].map(Number)
    out.set(Number(m[1]), ((days * 24 + hours) * 60 + minutes) * 60 + seconds)
  }
  return out
}

/** The folder each process runs in, from lsof's cwd output. */
export function foldersOf(cwd: string): Map<number, string> {
  const out = new Map<number, string>()
  let pid = Number.NaN
  for (const line of cwd.split('\n')) {
    if (line[0] === 'p') pid = whole(line.slice(1))
    else if (line[0] === 'n' && pid > 0) out.set(pid, line.slice(1))
  }
  return out
}

/** The dev servers running now: dev commands on ports from 1024 up, one per process and port, lowest port first. */
export function serversOf(lsof: string, ps: string, cwd: string): Server[] {
  const ages = agesOf(ps)
  const folders = foldersOf(cwd)
  return listeningOf(lsof)
    .filter(l => isDevCommand(l.command) && l.port >= 1024)
    .map(l => ({ pid: l.pid, command: l.command, port: l.port, seconds: ages.get(l.pid) ?? 0, folder: folders.get(l.pid) ?? '' }))
    .sort((a, b) => a.port - b.port)
}

/** The name a server is said once by. */
export const serverKey = (s: Server): string => `${s.pid}:${s.port}`

/** The servers left running that were not said yet. */
export function forgotten(servers: readonly Server[], told: readonly string[]): Server[] {
  return servers.filter(s => s.seconds >= FORGOTTEN_S && !told.includes(serverKey(s)))
}

/** The last part of a folder's path, for naming a server; the command when there is no folder. */
export const serverName = (s: Server): string => s.folder.split(/[/\\]/).filter(Boolean).pop() ?? s.command
