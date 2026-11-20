import { expect, test } from 'vitest'

import { areaOf, fit } from './place'

// The main screen, a second one to its left, and a third above it, as the system lays them out.
const MAIN = { x: 0, y: 25, w: 1440, h: 875 }
const LEFT = { x: -2560, y: -200, w: 2560, h: 1415 }
const ABOVE = { x: 0, y: -1080, w: 1920, h: 1080 }
const AREAS = [MAIN, LEFT, ABOVE]

test('a corner is found on the screen it was left on, left of or above the main one too, and on none once that screen is gone', () => {
  expect(areaOf({ x: 1424, y: 884 }, AREAS)).toBe(MAIN)
  expect(areaOf({ x: -100, y: 1100 }, AREAS)).toBe(LEFT)
  expect(areaOf({ x: 900, y: -40 }, AREAS)).toBe(ABOVE)
  // The right edge itself still counts.
  expect(areaOf({ x: 1440, y: 900 }, AREAS)).toBe(MAIN)
  // A screen to the right was unplugged.
  expect(areaOf({ x: 3000, y: 600 }, AREAS)).toBeNull()
  expect(areaOf({ x: 3000, y: 600 }, [])).toBeNull()
})

test('the window grows up and to the left of its corner, and is kept whole on its screen', () => {
  expect(fit({ x: 1424, y: 884 }, 128, 128, MAIN)).toEqual({ x: 1296, y: 756 })
  // A bubble wider than the room to the left: the window moves right, still on the screen.
  expect(fit({ x: 150, y: 884 }, 264, 175, MAIN)).toEqual({ x: 0, y: 709 })
  // A corner near the top: the window moves down instead of under the menu bar.
  expect(fit({ x: 700, y: 60 }, 128, 128, MAIN)).toEqual({ x: 572, y: 25 })
  // On the screen to the left, negative points are a place like any other.
  expect(fit({ x: -100, y: 1100 }, 128, 128, LEFT)).toEqual({ x: -228, y: 972 })
})
