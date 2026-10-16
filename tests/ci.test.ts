import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { ciLine, ciOf, ghTrouble, isPushing, prLine, prOf } from '../hooks/ci'
import { detailSvg, partLines } from '../hooks/detail'
import { setLang } from '../hooks/i18n'
import { panelSvg } from '../hooks/panel'
import { NO_ENV, NO_INFO } from '../hooks/state'

// These speak English; each test sets it, and gives the other files their Turkish back.

const SHA = 'c0ffee'.padEnd(40, '0')
const run = (status: string, conclusion: string, name: string, created = '2026-10-09T10:00:00Z', updated = '2026-10-09T10:03:00Z', event = 'push') =>
  ({ status, conclusion, name, workflowName: name, event, createdAt: created, updatedAt: updated })
const runs = (...list: ReturnType<typeof run>[]) => JSON.stringify(list)

test('gh run list reads into where a push’s CI stands', async () => {
  setLang('en')
  const passed = ciOf(runs(run('completed', 'success', 'build'), run('completed', 'skipped', 'docs', '2026-10-09T10:00:05Z', '2026-10-09T10:00:20Z')), SHA, 1)
  expect(passed).toEqual({
    sha: SHA, pushedAt: 1, state: 'passed', total: 2, done: 2, failed: [],
    startedAt: Date.parse('2026-10-09T10:00:00Z'), endedAt: Date.parse('2026-10-09T10:03:00Z'),
  })
  expect(ciLine(passed!)).toBe('ci passed · 2 checks · 3m')

  const failed = ciOf(runs(run('completed', 'success', 'build'), run('completed', 'failure', 'test'), run('completed', 'cancelled', 'deploy')), SHA, 1)
  expect(failed?.state).toBe('failed')
  expect(failed?.failed).toEqual(['test'])
  expect(ciLine(failed!)).toBe('ci failed · test')
  expect(ciLine(ciOf(runs(run('completed', 'failure', 'test'), run('completed', 'timed_out', 'e2e')), SHA, 1)!)).toBe('ci failed · test +1')

  const going = ciOf(runs(run('completed', 'success', 'build'), run('in_progress', '', 'test'), run('queued', '', 'lint')), SHA, 1)
  expect(going).toEqual({ ...going!, state: 'running', total: 3, done: 1, endedAt: 0 })
  expect(ciLine(going!)).toBe('ci running · 1/3')

  const none = ciOf('[]\n', SHA, 1)
  expect(none).toEqual({ sha: SHA, pushedAt: 1, state: 'waiting', total: 0, done: 0, failed: [], startedAt: 0, endedAt: 0 })
  expect(ciLine(none!)).toBe('ci waiting for runs')
  // A push of a commit already up to date starts nothing new: its old runs do not count.
  expect(ciOf(runs(run('completed', 'success', 'build')), SHA, Date.parse('2026-10-09T11:00:00Z'))?.state).toBe('waiting')
  expect(ciOf(runs(run('completed', 'success', 'build')), SHA, Date.parse('2026-10-09T10:00:40Z'))?.state).toBe('passed')
  // Nor do the runs an issue or a schedule starts on the default branch's commit.
  expect(ciOf(runs(run('completed', 'success', 'build'), run('in_progress', '', 'triage', '2026-10-09T10:01:00Z', '', 'issues')), SHA, 1)?.state).toBe('passed')

  expect(ciOf(runs(run('completed', 'cancelled', 'build'), run('completed', 'success', 'lint')), SHA, 1)?.state).toBe('cancelled')
  for (const bad of ['', 'not json', '{"status":"completed"}', 'null']) expect(ciOf(bad, SHA, 1)).toBe(null)
  setLang('tr')
})

