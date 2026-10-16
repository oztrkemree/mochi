import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never
const BAND = {
  plugin: 'mochi',
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120, scroll: { offset: 0, bodyRows: 11 }, view: {} },
}

/** The engine beneath: the old Mochi's store, the settings (Mochi Buddy on or not) and a `claude` that succeeds or fails. */
function machine(on: On, opts: { isBuddyOn: boolean; exitCode: number; lang?: string }) {
  const ran: string[][] = []
  const toasts: string[] = []
  const registered: string[] = []
  mock.store(on, { prefs: { lang: opts.lang ?? 'en' } })
  on('session.start', () => ({ cwd: '/tmp' }))
  on('command.register', ($, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('command.run', () => ({ text: 'Mochi Buddy answered' }) as never)
  on('settings.read', () => ({ value: { enabledPlugins: { 'mochi@mochi': true, 'mochi-buddy@mochi': opts.isBuddyOn } } }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, {}) as RenderElement
  })
  on('process.run', ($, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: opts.exitCode, stdout: '', stderr: '' } } as never
  })
  return { ran, toasts, registered }
}

test('the old Mochi says it is now Mochi Buddy, and Move installs it and removes the old one', async ($, on) => {
  const { ran, toasts, registered } = machine(on, { isBuddyOn: false, exitCode: 0 })
  await $.session.start(START)
  expect(registered).toEqual(['mochi'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ text: 'Mochi is now Mochi Buddy. Move over to keep your settings, level and wardrobe.' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'move' })
  expect(ran).toEqual([['claude', 'plugin', 'install', 'mochi-buddy@mochi'], ['claude', 'plugin', 'uninstall', 'mochi@mochi']])
  expect(toasts).toEqual(['Mochi Buddy is installed and the old Mochi removed. Restart Claude Code to meet it.'])
  await ui.unmount()
})

test('/mochi says how to move; /mochi move gives the commands to run by hand when claude cannot', async ($, on) => {
  const { ran } = machine(on, { isBuddyOn: false, exitCode: 1, lang: 'tr' })
  await $.session.start(START)
  expect((await $.command.run({ command: 'mochi', args: '' } as never)).text).toContain('Mochi artık Mochi Buddy.')
  const answer = (await $.command.run({ command: 'mochi', args: 'move' } as never)).text
  expect(answer).toContain('claude plugin install mochi-buddy@mochi')
  expect(answer).toContain('claude plugin uninstall mochi@mochi')
  // A failed install removes nothing.
  expect(ran).toEqual([['claude', 'plugin', 'install', 'mochi-buddy@mochi']])
})

test('with Mochi Buddy on, the old Mochi draws nothing, registers nothing and leaves /mochi to it', async ($, on) => {
  const { ran, registered } = machine(on, { isBuddyOn: true, exitCode: 0 })
  await $.session.start(START)
  expect(registered).toEqual([])
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'move' })).toBeUndefined()
  await ui.unmount()
  expect((await $.command.run({ command: 'mochi', args: 'move' } as never)).text).toBe('Mochi Buddy answered')
  expect(ran).toEqual([])
})
