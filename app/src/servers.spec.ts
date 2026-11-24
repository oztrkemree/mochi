import { expect, test } from 'vitest'

import { type Server, agesOf, foldersOf, forgotten, isDevCommand, listeningOf, serverKey, serverName, serversOf } from './servers'

const LSOF = [
  'p666', 'cControlCenter', 'f9', 'n*:7000', 'f10', 'n*:7000',
  'p4242', 'cnode', 'f23', 'n127.0.0.1:5173', 'f24', 'n[::1]:5173',
  'p5000', 'cpython3.12', 'f5', 'n*:8000',
  'p77', 'cnode', 'f30', 'n*:80',
].join('\n')

const PS = [' 4242 02-03:11:36', ' 5000       00:42', '   77    1:05:09'].join('\n')

const CWD = ['p4242', 'fcwd', 'n/Users/sam/code/shop-web', 'p5000', 'fcwd', 'n/Users/sam/code/api'].join('\n')

const SHOP: Server = { pid: 4242, command: 'node', port: 5173, seconds: 184296, folder: '/Users/sam/code/shop-web' }
const API: Server = { pid: 5000, command: 'python3.12', port: 8000, seconds: 42, folder: '/Users/sam/code/api' }

test('a command is a dev server when it is a known runtime, with or without a version, in any letter case, and nodemon is not', () => {
  expect(['node', 'python3.12', 'node22', 'NODE', 'vite', 'nodemon', 'ControlCenter'].map(isDevCommand)).toEqual([true, true, true, true, true, false, false])
})

test('listening sockets are read from lsof output, each process and port once, and bad pids or ports are skipped', () => {
  expect(listeningOf(LSOF)).toEqual([
    { pid: 666, command: 'ControlCenter', port: 7000 },
    { pid: 4242, command: 'node', port: 5173 },
    { pid: 5000, command: 'python3.12', port: 8000 },
    { pid: 77, command: 'node', port: 80 },
  ])
  expect(listeningOf('p0\ncnode\nn*:3000\np12\ncnode\nn*:70000\np13\ncnode\nnnot-an-address')).toEqual([])
})

test('the age of each process is read from ps output in seconds, days included', () => {
  expect([...agesOf(PS)]).toEqual([[4242, 184296], [5000, 42], [77, 3909]])
})

test('the folder of each process is read from lsof cwd output', () => {
  expect([...foldersOf(CWD)]).toEqual([
    [4242, '/Users/sam/code/shop-web'],
    [5000, '/Users/sam/code/api'],
  ])
})

test('the dev servers running now are the dev commands on ports from 1024 up, lowest port first, with their age and folder', () => {
  expect(serversOf(LSOF, PS, CWD)).toEqual([SHOP, API])
})

test('empty text gives no servers and no ages or folders', () => {
  expect(listeningOf('')).toEqual([])
  expect(agesOf('').size).toBe(0)
  expect(foldersOf('').size).toBe(0)
  expect(serversOf('', '', '')).toEqual([])
})

test('a server that ran a day or more and was not said yet is forgotten, and once said it is not', () => {
  expect(forgotten([SHOP, API], [])).toEqual([SHOP])
  expect(forgotten([SHOP, API], [serverKey(SHOP)])).toEqual([])
  expect(serverKey(SHOP)).toBe('4242:5173')
})

test('a server is named by the last part of its folder, or by its command when it has no folder', () => {
  expect(serverName(SHOP)).toBe('shop-web')
  expect(serverName({ ...API, folder: 'C:\\code\\api' })).toBe('api')
  expect(serverName({ ...API, folder: '' })).toBe('python3.12')
})