test('gh pr view reads into the open pull request, its review and its checks', async () => {
  const pr = prOf(JSON.stringify({
    number: 12, title: 'Watch CI after a push', state: 'OPEN', reviewDecision: 'CHANGES_REQUESTED',
    statusCheckRollup: [
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS', name: 'build' },
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SKIPPED', name: 'docs' },
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE', name: 'test' },
      { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '', name: 'lint' },
      { __typename: 'StatusContext', state: 'PENDING', context: 'deploy/preview' },
    ],
  }))
  expect(pr).toEqual({ number: 12, title: 'Watch CI after a push', review: 'changes', passed: 2, failed: 1, pending: 2 })
  expect(prOf(JSON.stringify({ number: 3, title: 'old', state: 'MERGED', reviewDecision: 'APPROVED', statusCheckRollup: [] }))).toBe(null)
  expect(prOf(JSON.stringify({ number: 4, title: 'bare', state: 'OPEN' }))).toEqual({ number: 4, title: 'bare', review: '', passed: 0, failed: 0, pending: 0 })
  for (const bad of ['', '[]', 'nope', '{"title":"x","state":"OPEN"}']) expect(prOf(bad)).toBe(null)
})

test('a push is told from a dry run or a deletion, and gh’s troubles from the rest', async () => {
  for (const cmd of ['git push', 'git push -u origin feature', 'git add . && git commit -m x && git push', 'git push --force-with-lease', 'git push && docker run -d web']) {
    expect(isPushing(cmd)).toBe(true)
  }
  for (const cmd of ['git push --dry-run', 'git push -n origin main', 'git push origin --delete old', 'git push -d origin old', 'git pull', 'git status']) {
    expect(isPushing(cmd)).toBe(false)
  }
  expect(ghTrouble(4, 'To get started with GitHub CLI, please run:  gh auth login')).toBe('auth')
  expect(ghTrouble(1, 'none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`')).toBe('notGithub')
  expect(ghTrouble(1, 'failed to run git: fatal: not a git repository (or any of the parent directories): .git')).toBe('notGithub')
  expect(ghTrouble(1, 'no pull requests found for branch "main"')).toBe(null)
  expect(ghTrouble(1, 'error connecting to api.github.com')).toBe(null)
})

test('the details show the last CI and the pull request; the panel shows runs going', async () => {
  setLang('en')
  const ci = ciOf(runs(run('completed', 'success', 'build'), run('completed', 'success', 'test')), SHA, 1)
  const pr = { number: 12, title: 'Watch CI after a push', review: 'approved' as const, passed: 4, failed: 1, pending: 0 }
  const now = Date.parse('2026-10-09T10:08:00Z')
  const env = { ...NO_ENV, ci, pr }
  const svg = detailSvg(env, now, 560)
  for (const part of ['>CI<', 'ci passed · 2 checks · 3m', 'c0ffee0 · 5m ago', 'PR #12 · Watch CI after a push', '>approved<', 'checks 4/5 · 1 failing']) expect(svg).toContain(part)
  expect(partLines(env, now).changes.slice(-2)).toEqual(['ci passed · 2 checks · 3m · 5m ago', 'PR #12 · Watch CI after a push · approved · checks 4/5 · 1 failing'])
  expect(detailSvg(NO_ENV, now, 560)).not.toContain('>CI<')

  const going = ciOf(runs(run('completed', 'success', 'build'), run('in_progress', '', 'test')), SHA, 1)
  const info = { ...NO_INFO, label: 'idle', detail: 'ready', git: { branch: 'main', changed: 0, ahead: 0, behind: 0, lastCommit: 0 }, ci: going }
  const drawn = panelSvg({ panel: { shot: { mood: 'idle', scene: { context: -1, agents: 0 }, at: 1, from: null }, info, infoFrom: null, infoAt: 1 }, now, width: 900 })
  expect(drawn.svg).toContain('ci running · 1/2')
  expect(drawn.svg).toContain('fill="#F2B84B">ci running')
  // Where it would crowd out the branch, it stays out.
  expect(panelSvg({ panel: { shot: { mood: 'idle', scene: { context: -1, agents: 0 }, at: 1, from: null }, info, infoFrom: null, infoAt: 1 }, now, width: 420 }).svg).not.toContain('ci running')
  const done = panelSvg({ panel: { shot: { mood: 'idle', scene: { context: -1, agents: 0 }, at: 1, from: null }, info: { ...info, ci }, infoFrom: null, infoAt: 1 }, now, width: 900 })
  expect(done.svg).not.toContain('ci running')
  // With no run going, the band shows the branch's pull request: its review and checks, red with one failing.
  expect(prLine(pr)).toBe('PR #12 · approved · checks 4/5 · 1 failing')
  expect(prLine({ ...pr, review: '', passed: 0, failed: 0 })).toBe('PR #12 · Watch CI after a push')
  const withPr = panelSvg({ panel: { shot: { mood: 'idle', scene: { context: -1, agents: 0 }, at: 1, from: null }, info: { ...info, ci, pr }, infoFrom: null, infoAt: 1 }, now, width: 900 })
  expect(withPr.svg).toContain('fill="#F0645A">PR #12 · approved · checks 4/5 · 1 failing')
  // While runs go, they come first.
  expect(panelSvg({ panel: { shot: { mood: 'idle', scene: { context: -1, agents: 0 }, at: 1, from: null }, info: { ...info, pr }, infoFrom: null, infoAt: 1 }, now, width: 900 }).svg).not.toContain('PR #12')
  setLang('tr')
})

