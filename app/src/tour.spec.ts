import { expect, test } from 'vitest'

import { TIP_EVERY_MS, TIP_QUIET_MS, nextStep, tipNow } from './tour'

test('the first meeting goes step by step, and asks about an agent only while it is there and not connected', () => {
  const both = { claude: 'off', codex: 'off' } as const
  expect(nextStep(new Set(), both)).toBe('hello')
  expect(nextStep(new Set(['hello']), both)).toBe('claude')
  expect(nextStep(new Set(['hello']), { claude: 'on', codex: 'missing' })).toBe('approve')
  expect(nextStep(new Set(['hello', 'claude']), { claude: 'off', codex: 'broken' })).toBe('approve')
  expect(nextStep(new Set(['hello', 'claude', 'codex', 'approve', 'pocket']), both)).toBeNull()
})

test('a tip comes after the first meeting, a day apart, once Mochi has been quiet a while, and never twice', () => {
  const now = 100 * TIP_EVERY_MS
  expect(tipNow([], 0, 0, now, false)).toBeNull()
  expect(tipNow([], 0, 0, now, true)).toBe('rightClick')
  expect(tipNow(['rightClick'], now - TIP_EVERY_MS + 1, 0, now, true)).toBeNull()
  expect(tipNow(['rightClick'], 0, now - TIP_QUIET_MS + 1, now, true)).toBeNull()
  expect(tipNow(['rightClick'], 0, 0, now, true)).toBe('drag')
  expect(tipNow(['rightClick', 'drag', 'edge', 'today', 'wardrobe', 'pat', 'shield', 'line'], 0, 0, now, true)).toBeNull()
})
