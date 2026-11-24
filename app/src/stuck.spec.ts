import { expect, test } from 'vitest'

import { type Run, stepStuck, tryOf } from './stuck'

const TEST = { tool_name: 'Bash', tool_input: { command: 'npm test' } }
const EDIT = { tool_name: 'Edit', tool_input: { file_path: 'src/a.ts' } }
const FAIL = 'PostToolUseFailure'
const OK = 'PostToolUse'

test('a step that fails three times in a row says the chat is stuck, on the third try only', () => {
  const a = stepStuck(undefined, FAIL, TEST)
  const b = stepStuck(a.run, OK, EDIT)
  const c = stepStuck(b.run, FAIL, TEST)
  const d = stepStuck(c.run, OK, EDIT)
  const e = stepStuck(d.run, FAIL, TEST)
  expect([a.isStuck, c.isStuck, e.isStuck]).toEqual([false, false, true])
  expect(e.run).toEqual({ key: 'Bash\nnpm test', fails: 3, told: true })
})

test('a fourth failure of the same step is not said again', () => {
  const run: Run = { key: 'Bash\nnpm test', fails: 3, told: true }
  expect(stepStuck(run, FAIL, TEST)).toEqual({ run: { key: 'Bash\nnpm test', fails: 4, told: true }, isStuck: false })
})

test('the same step passing again clears the run', () => {
  const run: Run = { key: 'Bash\nnpm test', fails: 2, told: false }
  expect(stepStuck(run, OK, TEST).run).toBeUndefined()
})

test('a passing call of another step leaves a run of failures as it was', () => {
  const run: Run = { key: 'Bash\nnpm test', fails: 2, told: false }
  expect(stepStuck(run, OK, EDIT)).toEqual({ run, isStuck: false })
  expect(stepStuck(run, 'PreToolUse', TEST)).toEqual({ run, isStuck: false })
})

test('a prompt from the person or the end of the chat clears the run', () => {
  const run: Run = { key: 'Bash\nnpm test', fails: 2, told: false }
  expect(stepStuck(run, 'UserPromptSubmit', {}).run).toBeUndefined()
  expect(stepStuck(run, 'SessionEnd', {}).run).toBeUndefined()
})

test('a different failing command starts a new run at one failure, not stuck', () => {
  const run: Run = { key: 'Bash\nnpm test', fails: 2, told: false }
  expect(stepStuck(run, FAIL, { tool_name: 'Bash', tool_input: { command: 'npm run build' } })).toEqual({
    run: { key: 'Bash\nnpm run build', fails: 1, told: false },
    isStuck: false,
  })
})

test('a step is named by its tool and its command, or its file when it has no command', () => {
  expect(tryOf(FAIL, TEST)).toEqual({ key: 'Bash\nnpm test', failed: true })
  expect(tryOf(OK, EDIT)).toEqual({ key: 'Edit\nsrc/a.ts', failed: false })
})

test('only the tool results of a call are tries; other hook events and calls without a tool name are not', () => {
  expect(tryOf('PreToolUse', TEST)).toBeNull()
  expect(tryOf(OK, { tool_input: { command: 'npm test' } })).toBeNull()
  expect(tryOf(OK, { tool_name: 7 })).toBeNull()
})

test('a command or file that is not text is left out of the step, and a missing input is read as empty', () => {
  expect(tryOf(OK, { tool_name: 'Bash', tool_input: { command: 3 } })).toEqual({ key: 'Bash\n', failed: false })
  expect(tryOf(OK, { tool_name: 'Read' })).toEqual({ key: 'Read\n', failed: false })
})
