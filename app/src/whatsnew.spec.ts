import { expect, test } from 'vitest'

import { bulletsOf, changesOf, isAfter, sectionOf, versionNews, versionOf } from './whatsnew'

const changelog = `# Changelog

## 2.1.331

- Added Code Mode support in terminal sessions on Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry and Claude Platform on AWS
- Added a notice when tap-mode voice dictation stops by itself
- Fixed a crash

## 2.1.330

- Older change`

const codex = '{"tag_name":"rust-v0.172.0","body":"## New Features\\n\\n- Follow thread links from search results. (#62332)\\n- Press `Tab` to complete arguments. (#62343)\\n\\n## Bug Fixes\\n\\n- Fixed one thing (#1)\\n"}'

test('the version is the first run of numbers and dots in what a program printed, and none when there is no such run', () => {
  expect(versionOf('2.1.312 (Claude Code)')).toBe('2.1.312')
  expect(versionOf('codex-cli 0.172.0')).toBe('0.172.0')
  expect(versionOf('not found')).toBe(null)
  expect(versionOf('')).toBe(null)
})

test('a version is after another number by number, so 1.2.10 is after 1.2.9 and equal or older versions are not after', () => {
  expect(isAfter('1.2.10', '1.2.9')).toBe(true)
  expect(isAfter('1.3', '1.2.9')).toBe(true)
  expect(isAfter('1.2', '1.2.0')).toBe(false)
  expect(isAfter('1.2.9', '1.2.10')).toBe(false)
  expect(isAfter('1.2.3', '1.2.3')).toBe(false)
})

test('the section of a version is the text under its heading, up to the next heading of the same depth, and the heading must match the whole version', () => {
  expect(sectionOf(changelog, '2.1.331')).toBe(
    "- Added Code Mode support in terminal sessions on Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry and Claude Platform on AWS\n- Added a notice when tap-mode voice dictation stops by itself\n- Fixed a crash",
  )
  expect(sectionOf(changelog, '2.1.330')).toBe('- Older change')
  expect(sectionOf(changelog, '2.1.33')).toBe('')
  expect(sectionOf(changelog, '9.9.9')).toBe('')
  expect(sectionOf('', '2.1.331')).toBe('')
})

test('a heading with Windows line ends or a space after it is still found, and the section has no carriage returns', () => {
  expect(sectionOf('# Changelog\r\n\r\n## 1.2.3\r\n\r\n- One\r\n- Two\r\n\r\n## 1.2.2\r\n\r\n- Old\r\n', '1.2.3')).toBe('- One\n- Two')
  expect(sectionOf('## 1.2.3 \n\n- One\n', '1.2.3')).toBe('- One')
  expect(sectionOf('## 1.2.33\n\n- X\n', '1.2.3')).toBe('')
})

test('the first bullet points are the lines starting with a dash or a star, without the marker and without a trailing issue number', () => {
  expect(bulletsOf('- one (#12345)\n* two\nnot a bullet\n- three')).toEqual(['one', 'two'])
  expect(bulletsOf('- one\n- two\n- three', 3)).toEqual(['one', 'two', 'three'])
  expect(bulletsOf('')).toEqual([])
})

test('a bullet point longer than the limit is cut to one character less, trimmed at its end, and ends in an ellipsis', () => {
  expect(bulletsOf('- ' + 'a'.repeat(120))).toEqual(['a'.repeat(109) + '…'])
  expect(bulletsOf('- ' + 'a'.repeat(108) + ' bbbb')).toEqual(['a'.repeat(108) + '…'])
  expect(bulletsOf('- ' + 'a'.repeat(20) + ' bbbbbb', 1, 25)).toEqual(['a'.repeat(20) + ' bbb…'])
})

test('the changes of a Claude Code version are its first two bullets, the first one cut to 110 characters', () => {
  expect(changesOf('claude', changelog, '2.1.331')).toEqual([
    "Added Code Mode support in terminal sessions on Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foun…",
    'Added a notice when tap-mode voice dictation stops by itself',
  ])
  expect(changesOf('claude', changelog, '2.1.33')).toEqual([])
})

test('the changes of a Codex release are the first two bullets of its body, and a release that is not JSON or has no text body gives none', () => {
  expect(changesOf('codex', codex, '0.172.0')).toEqual(['Follow thread links from search results.', 'Press `Tab` to complete arguments.'])
  expect(changesOf('codex', 'not json', '0.172.0')).toEqual([])
  expect(changesOf('codex', '{"tag_name":"rust-v0.172.0"}', '0.172.0')).toEqual([])
  expect(changesOf('codex', '', '0.172.0')).toEqual([])
})

test('an agent is fresh only when it has a version now, a version was kept, and the version now is after the kept one', () => {
  expect(versionNews('{"claude":"2.1.300","codex":"0.170.0"}', { claude: '2.1.312', codex: '0.170.0' })).toEqual({
    fresh: ['claude'],
    keep: '{"claude":"2.1.312","codex":"0.170.0"}',
  })
  expect(versionNews('{"claude":"2.1.312","codex":"0.170.0"}', { claude: '2.1.312', codex: '0.170.0' })).toEqual({ fresh: [], keep: null })
})

test('nothing is fresh the first time a version is seen, and the versions seen now are kept', () => {
  expect(versionNews('{"claude":"2.1.300"}', { claude: '2.1.312', codex: '0.172.0' })).toEqual({
    fresh: ['claude'],
    keep: '{"claude":"2.1.312","codex":"0.172.0"}',
  })
  expect(versionNews(null, { claude: '2.1.312', codex: '0.172.0' })).toEqual({
    fresh: [],
    keep: '{"claude":"2.1.312","codex":"0.172.0"}',
  })
  expect(versionNews('not json', { claude: '2.1.312', codex: '0.172.0' })).toEqual({
    fresh: [],
    keep: '{"claude":"2.1.312","codex":"0.172.0"}',
  })
})

test('a kept version stays for an agent that has no version now, and the kept version is not fresh when it is not beaten', () => {
  expect(versionNews('{"claude":"2.1.300","codex":"0.170.0"}', { claude: null, codex: '0.172.0' })).toEqual({
    fresh: ['codex'],
    keep: '{"claude":"2.1.300","codex":"0.172.0"}',
  })
  expect(versionNews('{"claude":"2.1.312"}', { claude: '2.1.300', codex: null })).toEqual({ fresh: [], keep: null })
})

test('the version news does not change the versions it is given', () => {
  const now = { claude: '2.1.312', codex: '0.172.0' as string | null }
  versionNews('{"claude":"2.1.300"}', now)
  expect(now).toEqual({ claude: '2.1.312', codex: '0.172.0' })
})
