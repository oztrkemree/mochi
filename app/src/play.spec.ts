import { expect, test } from 'vitest'

import { animationOf } from './play'

test('a layer plays its keyframes as the rig draws them: straight from one to the next, at their times, over its own time however short', () => {
  // The typing arm's loop: 0.3 s, shorter than a frame or two of any stop motion.
  const arm = { tpl: 'rotate({0}deg)', frames: [[54], [63], [54]], times: [0, 0.5, 1], dur: 0.3 }
  expect(animationOf(arm)).toEqual({
    keyframes: [
      { offset: 0, transform: 'rotate(54deg)' },
      { offset: 0.5, transform: 'rotate(63deg)' },
      { offset: 1, transform: 'rotate(54deg)' },
    ],
    options: { duration: 300, iterations: Infinity, easing: 'linear' },
  })
  const blink = { tpl: 'scale(1, {0})', frames: [[1], [1], [0.12], [1], [1]], times: [0, 0.93, 0.955, 0.98, 1], dur: 4.2 }
  expect(animationOf(blink).keyframes.map(k => [k.offset, k.transform])).toEqual([
    [0, 'scale(1, 1)'], [0.93, 'scale(1, 1)'], [0.955, 'scale(1, 0.12)'], [0.98, 'scale(1, 1)'], [1, 'scale(1, 1)'],
  ])
})
