import { expect, test } from 'claude-code/testing'

import type { Peer } from '../types'
import { setLang } from '../hooks/i18n'
import { ALIVE_MS } from '../hooks/live'
import { DONE_FOR_MS, MOVING_MAX, floorOf, memberLines, membersOf, moodOf, nameLines, partyOf, shareArt, spotAt, statusOf, stillOf } from '../hooks/party'

setLang('en')

const NOW = 1_760_000_000_000
const MIN = 60_000

const peer = (id: string, state: Peer['state'], more: Partial<Peer> = {}): Peer =>
  ({ id, label: id, state, line: '', since: 0, at: NOW, folder: id, branch: 'main', isWorktree: false, stateAt: 0, title: '', v: 2, agents: [], lastTurn: null, limit: null, ...more })

test('a chat’s status comes from its file alone; one gone quiet is unknown, never idle', async () => {
  expect(statusOf(peer('a', 'busy'), NOW)).toBe('busy')
  expect(statusOf(peer('a', 'asking'), NOW)).toBe('asking')
  expect(statusOf(peer('a', 'error'), NOW)).toBe('error')
  expect(statusOf(peer('a', 'idle'), NOW)).toBe('idle')
  // Asking, then silent: it may still wait, so it is shown as unknown.
  expect(statusOf(peer('a', 'asking', { at: NOW - ALIVE_MS - 1 }), NOW)).toBe('quiet')
  // A turn that ended well lately is done; an aborted one, or an old one, is idle.
  expect(statusOf(peer('a', 'idle', { lastTurn: { at: NOW - MIN, reason: 'answer', seconds: 30 } }), NOW)).toBe('done')
  expect(statusOf(peer('a', 'idle', { lastTurn: { at: NOW - MIN, reason: 'aborted', seconds: 30 } }), NOW)).toBe('idle')
  expect(statusOf(peer('a', 'idle', { lastTurn: { at: NOW - DONE_FOR_MS, reason: 'answer', seconds: 30 } }), NOW)).toBe('idle')
  // A used-up window holds an idle chat until it resets; a busy one is still busy.
  expect(statusOf(peer('a', 'idle', { limit: { kind: 'five_hour', resetsAt: NOW + MIN } }), NOW)).toBe('limit')
  expect(statusOf(peer('a', 'idle', { limit: { kind: 'five_hour', resetsAt: NOW - 1 } }), NOW)).toBe('idle')
  expect(statusOf(peer('a', 'busy', { limit: { kind: 'five_hour', resetsAt: NOW + MIN } }), NOW)).toBe('busy')
})
test('one chat alone draws no party, unless it has subagents', async () => {
  expect(partyOf(peer('me', 'busy'), [], NOW).isShown).toBe(false)
  const withAgents = peer('me', 'busy', { agents: [{ id: 'a', type: 'Explore', task: 'look', activity: 'reading', since: NOW }] })
  expect(partyOf(withAgents, [], NOW).isShown).toBe(true)
})

test('those that need the person stand by the door, the longest wait first; work at the bench; the rest in the nap corner', async () => {
  const me = peer('me', 'idle')
  const party = partyOf(me, [
    peer('quiet', 'busy', { at: NOW - ALIVE_MS - 1 }),
    peer('rest', 'idle'),
    peer('fresh', 'idle', { lastTurn: { at: NOW - MIN, reason: 'answer', seconds: 9 } }),
    peer('work', 'busy'),
    peer('spent', 'idle', { limit: { kind: 'seven_day', resetsAt: NOW + MIN } }),
    peer('broke', 'error'),
    peer('ask-new', 'asking', { stateAt: NOW - MIN }),
    peer('ask-old', 'asking', { stateAt: NOW - 5 * MIN }),
    // This chat's own file, read back from another: it is shown once, as itself.
    { ...me, state: 'busy' },
  ], NOW)
  expect(party.door.map(m => m.peer.id)).toEqual(['ask-old', 'ask-new', 'broke', 'spent'])
  expect(party.shop.map(m => m.peer.id)).toEqual(['work', 'fresh'])
  expect(party.nap.map(m => m.peer.id)).toEqual(['me', 'rest', 'quiet'])
  expect(party.waiting).toBe(2)
})

