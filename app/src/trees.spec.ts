import { expect, test } from 'vitest'

import { type Tree, type TreeState, canRemove, gbOf, isInside, mergedOf, stateOf, treesOf } from './trees'

const H = (digit: string): string => digit.repeat(40)

const LIST = [
  'worktree /Users/sam/code/shop',
  `HEAD ${H('1')}`,
  'branch refs/heads/main',
  '',
  'worktree /Users/sam/code/shop/.claude/worktrees/fix-cart',
  `HEAD ${H('2')}`,
  'branch refs/heads/claude/fix-cart',
  '',
  'worktree /Users/sam/code/shop-old',
  `HEAD ${H('3')}`,
  'detached',
  '',
  'worktree /Users/sam/code/shop-keep',
  `HEAD ${H('4')}`,
  'branch refs/heads/keep',
  'locked reason',
].join('\n')

test('the worktrees git lists come out in order, the first one the main checkout, with branch, commit and lock read from each block', () => {
  expect(treesOf(LIST)).toEqual([
    { path: '/Users/sam/code/shop', branch: 'main', head: H('1'), isMain: true, isLocked: false },
    { path: '/Users/sam/code/shop/.claude/worktrees/fix-cart', branch: 'claude/fix-cart', head: H('2'), isMain: false, isLocked: false },
    { path: '/Users/sam/code/shop-old', branch: '', head: H('3'), isMain: false, isLocked: false },
    { path: '/Users/sam/code/shop-keep', branch: 'keep', head: H('4'), isMain: false, isLocked: true },
  ])
})

test('a block without a worktree line is skipped, and empty text lists no worktrees', () => {
  expect(treesOf('')).toEqual([])
  expect(treesOf(`HEAD ${H('5')}\nbranch refs/heads/main`)).toEqual([])
})

test('the merged branches are read by name, without the marker of the checked out one', () => {
  expect(mergedOf('  claude/fix-cart\n* main')).toEqual(['claude/fix-cart', 'main'])
  expect(mergedOf('+ keep\n\n')).toEqual(['keep'])
  expect(mergedOf('')).toEqual([])
})

test('a folder is inside a worktree when it is that folder or below it, and a folder that only shares its first letters is not', () => {
  expect(isInside('/a/b/c', '/a/b')).toBe(true)
  expect(isInside('/a/b', '/a/b')).toBe(true)
  expect(isInside('/a/b/', '/a/b/')).toBe(true)
  expect(isInside('/a/bc', '/a/b')).toBe(false)
  expect(isInside('', '/a/b')).toBe(false)
})

test('a folder is inside a worktree whatever the letter case or the slashes, since a chat in it must keep it', () => {
  expect(isInside('/Users/sam/Code/Shop/src', '/Users/sam/code/shop')).toBe(true)
  expect(isInside('C:\\code\\shop\\src', 'C:/code/shop')).toBe(true)
  expect(isInside('/a/BC', '/a/b')).toBe(false)
})

test('a worktree state counts as merged and open only when its branch is merged and a chat folder is inside it', () => {
  const wt: Tree = { path: '/Users/sam/code/shop/.claude/worktrees/fix-cart', branch: 'claude/fix-cart', head: H('2'), isMain: false, isLocked: false }
  expect(stateOf('shop', wt, ['claude/fix-cart', 'main'], false, 2048, ['/Users/sam/code/shop/.claude/worktrees/fix-cart/src', '/Users/sam/code/shop-old'])).toEqual({
    path: '/Users/sam/code/shop/.claude/worktrees/fix-cart', branch: 'claude/fix-cart', head: H('2'), isMain: false, isLocked: false,
    repo: 'shop', isMerged: true, isDirty: false, isOpen: true, kb: 2048,
  })
  expect(stateOf('shop', wt, ['main'], true, 0, ['/Users/sam/code/shop-old'])).toEqual({
    path: '/Users/sam/code/shop/.claude/worktrees/fix-cart', branch: 'claude/fix-cart', head: H('2'), isMain: false, isLocked: false,
    repo: 'shop', isMerged: false, isDirty: true, isOpen: false, kb: 0,
  })
})

test('a worktree can be removed only when it is not the main one, not locked, on a branch, merged, clean and with no chat open', () => {
  const tree: TreeState = { path: '/r/wt', branch: 'claude/x', head: H('2'), isMain: false, isLocked: false, repo: 'shop', isMerged: true, isDirty: false, isOpen: false, kb: 2048 }
  expect(canRemove(tree)).toBe(true)
  expect(canRemove({ ...tree, isMain: true })).toBe(false)
  expect(canRemove({ ...tree, isLocked: true })).toBe(false)
  expect(canRemove({ ...tree, branch: '' })).toBe(false)
  expect(canRemove({ ...tree, isMerged: false })).toBe(false)
  expect(canRemove({ ...tree, isDirty: true })).toBe(false)
  expect(canRemove({ ...tree, isOpen: true })).toBe(false)
})

test('sizes are shown in gigabytes with one decimal, and anything above zero shows at least 0.1', () => {
  expect(gbOf(1048576)).toBe('1.0')
  expect(gbOf(1572864)).toBe('1.5')
  expect(gbOf(1000)).toBe('0.1')
  expect(gbOf(0)).toBe('0.0')
})
