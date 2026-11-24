import { expect, test } from 'vitest'
import { rowOf } from './updates'
import { words } from './words'

const w = words().update

test('a row offers the update only when GitHub has a newer one, and the install only when it is not there', () => {
  expect(rowOf('0.9.0', '0.10.0', w)).toEqual({ text: '0.9.0 → 0.10.0', action: 'update' })
  expect(rowOf(null, '0.10.0', w)).toEqual({ text: w.missing, action: 'install' })
  expect(rowOf('0.10.0', '0.10.0', w)).toEqual({ text: w.upToDate('0.10.0'), action: null })
  // A newer one here than GitHub has (a build not yet released) is left alone.
  expect(rowOf('1.2.0', '1.1.0', w).action).toBeNull()
})

test('with GitHub out of reach a row says so and offers nothing', () => {
  expect(rowOf('1.0.0', null, w, false)).toEqual({ text: `1.0.0 · ${w.offline}`, action: null })
  expect(rowOf(null, null, w, false)).toEqual({ text: `${w.missing} · ${w.offline}`, action: null })
})

test('with GitHub reached but no release of that kind yet, a row says only what is installed and offers nothing', () => {
  expect(rowOf('1.0.0', null, w)).toEqual({ text: '1.0.0', action: null })
  expect(rowOf(null, null, w)).toEqual({ text: w.missing, action: null })
})