test('at most six Mochis move; the waiting always do, those at rest or done never', async () => {
  const busy = Array.from({ length: 8 }, (_, i) => peer(`b${i}`, 'busy'))
  const party = partyOf(peer('me', 'idle'), [...busy, peer('d', 'idle', { lastTurn: { at: NOW - MIN, reason: 'answer', seconds: 9 } }), peer('w1', 'asking'), peer('w2', 'asking')], NOW)
  const moving = membersOf(party).filter(m => m.isMoving)
  expect(moving.length).toBe(MOVING_MAX)
  expect(moving.slice(0, 2).map(m => m.peer.id)).toEqual(['w1', 'w2'])
  expect(party.nap.some(m => m.isMoving) || party.shop.find(m => m.peer.id === 'd')?.isMoving).toBe(false)
  const many = Array.from({ length: 8 }, (_, i) => peer(`w${i}`, 'asking'))
  expect(membersOf(partyOf(peer('me', 'idle'), many, NOW)).filter(m => m.isMoving).length).toBe(8)
})

test('a name takes as many whole words as three lines hold; what does not fit ends in an ellipsis', async () => {
  expect(nameLines('Agent Party/Village araştırması', 21)).toEqual(['Agent Party/Village', 'araştırması'])
  expect(nameLines('Support ajanı dil ve tarzı iyileştirmesi', 18)).toEqual(['Support ajanı dil', 've tarzı', 'iyileştirmesi'])
  expect(nameLines('Support ajanı dil ve tarzı iyileştirmesi', 18, 2)).toEqual(['Support ajanı dil', 've tarzı iyileşti…'])
  expect(nameLines('mochi', 18)).toEqual(['mochi'])
  expect(nameLines('averyveryverylongsinglewordname', 10, 1)).toEqual(['averyvery…'])
  for (const line of nameLines('Support ajanı dil ve tarzı iyileştirmesi bir de çok daha uzun bir ad', 18)) expect([...line].length).toBeLessThanOrEqual(18)
})

