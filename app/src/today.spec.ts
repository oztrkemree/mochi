import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { ciNow, ciStep, commitsOf, desksOf, isOver, nudgeOf, pullBoxOf, pushed } from './today'

setLang('en')

const NOW = Date.UTC(2026, 10, 23, 12, 0)

test('the commits and the desks are read from what git printed; anything else is left out', () => {
  expect(commitsOf(['api\t1763899200\tFix the cart\tfor real', 'half', '\t12\tx', 'web\tsoon\tx'], 180)).toEqual([
    { repo: 'api', at: 1763899200_000, subject: 'Fix the cart\tfor real', day: '2025-11-23' },
  ])
  expect(desksOf([
    { repo: 'api', status: '## main...origin/main [ahead 1]\n M a.ts\n?? b.ts\n', branches: [{ name: 'feat', ahead: 2, hasUpstream: false }, { name: 7 }] },
    { repo: 'odd' },
    null,
  ])).toEqual([{ repo: 'api', branch: 'main', dirty: 2, branches: [{ name: 'feat', ahead: 2, hasUpstream: false }] }])
})

test('the pull request box says why it is empty: no gh, not signed in, or nothing waiting', () => {
  expect(pullBoxOf(null, NOW).sections).toEqual([])
  expect(pullBoxOf({ code: 4, stdout: '', stderr: 'To get started with GitHub CLI, please run: gh auth login' }, NOW).note).toMatch(/gh auth login|sign/i)
  const pull = (n: number, title: string) => ({ number: n, title, url: `https://github.com/o/api/pull/${n}`, author: { login: 'ayse' }, repository: { name: 'api' }, updatedAt: new Date(NOW - 3_600_000).toISOString(), commits: { nodes: [] }, latestReviews: { nodes: [] } })
  const box = pullBoxOf({ code: 0, stdout: JSON.stringify({ data: { viewer: { login: 'me' }, review: { nodes: [pull(12, 'Fix the cart')] }, mine: { nodes: [] }, seen: { nodes: [] } } }), stderr: '' }, NOW)
  expect(box.sections).toHaveLength(1)
  expect(box.sections[0]!.rows).toEqual([{ text: 'api #12 Fix the cart', state: 'ayse · 1h ago', url: 'https://github.com/o/api/pull/12' }])
  expect(box.copy).toContain('https://github.com/o/api/pull/12')
  const empty = pullBoxOf({ code: 0, stdout: JSON.stringify({ data: { viewer: { login: 'me' }, review: { nodes: [] }, mine: { nodes: [] }, seen: { nodes: [] } } }), stderr: '' }, NOW)
  expect(empty.sections).toEqual([])
  expect(empty.note).not.toBe('')
})

test('changes left uncommitted are said once a turn ends and the last commit is an hour and a half old', () => {
  const s = (changed: number, minutesAgo: number) => ({ root: '/w/api', changed, lastCommit: minutesAgo < 0 ? 0 : Math.floor((NOW - minutesAgo * 60_000) / 1000) })
  expect(nudgeOf(s(3, 30), NOW)).toBeNull()
  expect(nudgeOf(s(0, 300), NOW)).toBeNull()
  expect(nudgeOf(null, NOW)).toBeNull()
  expect(nudgeOf(s(3, 120), NOW)).toBe('3 files waiting for a commit · last commit 2h ago')
  expect(nudgeOf(s(1, -1), NOW)).toBe('1 file waiting for a commit · no commits yet')
})

test('a push that ran is watched until its CI passes, fails or is cancelled', () => {
  const push = (command: string, name = 'PostToolUse') => ({ hook_event_name: name, tool_name: 'Bash', tool_input: { command } })
  expect(pushed(push('git push -u origin feat'))).toBe(true)
  expect(pushed(push('git push', 'PreToolUse'))).toBe(false)
  expect(pushed(push('git status'))).toBe(false)
  const run = (status: string, conclusion: string) => ({ status, conclusion, name: 'test', workflowName: 'test', event: 'push', createdAt: new Date(NOW + 5000).toISOString(), updatedAt: new Date(NOW + 65_000).toISOString() })
  const ran = (runs: unknown[]) => ({ sha: 'abc', out: { code: 0, stdout: JSON.stringify(runs), stderr: '' } })
  expect(ciNow(ran([]), NOW)!.state).toBe('waiting')
  expect(isOver(ciNow(ran([run('in_progress', '')]), NOW)!)).toBe(false)
  expect(ciNow(ran([run('completed', 'success')]), NOW)!.state).toBe('passed')
  expect(ciNow(ran([run('completed', 'failure')]), NOW)!.state).toBe('failed')
  expect(ciNow({ sha: 'abc', out: { code: 1, stdout: '', stderr: 'no' } }, NOW)).toBeNull()
  expect(ciNow(null, NOW)).toBeNull()
})

test('a CI is watched until it ends, for half an hour at most, and let be after two minutes with no run to show', () => {
  const ci = (state: 'waiting' | 'running' | 'passed') => ({ sha: 'abc', pushedAt: NOW, state, total: 0, done: 0, failed: [], startedAt: 0, endedAt: 0 })
  expect(ciStep(ci('passed'), 60_000)).toBe('say')
  expect(ciStep(ci('running'), 29 * 60_000)).toBe('again')
  expect(ciStep(ci('running'), 31 * 60_000)).toBe('stop')
  expect(ciStep(ci('waiting'), 60_000)).toBe('again')
  // No workflow, or the folder moved to another commit: no run ever shows for it.
  expect(ciStep(ci('waiting'), 3 * 60_000)).toBe('stop')
  expect(ciStep(null, 60_000)).toBe('again')
  expect(ciStep(null, 3 * 60_000)).toBe('stop')
})