const BAND = {
  plugin: 'mochi',
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 120, scroll: { offset: 0, bodyRows: 11 }, view: {} },
}
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never
/** Just before the runs above were created. */
const PUSH = Date.UTC(2026, 9, 9, 9, 59, 30)

/**
 * The engine beneath the plugin, the person's gh and git included: `gh.runs` is what `gh run list` prints next, an Error when gh is missing;
 * `gh.pr` what `gh pr view` prints, '' for no pull request, 'slow' for a call cut off at its time limit.
 */
function machine(on: On, gh: { runs: string | Error; pr: string }) {
  const ran: string[][] = []
  mock.store(on, { prefs: { lang: 'en' } })
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/tmp' }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, {}) as RenderElement
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }) as never)
  const prints = (stdout: string, exitCode = 0, stderr = '') => ({ value: { exitCode, stdout, stderr } }) as never
  on('process.run', async ($, e) => {
    ran.push([...e.argv])
    const [cmd, sub] = e.argv
    if (cmd === 'git' && sub === 'rev-parse') return prints(`${SHA}\n`)
    if (cmd === 'gh' && gh.runs instanceof Error) throw gh.runs
    if (cmd === 'gh' && sub === 'pr' && gh.pr === 'slow') {
      await clock.sleep(20_000)
      throw new Error('timed out')
    }
    if (cmd === 'gh' && sub === 'run') return prints(gh.runs as string)
    if (cmd === 'gh' && sub === 'pr') return gh.pr === '' ? prints('', 1, 'no pull requests found for branch "main"') : prints(gh.pr)
    return prints('', 1)
  })
  return { clock, ran }
}

/** Ticks the clock until the band shows `text`, for at most a minute. */
async function until(clock: { advance: (ms: number) => Promise<unknown> }, ui: { find: (q: { text: RegExp }) => Promise<unknown> }, text: RegExp) {
  for (let i = 0; i < 140 && (await ui.find({ text })) === undefined; i++) await clock.advance(450)
  return ui.find({ text })
}

test('after a push the band follows the runs, and a pass ends in a party', { timeoutMs: 20_000 }, async ($, on) => {
  const gh = { runs: '[]', pr: '' }
  const { clock, ran } = machine(on, gh)
  await clock.set(PUSH)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  gh.runs = runs(run('completed', 'success', 'build'), run('in_progress', '', 'test'))
  expect(await until(clock, ui, /ci running · 1\/2/)).toBeDefined()
  expect(ran).toContainEqual(['gh', 'run', 'list', '--commit', SHA, '--json', 'status,conclusion,name,workflowName,event,createdAt,updatedAt'])

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (let i = 0; i < 6; i++) await clock.advance(450)
  expect(String((await desktop.find({ type: 'Svg' }))?.props.source)).toContain('ci running · 1/2')
  await desktop.unmount()

  // Pushed again a while on, already up to date: the commit keeps its watch and its runs.
  for (let i = 0; i < 200; i++) await clock.advance(450)
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  gh.runs = runs(run('completed', 'success', 'build'), run('completed', 'success', 'test', '2026-10-09T10:00:00Z', '2026-10-09T10:02:30Z'))
  const asked = ran.filter(a => a[1] === 'run').length
  expect(await until(clock, ui, /ci passed · 2 checks · 3m/)).toBeDefined()
  // Over, it asks no more.
  for (let i = 0; i < 100; i++) await clock.advance(450)
  expect(ran.filter(a => a[1] === 'run').length).toBe(asked + 1)
  expect(ran.some(a => a[0] === 'notify-send')).toBe(false)
  await ui.unmount()
  setLang('tr')
})

