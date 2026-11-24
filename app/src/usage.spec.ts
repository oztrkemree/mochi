import { expect, test } from 'vitest'

import { barsOf, modelName, quotaOf, tokenSum, usageOf } from './usage'

/** A CodeBurn report cut down to a few of its fields, in the shape `status --format menubar-json` prints. */
const REPORT = {
  generated: '2026-11-23T22:42:04.416Z',
  current: {
    cost: 12.5, calls: 40, sessions: 3, oneShotRate: 0.75, cacheHitPercent: 99.5,
    inputTokens: 100, outputTokens: 2000, cacheReadTokens: 50_000, cacheWriteTokens: 900,
    providerDetails: [
      { id: 'codex', label: 'Codex', cost: 0.5, calls: 4, sessions: 1, hasUsage: true, inputTokens: 10 },
      { id: 'claude', label: 'Claude', cost: 12, calls: 36, sessions: 2, hasUsage: true, outputTokens: 2000 },
      { id: 'cursor', label: 'Cursor', cost: 0, calls: 0, hasUsage: false },
    ],
    topModels: [{ name: 'Opus 5.5', cost: 11, calls: 30, outputTokens: 1800 }, { name: 'Sonnet 5.5', cost: 1, calls: 6 }],
    modelEfficiency: [{ name: 'Opus 5.5', costPerEdit: 2.5, oneShotRate: 90.7 }],
    topActivities: [{ name: 'Debugging', cost: 6, turns: 9, oneShotRate: null }],
    mcpServers: [{ name: 'plugin_context-mode_context-mode', calls: 22 }],
    pullRequests: { rows: [{ label: 'me/app#5', url: 'https://github.com/me/app/pull/5', cost: 4, sessions: 1 }] },
    byBranch: [{ branch: 'main', cost: 9, sessions: 2 }],
    retryTax: { totalUSD: 1.5, retries: 2 },
  },
  history: {
    daily: [
      { date: '2026-11-23', cost: 8, calls: 20, inputTokens: 1, outputTokens: 2, topModels: [{ name: 'Opus 5.5', cost: 8 }] },
      { date: '2026-11-21', cost: 4, calls: 9 },
      { date: 'garbage', cost: 99 },
    ],
    timeline: { modelSeries: [{ id: 'model_0', label: 'claude-opus-5-5' }], points: [{ timestamp: '2026-11-23T21:00:00.000Z', cost: 3, models: [{ seriesId: 'model_0', cost: 3 }] }] },
  },
  currency: { code: 'EUR', symbol: '€', rate: 0.9 },
  streak: 2,
  liveSessions: { sessions: [{ project: 'engram', model: 'Opus 5.5', provider: 'claude', contextTokens: 250_000, contextWindow: 1_000_000, idleSeconds: 4 }] },
}

test('the report is read field by field: providers with use only and by cost, shares as 0-1, efficiency joined to its model', () => {
  const u = usageOf(REPORT)!
  expect(u.at).toBe(Date.parse('2026-11-23T22:42:04.416Z'))
  expect([u.cost, u.calls, u.sessions, u.oneShot, u.cacheHit, u.streak]).toEqual([12.5, 40, 3, 0.75, 99.5, 2])
  expect(tokenSum(u.tokens)).toBe(53_000)
  expect([u.currency, u.rate]).toEqual(['EUR', 0.9])
  expect(u.providers.map(p => p.id)).toEqual(['claude', 'codex'])
  expect(u.models[0]).toEqual({ name: 'Opus 5.5', cost: 11, calls: 30, tokens: { input: 0, output: 1800, cacheRead: 0, cacheWrite: 0 }, perEdit: 2.5, oneShot: 0.907 })
  expect(u.models[1]!.perEdit).toBeNull()
  expect(u.activities[0]!.oneShot).toBeNull()
  expect(u.mcp[0]!.name).toBe('context-mode_context-mode')
  expect(u.prs[0]!.url).toBe('https://github.com/me/app/pull/5')
  expect(u.retry).toEqual({ cost: 1.5, retries: 2 })
  expect(u.live[0]).toMatchObject({ project: 'engram', used: 250_000, window: 1_000_000 })
  // The timeline's models by the names people say.
  expect(u.points[0]!.models).toEqual([{ name: 'Opus 5.5', cost: 3 }])
  // A field missing or of another kind reads as nothing.
  expect(u.skills).toEqual([])
  expect(u.routing).toEqual({ cost: 0, baseline: '' })
})

