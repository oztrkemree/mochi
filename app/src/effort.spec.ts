import { expect, test } from 'vitest'

import { effortOf, peakOf, projectOf, sumOf, weekDue, weekTop } from './effort'

const ROOTS = ['/u/P/spark-client', '/u/P/shop/.claude/worktrees/lead-M1-14', '/u/P/mochi', 'C:\\Users\\e\\P\\api']
const file = (id: string, label: string, days: Record<string, object>, more: object = {}) => JSON.stringify({ id, label, isLabelFromPrompt: false, days, ...more })

test('a chat belongs to the repository its folder is in, a worktree to the repository that holds it', () => {
  expect(projectOf('spark-client', false, '', ROOTS)).toBe('spark-client')
  expect(projectOf('lead-M1-14', false, '', ROOTS)).toBe('shop')
  expect(projectOf('anything', false, '/u/P/shop/.claude/worktrees/loop-9', ROOTS)).toBe('shop')
  expect(projectOf('api', false, '', ROOTS)).toBe('api')
  // A label cut short matches the folder it was cut from.
  expect(projectOf('spark-cli…', false, '', ROOTS)).toBe('spark-client')
  // Not in the repositories Mochi saw: the folder's own name stands as the project.
  expect(projectOf('chalk-talk', false, '', ROOTS)).toBe('chalk-talk')
})

test('a chat named by its first words, or in a worktree Claude Code named itself, has no project', () => {
  expect(projectOf('fix the login', true, '', ROOTS)).toBeNull()
  expect(projectOf('fervent-boyd-1df155', false, '', ROOTS)).toBeNull()
  expect(projectOf('nowhere-to…', false, '', ROOTS)).toBeNull()
})

test('the days of every chat are added up by project, day by day, within the stretch shown', () => {
  const files = [
    file('a', 'spark-client', { '2026-11-23': { secs: 3600, commits: 2, add: 10, del: 4, cost: 1.5, night: 1, turns: 5 }, '2026-11-24': { secs: 1800 } }),
    file('b', 'spark-client', { '2026-11-24': { secs: 600, commits: 1 } }),
    file('c', 'lead-M1-14', { '2026-11-24': { secs: 7200 } }),
    file('d', 'fervent-boyd-1df155', { '2026-11-22': { secs: 900 } }),
    file('e', 'mochi', { '2026-01-01': { secs: 99999 } }),
    'not json',
    JSON.stringify({ id: 'f', days: 'nope' }),
  ]
  const e = effortOf(files, ROOTS, '2026-11-24', 3)
  expect(e.days).toEqual(['2026-11-22', '2026-11-23', '2026-11-24'])
  // Most time first: shop's two hours before spark-client's hour and forty minutes.
  expect(e.projects.map(p => p.name)).toEqual(['shop', 'spark-client'])
  const sc = e.projects[1]!
  expect(sc.chats).toBe(2)
  expect(sc.daily[1]).toEqual({ secs: 3600, commits: 2, add: 10, del: 4, cost: 1.5, night: 1, turns: 5 })
  expect(sc.daily[2]!.secs).toBe(2400)
  expect(e.projects[0]!.folders).toEqual(['lead-M1-14'])
  expect(e.unmatched.daily[0]!.secs).toBe(900)
  expect(e.unmatched.folders).toEqual(['fervent-boyd-1df155'])
  expect(sumOf(sc.daily, 2).secs).toBe(2400)
  expect(sumOf(sc.daily, 0).commits).toBe(3)
})

test('a number that is not a count counts as nothing', () => {
  const e = effortOf([file('a', 'mochi', { '2026-11-24': { secs: -5, commits: 'two', add: Infinity, turns: 3 } })], ROOTS, '2026-11-24', 1)
  expect(e.projects[0]!.daily[0]).toEqual({ secs: 0, commits: 0, add: 0, del: 0, cost: 0, night: 0, turns: 3 })
})

test('the busiest day shows each folder as a lane of its chats, the longest chat beside all of them together', () => {
  const files = [
    file('m', 'spark-client', { '2026-11-23': { secs: 36000 } }),
    file('w1', 'night-w1', { '2026-11-23': { secs: 3600 } }),
    file('w2', 'night-w1', { '2026-11-23': { secs: 7200 } }),
    file('w3', 'night-w2', { '2026-11-23': { secs: 1800 }, '2026-11-24': { secs: 60 } }),
  ]
  const e = effortOf(files, ROOTS, '2026-11-24', 2)
  const p = peakOf(e, 0)!
  expect(p.day).toBe('2026-11-23')
  expect(p.total).toBe(48600)
  expect(p.longest).toBe(36000)
  expect(p.lanes).toEqual([
    { label: 'spark-client', chats: [36000] },
    { label: 'night-w1', chats: [7200, 3600] },
    { label: 'night-w2', chats: [1800] },
  ])
  expect(peakOf(effortOf([], ROOTS, '2026-11-24', 2), 0)).toBeNull()
})

test('the week is told of by the project with the most time in the last seven days, if there was half an hour of it', () => {
  const files = [
    file('a', 'mochi', { '2026-11-20': { secs: 4000 }, '2026-11-24': { secs: 2000 } }),
    file('b', 'spark-client', { '2026-11-17': { secs: 90000 }, '2026-11-21': { secs: 5000 } }),
  ]
  expect(weekTop(effortOf(files, ROOTS, '2026-11-24', 42))).toEqual({ name: 'mochi', secs: 6000 })
  expect(weekTop(effortOf([file('a', 'mochi', { '2026-11-24': { secs: 1700 } })], ROOTS, '2026-11-24', 42))).toBeNull()
})

test('the week is told once, on Friday from 18:00 local time', () => {
  const at = (d: number, h: number) => Date.UTC(2026, 10, d, h, 30) - 180 * 60_000
  expect(weekDue(at(20, 17), 180, null)).toBeNull()
  expect(weekDue(at(20, 18), 180, null)).toBe('2026-11-20')
  expect(weekDue(at(20, 23), 180, '2026-11-20')).toBeNull()
  expect(weekDue(at(21, 10), 180, null)).toBeNull()
  expect(weekDue(at(21, 19), 180, null)).toBeNull()
  expect(weekDue(at(19, 20), 180, null)).toBeNull()
  expect(weekDue(at(27, 19), 180, '2026-11-20')).toBe('2026-11-27')
})
