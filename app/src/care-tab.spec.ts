import { expect, test } from 'vitest'

import { hoursOf, percentOf, removableKb } from './care-tab'
import type { TreeState } from './trees'

const tree = (kb: number, over: Partial<TreeState> = {}): TreeState => ({
  path: '/code/shop/.claude/worktrees/fix', branch: 'fix', head: 'abc', isMain: false, isLocked: false,
  repo: 'shop', isMerged: true, isDirty: false, isOpen: false, kb, keeps: [], ...over,
})

test('only the worktrees that can be removed count toward the kilobytes', () => {
  const trees = [tree(100), tree(20, { isDirty: true }), tree(4, { isOpen: true }), tree(8, { isMerged: false }), tree(1000, { isMain: true })]
  expect(removableKb(trees)).toBe(100)
})

test('whole hours from seconds', () => {
  expect(hoursOf(184296)).toBe(51)
  expect(hoursOf(42)).toBe(0)
})

test('a share as a whole percent, at most 100, and 0 over nothing', () => {
  expect(percentOf(1, 4)).toBe(25)
  expect(percentOf(5, 4)).toBe(100)
  expect(percentOf(1, 0)).toBe(0)
})