test('what is not a report is no report, and an odd currency falls back to dollars', () => {
  expect(usageOf(null)).toBeNull()
  expect(usageOf({ providers: [] })).toBeNull()
  expect(usageOf('{"current":{}}')).toBeNull()
  const u = usageOf({ current: { cost: 1 }, currency: { code: 'dollars', rate: -2 } })!
  expect([u.currency, u.rate, u.oneShot]).toEqual(['USD', 1, null])
})

test('Claude models are named as people say them, others as they come', () => {
  expect(['claude-opus-5-5', 'claude-fable-5-2', 'claude-haiku-4', 'claude-sonnet-4-5-20250929', 'gpt-6-sol'].map(modelName)).toEqual(['Opus 5.5', 'Fable 5.2', 'Haiku 4', 'Sonnet 4.5', 'gpt-6-sol'])
})

/** Epoch ms of a local time, so the bars are checked in this computer's own days. */
const local = (y: number, mo: number, d: number, h = 0) => new Date(y, mo - 1, d, h).getTime()
const point = (at: number, cost: number) => ({ timestamp: new Date(at).toISOString(), cost, tokens: 10, models: [{ seriesId: 'model_0', cost }] })

test('the last 7 days are today and the 7 before, as CodeBurn counts them; a day is CodeBurn\'s own count of it', () => {
  const now = local(2026, 11, 24, 1)
  // The timeline says 920 for the 17th; the day's own count, 923, is what the total holds.
  const u = usageOf({ ...REPORT, history: {
    daily: [{ date: '2026-11-16', cost: 700 }, { date: '2026-11-17', cost: 923, outputTokens: 20, topModels: [{ name: 'Opus 5.5', cost: 900 }] }, { date: '2026-11-20', cost: 5 }, { date: '2026-11-24', cost: 40 }],
    timeline: { points: [point(local(2026, 11, 17, 0), 920)] },
  } })!
  const week = barsOf(u, 'week', now)
  expect(week).toHaveLength(8)
  expect(week[0]!.at).toBe(local(2026, 11, 17))
  expect(week.map(b => b.cost)).toEqual([923, 0, 0, 5, 0, 0, 0, 40])
  expect(week[0]!.models).toEqual([{ name: 'Opus 5.5', cost: 900 }])
  expect(week[0]!.tokens).toBe(20)
  // A report kept from yesterday, drawn by its own day, still has its days.
  expect(barsOf(u, 'week', local(2026, 11, 25, 9)).map(b => b.cost)).toEqual([0, 0, 5, 0, 0, 0, 40, 0])
  expect(barsOf(u, 'month', now)).toHaveLength(24)
  expect(barsOf(u, 'month', now)[0]!.at).toBe(local(2026, 11, 1))
  expect(barsOf(u, '30days', now)).toHaveLength(31)
})

test('today has 24 hours from local midnight; yesterday\'s points are not in them', () => {
  const now = local(2026, 11, 24, 15)
  const u = usageOf({ ...REPORT, history: { timeline: { points: [point(local(2026, 11, 23, 22), 7), point(local(2026, 11, 24, 0), 1), point(local(2026, 11, 24, 14), 3)] } } })!
  const hours = barsOf(u, 'today', now)
  expect(hours).toHaveLength(24)
  expect(hours[0]!.at).toBe(local(2026, 11, 24))
  expect(hours[0]!.cost).toBe(1)
  expect(hours[14]!.cost).toBe(3)
  expect(hours.reduce((s, h) => s + h.cost, 0)).toBe(4)
})

test('limits: only providers signed in that tell a window, percent kept within 0-100', () => {
  const quota = quotaOf({
    providers: [
      { id: 'claude', name: 'Claude', available: false, windows: [] },
      { id: 'codex', name: 'Codex', available: true, plan: 'Plus', windows: [{ label: '5-hour', usedPct: 130, resetsAt: '2026-11-24T02:42:52.000Z' }, { label: 'Weekly', usedPct: -3 }] },
      { id: 'kimi', name: 'Kimi', available: true, windows: [] },
    ],
  })
  expect(quota).toEqual([{ id: 'codex', name: 'Codex', plan: 'Plus', windows: [{ label: '5-hour', used: 100, resetsAt: Date.parse('2026-11-24T02:42:52.000Z') }, { label: 'Weekly', used: 0, resetsAt: 0 }] }])
  expect(quotaOf('nope')).toEqual([])
})
