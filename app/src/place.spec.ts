import { expect, test } from 'vitest'

import { areaOf, fit, isPushedDown, nearestEdge, peekAt, pushedPast, shownIn } from './place'

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

test('Mochi pushed more than halfway off the bottom of the screen peeks: only its head shows, its body whole across', () => {
  const body = { x: 230, y: 500, w: 100, h: 104 }
  // Left with its body's middle above the bottom: it stands where it is.
  expect(isPushedDown({ x: 1000, y: 330 }, body, MAIN)).toBe(false)
  expect(isPushedDown({ x: 1000, y: 360 }, body, MAIN)).toBe(true)
  // Peeking, 45% of the body shows above the bottom of the work area (900).
  expect(peekAt({ x: 1000, y: 380 }, body, MAIN)).toEqual({ x: 1000, y: 900 - 500 - 104 * 0.45 })
  // Pushed off to the right as well: the body is brought back whole across.
  expect(peekAt({ x: 1300, y: 380 }, body, MAIN).x).toBe(1440 - 230 - 100)
})

test('with nothing to do Mochi goes to the nearest edge: the bottom, or a side, where it lies on its side and its head peeks in', () => {
  const body = { x: 230, y: 500, w: 100, h: 104 }
  // Its body's middle at 1000 + 280 across, its feet at 330 + 604 down: the bottom (900) is nearer than either side.
  expect(nearestEdge({ x: 1000, y: 330 }, body, MAIN)).toBe('bottom')
  // Near the right side, high up: the right.
  expect(nearestEdge({ x: 1100, y: -300 }, body, MAIN)).toBe('right')
  expect(nearestEdge({ x: -250, y: -300 }, body, MAIN)).toBe('left')
  // On a side, turned a quarter about its middle (280, 552 in the window): 45% of its height shows inside the screen.
  const right = peekAt({ x: 1100, y: -300 }, body, MAIN, 'right')
  expect(right.x + 280 - 104 / 2).toBeCloseTo(1440 - 104 * 0.45)
  const left = peekAt({ x: -250, y: -300 }, body, MAIN, 'left')
  expect(left.x + 280 + 104 / 2).toBeCloseTo(0 + 104 * 0.45)
  // Up and down it stays where it was, kept whole on the screen (turned, it is the body's width tall).
  expect(right.y).toBe(-300)
  expect(peekAt({ x: 1100, y: -600 }, body, MAIN, 'right').y).toBe(25 - (552 - 50))
  expect(peekAt({ x: 1100, y: 600 }, body, MAIN, 'right').y).toBe(900 - (552 + 50))
  // Pushed past a side by more than half its body, it peeks there; past none, it stands.
  expect(pushedPast({ x: 1300, y: 100 }, body, MAIN)).toBe('right')
  expect(pushedPast({ x: -300, y: 100 }, body, MAIN)).toBe('left')
  expect(pushedPast({ x: 1000, y: 360 }, body, MAIN)).toBe('bottom')
  expect(pushedPast({ x: 1000, y: 100 }, body, MAIN)).toBeNull()
  // What of the window shows on the screen, in its own units from its top left.
  expect(shownIn({ x: 1300, y: 100 }, 340, 700, MAIN)).toEqual({ left: 0, top: 0, right: 140, bottom: 700 })
  expect(shownIn({ x: 1000, y: 400 }, 340, 700, MAIN)).toEqual({ left: 0, top: 0, right: 340, bottom: 500 })
})
