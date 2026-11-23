import { expect, test } from 'vitest'

import { dangers } from '../../hooks/guard'
import { setLang } from '../../hooks/i18n'
import list from '../src-tauri/shield-words.json'
import mochiTests from '../../tests/mochi.test.ts?raw'
import shieldTests from '../../tests/shield.test.ts?raw'
import { useRules, verdictOf } from './shield'

setLang('en')

/** The hook's word filter, as agents.rs runs it. */
const mightDestroy = (command: string) => {
  const c = command.toLowerCase()
  return c.split(/[^\p{L}\p{N}_-]/u).some(w => list.whole.includes(w)) || list.anywhere.some(w => c.includes(w))
}

test('every command the mod’s shield names in its own tests has a word the hook waits on', () => {
  const corpus = [shieldTests, mochiTests].flatMap(text => {
    return [...text.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)].map(m => (m[1] ?? m[2] ?? '').replace(/\\(.)/g, '$1'))
  })
  const named = corpus.filter(cmd => cmd.length > 1 && dangers(cmd).length > 0)
  expect(named.length).toBeGreaterThan(60)
  expect(named.filter(cmd => !mightDestroy(cmd))).toEqual([])
})

test('a command that would destroy something is named; one too long to read whole is asked about too', () => {
  useRules(null)
  expect(verdictOf({ tool_input: { command: 'git push --force origin main' } })).toBe('overwrites the remote branch’s history')
  expect(verdictOf({ tool_input: { command: 'npm test' } })).toBeNull()
  expect(verdictOf({ tool_input: { command: 'ls', cut: true } })).toBe('a command too long for Mochi to read whole')
  expect(verdictOf({})).toBeNull()
  // The person's own rules count, as in the mod.
  useRules('{"add":[{"match":"make deploy","says":"deploys to production"}]}')
  expect(verdictOf({ tool_input: { command: 'make deploy' } })).toBe('deploys to production')
  useRules(null)
  expect(verdictOf({ tool_input: { command: 'make deploy' } })).toBeNull()
})
