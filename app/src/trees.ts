/** One worktree of a repository: where it is, its branch ('' when detached), its commit, whether it is the main checkout and whether it is locked. */
export type Tree = { path: string; branch: string; head: string; isMain: boolean; isLocked: boolean }

/** Folders and files git ignores that can be made again: build output and caches. Anything else ignored is the person's to keep. */
export const REBUILT = ['node_modules', 'target', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.cache', '.vite', '.parcel-cache', 'coverage', '__pycache__', '.pytest_cache', '.venv', 'venv', '.gradle', 'Pods', 'DerivedData', 'Library', 'Temp', 'Logs', 'obj', 'bin', '.DS_Store'] as const

/** What a worktree holds that git ignores and that cannot be made again, by name, from Rust's list of ignored paths. */
export function keepsOf(ignored: string): string[] {
  const keeps: string[] = []
  for (const line of ignored.split(/\r?\n/)) {
    const name = line.replace(/\/+$/, '').split('/').pop() ?? ''
    if (name === '' || (REBUILT as readonly string[]).includes(name) || name.endsWith('.log') || keeps.includes(name)) continue
    keeps.push(name)
  }
  return keeps
}

/** A worktree with what decides whether it can go: its repository, whether its branch is merged, whether it has uncommitted changes, whether a chat is open in it, its size (kilobytes) and what it keeps that git ignores. */
export type TreeState = Tree & { repo: string; isMerged: boolean; isDirty: boolean; isOpen: boolean; kb: number; keeps: string[] }

/** The worktrees git lists, the main checkout first. */
export function treesOf(list: string): Tree[] {
  const trees: Tree[] = []
  for (const block of list.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/)
    const path = lines.find(l => l.startsWith('worktree '))
    if (path === undefined) continue
    const branch = lines.find(l => l.startsWith('branch refs/heads/'))
    const head = lines.find(l => l.startsWith('HEAD '))
    trees.push({
      path: path.slice('worktree '.length),
      branch: branch === undefined ? '' : branch.slice('branch refs/heads/'.length),
      head: head === undefined ? '' : head.slice('HEAD '.length),
      isMain: trees.length === 0,
      isLocked: lines.some(l => l === 'locked' || l.startsWith('locked ')),
    })
  }
  return trees
}

/** The branches merged into the default branch, by name. */
export function mergedOf(merged: string): string[] {
  return merged.split(/\r?\n/).map(l => l.trim().replace(/^[*+]\s+/, '')).filter(l => l !== '')
}

/** Whether a chat's folder is this worktree or inside it, whatever the letter case or the slashes: when in doubt a chat is in it. */
export const isInside = (folder: string, path: string): boolean => {
  const norm = (s: string): string => s.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const f = norm(folder)
  const p = norm(path)
  return p !== '' && (f === p || f.startsWith(`${p}/`))
}

/** A worktree's state from what git said and where the chats are. */
export function stateOf(repo: string, tree: Tree, merged: readonly string[], isDirty: boolean, kb: number, chatFolders: readonly string[], ignored: string): TreeState {
  return { ...tree, repo, isMerged: merged.includes(tree.branch), isDirty, isOpen: chatFolders.some(f => isInside(f, tree.path)), kb, keeps: keepsOf(ignored) }
}

/** What stops a removal outright, whatever the person says: a chat works in the folder, or git has it locked. */
export const hardOf = (t: TreeState): 'open' | 'locked' | null => (t.isOpen ? 'open' : t.isLocked ? 'locked' : null)

/** What a removal would lose, which the person may decide to lose: work on a branch not merged (the branch stays), changes not committed, files git ignores that cannot be made again. */
export type Loss = { kind: 'notMerged' } | { kind: 'detached' } | { kind: 'dirty' } | { kind: 'keeps'; name: string }
export const lossesOf = (t: TreeState): Loss[] => [
  // On no branch, what was committed only here is lost, and no branch stays to hold it.
  ...(t.branch === '' ? [{ kind: 'detached' } as const] : t.isMerged ? [] : [{ kind: 'notMerged' } as const]),
  ...(t.isDirty ? [{ kind: 'dirty' } as const] : []),
  ...t.keeps.map(name => ({ kind: 'keeps', name }) as const),
]

/** What a press on a worktree's Remove does: says why not (a chat is open in it, git has it locked), asks about what would be lost, or removes it. */
export const pressOf = (t: TreeState): 'open' | 'locked' | 'ask' | 'remove' => hardOf(t) ?? (lossesOf(t).length > 0 ? 'ask' : 'remove')

/** Whether a worktree goes at one press with nothing asked: not the main one, nothing stopping it, nothing it would lose. */
export const canRemove = (t: TreeState): boolean => !t.isMain && t.branch !== '' && hardOf(t) === null && lossesOf(t).length === 0

/** Kilobytes as gigabytes with one decimal, for showing ('0.1' at least for anything above 0). */
export const gbOf = (kb: number): string => {
  if (kb <= 0) return '0.0'
  return Math.max(0.1, Math.round((kb / (1024 * 1024)) * 10) / 10).toFixed(1)
}
