import { expect, test } from 'vitest'

import { FRESH, type Stretch, stepBreak } from './breaks'

const T0 = 1_760_000_000_000
const MIN = 60_000

const at = (s: Stretch, busy: boolean, min: number, minutes: number) => stepBreak(s, busy, T0 + min * MIN, minutes)

test('a break is due exactly when 90 minutes of unbroken work have passed, not a minute before', () => {
  const a = at(FRESH, true, 0, 90)
  expect(a).toEqual({ stretch: { since: T0, quietAt: null, told: false }, due: false })
  expect(at(a.stretch, true, 89, 90).due).toBe(false)
  expect(at(a.stretch, true, 90, 90).due).toBe(true)
})

test('a break is said once per stretch of work, however long it runs on', () => {
  const due = at(at(FRESH, true, 0, 60).stretch, true, 60, 60)
  expect(due).toEqual({ stretch: { since: T0, quietAt: null, told: true }, due: true })
  expect(at(due.stretch, true, 95, 60).due).toBe(false)
  expect(at(due.stretch, true, 200, 60).due).toBe(false)
})

test('four minutes of quiet do not reset the stretch, so the break is not said again', () => {
  const due = at(at(FRESH, true, 0, 60).stretch, true, 60, 60)
  const quiet = at(due.stretch, false, 62, 60)
  expect(quiet.stretch).toEqual({ since: T0, quietAt: T0 + 62 * MIN, told: true })
  const back = at(quiet.stretch, true, 66, 60)
  expect(back).toEqual({ stretch: { since: T0, quietAt: null, told: true }, due: false })
})

test('five minutes of quiet end the stretch, and the next long run is due again after its own 60 minutes', () => {
  const due = at(at(FRESH, true, 0, 60).stretch, true, 60, 60)
  const quiet = at(due.stretch, false, 62, 60)
  const rested = at(quiet.stretch, false, 67, 60)
  expect(rested.stretch).toEqual(FRESH)
  const fresh = at(rested.stretch, true, 70, 60)
  expect(fresh.stretch).toEqual({ since: T0 + 70 * MIN, quietAt: null, told: false })
  expect(at(fresh.stretch, true, 129, 60).due).toBe(false)
  expect(at(fresh.stretch, true, 130, 60).due).toBe(true)
})

test('with the break off, or a minute count that is not offered, nothing is ever due', () => {
  expect(at(FRESH, true, 0, 0)).toEqual({ stretch: FRESH, due: false })
  expect(at(FRESH, true, 500, 0).due).toBe(false)
  expect(at(FRESH, true, 200, 45)).toEqual({ stretch: FRESH, due: false })
})

test('the stretch passed in is never changed', () => {
  const s = Object.freeze({ since: T0, quietAt: null, told: false })
  expect(at(s, true, 95, 90).due).toBe(true)
  expect(at(s, false, 96, 90).stretch).toEqual({ since: T0, quietAt: T0 + 96 * MIN, told: false })
  expect(s).toEqual({ since: T0, quietAt: null, told: false })
})
