import { expect, test } from 'vitest'

import type { Crew, Peer } from '../../types'
import { MAX_KITS, kitSpots, kitsOf, kitsSvg } from './kits'

const crew = (n: number): Crew[] => Array.from({ length: n }, (_, i) => ({ id: String(i), type: '', task: '', activity: 'thinking', since: 0 }))

const peer = (state: Peer['state'], agents: number): Peer => ({ id: `${state}-${agents}`, label: 'chat', state, line: '', since: 0, at: 0, agents: crew(agents) })

test('one small Mochi stands by for each subagent of a busy chat, and never more than five', () => {
  expect(kitsOf([peer('busy', 2), peer('busy', 1)])).toBe(3)
  expect(kitsOf([peer('asking', 2), peer('idle', 3), peer('error', 1)])).toBe(0)
  expect(kitsOf([{ ...peer('busy', 0), agents: undefined }])).toBe(0)
  expect(kitsOf([peer('busy', 4), peer('busy', 4)])).toBe(MAX_KITS)
  expect(kitsOf([])).toBe(0)
})

test('kits stand in a row along the bottom, centred, with the size of a ninth of the square', () => {
  expect(kitSpots(1, 100)).toEqual([{ x: 50, y: 91, r: 9 }])
  const two = kitSpots(2, 100)
  expect(two.map(s => s.x)).toEqual([38.75, 61.25])
  expect(two.map(s => s.y)).toEqual([91, 91])
  expect(kitSpots(0, 100)).toEqual([])
  expect(kitSpots(-2, 100)).toEqual([])
})

test('the kits as SVG are a group of a body and two eyes each, with nothing that moves by itself', () => {
  expect(kitsSvg([], '#000')).toBe('')
  const svg = kitsSvg(kitSpots(1, 100), '#000')
  expect(svg.startsWith('<g class="kits">')).toBe(true)
  expect(svg).toContain('<circle cx="50" cy="91" r="9" fill="#000"')
  expect(svg.split('<circle').length - 1).toBe(3)
  expect(svg).not.toContain('<animate')
  expect(svg).not.toContain('animation')
})

test('the ink colour is escaped so it cannot break out of its attribute', () => {
  const svg = kitsSvg(kitSpots(1, 100), 'a"b<c&d')
  expect(svg).toContain('fill="a&quot;b&lt;c&amp;d"')
})