test('a failed run names its workflow and, with no turn running, sends a notification', async ($, on) => {
  const gh = { runs: runs(run('completed', 'success', 'build'), run('completed', 'failure', 'test')), pr: '' }
  const { clock, ran } = machine(on, gh)
  await clock.set(PUSH)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -am fix && git push' })
  expect(await until(clock, ui, /ci failed · test/)).toBeDefined()
  expect(ran.find(a => a[0] === 'notify-send')?.at(-1)).toBe('ci failed · test')
  await ui.unmount()
  setLang('tr')
})

test('/mochi ci turns it all off and on; without gh Mochi stays quiet and the status says why', async ($, on) => {
  const gh: { runs: string | Error; pr: string } = { runs: '[]', pr: JSON.stringify({ number: 7, title: 'Tidy', state: 'OPEN', reviewDecision: 'REVIEW_REQUIRED', statusCheckRollup: [] }) }
  const { clock, ran } = machine(on, gh)
  await clock.set(PUSH)
  await $.session.start(START)
  await clock.advance(450)
  expect((await $.command.run({ command: 'mochi', args: 'status' } as never)).text).toContain('CI: on')
  expect((await $.command.run({ command: 'mochi', args: 'ci' } as never)).text).toBe('CI watch off.')
  const before = ran.filter(a => a[0] === 'gh').length
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  for (let i = 0; i < 80; i++) await clock.advance(450)
  expect(ran.filter(a => a[0] === 'gh').length).toBe(before)
  expect((await $.command.run({ command: 'mochi', args: 'status' } as never)).text).toContain('CI: off')

  gh.runs = new Error('spawn gh ENOENT')
  expect((await $.command.run({ command: 'mochi', args: 'ci' } as never)).text).toContain('CI watch on')
  await clock.advance(450)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  for (let i = 0; i < 80; i++) await clock.advance(450)
  expect(await ui.find({ text: /ci / })).toBeUndefined()
  expect(ran.some(a => a[0] === 'gh' && a[1] === 'run')).toBe(false)
  expect((await $.command.run({ command: 'mochi', args: 'status' } as never)).text).toContain('CI: on · gh is not installed')
  await ui.unmount()
  setLang('tr')
})

test('a question held open keeps its face; the news of the CI comes as a notification', async ($, on) => {
  const gh = { runs: runs(run('completed', 'failure', 'test')), pr: '' }
  const { clock, ran } = machine(on, gh)
  // Beneath Mochi, a settings hook that answers: Mochi never reads the answer (the call's end tells it), so a fixed deny stands in.
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny' } }))
  await clock.set(PUSH)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Bash', command: 'git push' })
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'make deploy' } } as never)
  for (let i = 0; i < 60 && !ran.some(a => a[0] === 'notify-send'); i++) await clock.advance(450)
  expect(ran.find(a => a[0] === 'notify-send')?.at(-1)).toBe('ci failed · test')
  expect(await ui.find({ text: /awaiting approval/ })).toBeDefined()
  await ui.unmount()
  setLang('tr')
})

test('a gh cut off at its time limit met a slow network: gh is not called missing', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock } = machine(on, { runs: '[]', pr: 'slow' })
  await clock.set(PUSH)
  await $.session.start(START)
  for (let i = 0; i < 50; i++) await clock.advance(450)
  const status = (await $.command.run({ command: 'mochi', args: 'status' } as never)).text
  expect(status).toContain('CI: on')
  expect(status).not.toContain('gh is not installed')
  setLang('tr')
})
