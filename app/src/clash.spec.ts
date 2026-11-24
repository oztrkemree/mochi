import { expect, test } from 'vitest'

import { type Edit, clashKey, clashOf, editOf, kept } from './clash'

const MIN = 60_000
const NOW = 1_760_000_000_000

const edit = (chat: string, path: string, at: number): Edit => ({ chat, path, at })

test('two chats editing the same file within half an hour clash, and the other chat is the one named', () => {
  const edits = [edit('fix-login', '/src/a.ts', NOW)]
  expect(clashOf(edits, edit('api', '/src/a.ts', NOW + 5 * MIN))).toBe('fix-login')
})

test('one chat editing the same file twice is no clash', () => {
  expect(clashOf([edit('api', '/src/a.ts', NOW)], edit('api', '/src/a.ts', NOW + MIN))).toBe(null)
})

test('two chats editing the same file more than 30 minutes apart is no clash', () => {
  expect(clashOf([edit('fix-login', '/src/a.ts', NOW)], edit('api', '/src/a.ts', NOW + 31 * MIN))).toBe(null)
})

test('two chats editing different files is no clash', () => {
  expect(clashOf([edit('fix-login', '/src/a.ts', NOW)], edit('api', '/src/b.ts', NOW + MIN))).toBe(null)
})

test('the latest other chat that edited the file is the one named when several did', () => {
  const edits = [edit('first', '/src/a.ts', NOW), edit('second', '/src/a.ts', NOW + 10 * MIN)]
  expect(clashOf(edits, edit('api', '/src/a.ts', NOW + 12 * MIN))).toBe('second')
})

test('kept drops edits older than 30 minutes and replaces the older edit of the same chat and file', () => {
  const edits = [edit('old', '/src/a.ts', NOW), edit('api', '/src/a.ts', NOW + MIN), edit('api', '/src/a.ts', NOW + 20 * MIN), edit('fix-login', '/src/b.ts', NOW + 31 * MIN)]
  expect(kept(edits, edit('fix-login', '/src/b.ts', NOW + 32 * MIN))).toEqual([
    edit('api', '/src/a.ts', NOW + 20 * MIN),
    edit('fix-login', '/src/b.ts', NOW + 32 * MIN),
  ])
})

test('editOf names the file of a finished Edit, Write or MultiEdit call of a chat', () => {
  const event = { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: '/src/a.ts' } }
  expect(editOf('api', 'PostToolUse', event, NOW)).toEqual({ chat: 'api', path: '/src/a.ts', at: NOW })
  expect(editOf('api', 'PostToolUse', { tool_name: 'NotebookEdit', tool_input: { file_path: '/n.ipynb' } }, NOW)).toBe(null)
})

test('editOf ignores other hooks, other tools, and a call with no file path', () => {
  const edit = { tool_name: 'Edit', tool_input: { file_path: '/src/a.ts' } }
  expect(editOf('api', 'PreToolUse', edit, NOW)).toBe(null)
  expect(editOf('api', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' } }, NOW)).toBe(null)
  expect(editOf('api', 'PostToolUse', { tool_name: 'Write', tool_input: { file_path: '' } }, NOW)).toBe(null)
  expect(editOf('api', 'PostToolUse', { tool_name: 'Write', tool_input: { file_path: 7 } }, NOW)).toBe(null)
  expect(editOf('api', 'PostToolUse', { tool_name: 'Write' }, NOW)).toBe(null)
})

test('a clash has one key whichever chat came first, so it is said once', () => {
  expect(clashKey('b', 'a', '/f')).toBe(clashKey('a', 'b', '/f'))
  expect(clashKey('a', 'b', '/f')).not.toBe(clashKey('a', 'b', '/g'))
})
