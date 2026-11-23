import { expect, test } from 'vitest'

import { frameAt } from './play'

test('a layer is played from keyframe to keyframe, eased, looping, at uneven times too', () => {
  const t = { tpl: 'translate({0}%, {1}%)', frames: [[0, 0], [0, -2], [0, 0]], times: [0, 0.5, 1], dur: 2 }
  expect(frameAt(t, 0)).toBe('translate(0%, 0%)')
  expect(frameAt(t, 1)).toBe('translate(0%, -2%)')
  // Halfway between two keyframes, eased: the middle.
  expect(frameAt(t, 0.5)).toBe('translate(0%, -1%)')
  // Eased: slow away from a keyframe.
  expect(Number(frameAt(t, 0.1).match(/, (-?[\d.]+)%/)![1])).toBeGreaterThan(-0.1)
  // Looping.
  expect(frameAt(t, 3)).toBe(frameAt(t, 1))
  const blink = { tpl: 'scale(1, {0})', frames: [[1], [1], [0.12], [1], [1]], times: [0, 0.93, 0.955, 0.98, 1], dur: 4.2 }
  expect(frameAt(blink, 2)).toBe('scale(1, 1)')
  expect(frameAt(blink, 4.2 * 0.955)).toBe('scale(1, 0.12)')
})