test('the floor shows only the places with someone in them, a "+N" past each one’s room, and a press lands on the Mochi under it', async () => {
  const three = partyOf(peer('me', 'busy'), [peer('a', 'busy'), peer('b', 'idle')], NOW)
  const small = floorOf(three, NOW)
  expect(small.svg).not.toContain('AT THE DOOR')
  expect(small.svg).toContain('WORKSHOP')
  expect(small.svg).toContain('NAP CORNER')
  expect(small.spots.map(s => s.key)).toEqual(['a', 'me', 'b'])
  // Each spot is where its Mochi stands: the middle of one lands on it, the floor's far edge on none of the shop's.
  for (const spot of small.spots) expect(spotAt(small, (spot.x0 + spot.x1) / 2 / small.width)).toBe(spot.key)
  expect(spotAt(small, -0.1)).toBe('')
  const crowd = partyOf(peer('me', 'busy'), [
    ...Array.from({ length: 6 }, (_, i) => peer(`w${i}`, 'asking')),
    ...Array.from({ length: 9 }, (_, i) => peer(`b${i}`, 'busy')),
    ...Array.from({ length: 9 }, (_, i) => peer(`r${i}`, 'idle')),
  ], NOW)
  const big = floorOf(crowd, NOW, 'w0')
  expect(big.spots.length).toBe(4 + 6 + 7)
  expect(big.svg).toContain('+2</text>')
  expect(big.svg).toContain('+4</text>')
  expect(big.svg).toContain('9 idle')
  // Each Mochi wears the person's outfit: what Mochi wears in the band, given by mood.
  const dressed = floorOf(crowd, NOW, 'w0', () => ({ head: 'beanie', face: 'sunglasses', neck: 'scarf', held: null, ground: 'cactus' }))
  expect((dressed.svg.match(/<use href="#art/g) ?? []).length).toBeGreaterThanOrEqual((big.svg.match(/<use href="#art/g) ?? []).length + 17 * 2)
  expect(new Set(dressed.svg.match(/data:[^"]+/g)).size).toBe((dressed.svg.match(/data:[^"]+/g) ?? []).length)
  // The picked one has a ring at its feet.
  expect(big.svg).toContain('stroke="#E08A6A"')
  // Every picture once in the whole floor, and it stays light.
  const uris = big.svg.match(/data:[^"]+/g) ?? []
  expect(new Set(uris).size).toBe(uris.length)
  expect(big.svg.length).toBeLessThan(200_000)
  // A name is escaped.
  expect(floorOf(partyOf(peer('me', 'busy'), [peer('x', 'busy', { title: '<b>&' })], NOW), NOW).svg).toContain('&lt;b&gt;&amp;')
})

test('pictures shared and loops taken out keep their place', async () => {
  expect(shareArt('<image href="data:a" x="1" y="2" width="3" height="4"/><image href="data:a" x="5" y="6" width="7" height="8"/>').body)
    .toBe('<use href="#art0" x="1" y="2" width="3" height="4"/><use href="#art0" x="5" y="6" width="7" height="8"/>')
  expect(stillOf('<g><animate attributeName="opacity" values="0;1" dur="1s" fill="freeze"/><animate attributeName="opacity" values="0;1" dur="1s" repeatCount="indefinite"/></g>'))
    .toBe('<g><animate attributeName="opacity" values="0;1" dur="1s" fill="freeze"/></g>')
})

test('a Mochi shows its status, and while busy what its chat does', async () => {
  const at = (p: Peer) => moodOf({ peer: p, status: statusOf(p, NOW) }, NOW)
  expect(at(peer('a', 'busy', { activity: 'testing' }))).toBe('nervous')
  expect(at(peer('a', 'busy', { activity: 'writing' }))).toBe('writing')
  expect(at(peer('a', 'busy', { activity: '' }))).toBe('thinking')
  expect(at(peer('a', 'asking'))).toBe('asking')
  expect(at(peer('a', 'error'))).toBe('error')
  expect(at(peer('a', 'idle', { limit: { kind: 'five_hour', resetsAt: NOW + MIN } }))).toBe('tired')
  expect(at(peer('a', 'idle', { lastTurn: { at: NOW - MIN, reason: 'answer', seconds: 9 } }))).toBe('proud')
  expect(at(peer('a', 'idle', { stateAt: NOW - MIN }))).toBe('idle')
  expect(at(peer('a', 'idle', { stateAt: NOW - 9 * MIN }))).toBe('sleeping')
})
test('the picked chat in lines: where, what and since when, its subagents, and what cannot be measured', async () => {
  const p = peer('a', 'busy', {
    label: 'mochi', title: 'Agent party', branch: 'agent-party', activity: 'testing', since: NOW - 3 * MIN, line: 'test · npm test', context: 35, cost: 2.5,
    agents: [{ id: 's', type: 'Explore', task: 'Map the code', activity: 'searching', since: NOW - MIN }],
  })
  expect(memberLines({ peer: p, status: 'busy', isSelf: false, isMoving: true }, NOW)).toEqual([
    'a · agent-party',
    'test · npm test · 3m',
    'context 35% · cost $2.50',
    '1 agent',
    '  Explore · Map the code · searching · 1m',
    'Tokens per subagent are not measured.',
  ])
  // An older Mochi's chat says so.
  const old = { ...peer('b', 'idle'), v: undefined, agents: undefined }
  expect(memberLines({ peer: old, status: 'idle', isSelf: false, isMoving: false }, NOW)).toContain('An older Mochi runs in this chat: it tells less.')
})
