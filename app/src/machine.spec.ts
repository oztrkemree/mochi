import { expect, test } from 'vitest'

import { type Machine, NOTHING_TOLD, batteryOf, diskOf, loadOf, machineNews, machineOf } from './machine'

const DF = 'Filesystem   1024-blocks      Used Available Capacity  iused      ifree %iused  Mounted on\n/dev/disk3s5   971350180 838109536 104354536    89% 10407721 1043545360    1%   /System/Volumes/Data'
const PMSET = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=24772707)\t87%; discharging; 3:10 remaining present: true"
const LOAD = '{ 9.66 8.81 7.78 }'
const DAY = '2026-11-24'

const machine = (over: Partial<Machine> = {}): Machine => ({ diskFree: 107374182400, diskTotal: 107374182400, battery: null, load: null, ...over })

test('the disk is read from the second line of df, in bytes', () => {
  expect(diskOf(DF)).toEqual({ free: 106859044864, total: 994662584320 })
})

test('a df text without four columns on its second line gives no disk', () => {
  expect(diskOf('')).toBeNull()
  expect(diskOf('Filesystem 1024-blocks\n/dev/disk3s5 971350180')).toBeNull()
  expect(diskOf('Filesystem 1K-blocks Used Available\n/dev/sda1 x 1 y')).toBeNull()
})

test('a Mac battery is read from pmset, and it is charging unless pmset says discharging', () => {
  expect(batteryOf(PMSET)).toEqual({ percent: 87, isCharging: false })
  expect(batteryOf("Now drawing from 'AC Power'\n -InternalBattery-0 (id=24772707)\t100%; charged; 0:00 remaining present: true")).toEqual({ percent: 100, isCharging: true })
  expect(batteryOf("Now drawing from 'AC Power'\n -InternalBattery-0 (id=24772707)\t45%; AC attached; 0:00 remaining present: true")).toEqual({ percent: 45, isCharging: true })
})

test('a Linux battery is read from its capacity line and its status line', () => {
  expect(batteryOf('87\nDischarging')).toEqual({ percent: 87, isCharging: false })
  expect(batteryOf('87\nCharging')).toEqual({ percent: 87, isCharging: true })
})

test('a computer with no battery text gives no battery', () => {
  expect(batteryOf('')).toBeNull()
  expect(batteryOf("Now drawing from 'AC Power'")).toBeNull()
})

test('the load is the first load number divided by the number of cores, and nothing without cores or text', () => {
  expect(loadOf(LOAD, 10)).toBeCloseTo(0.966)
  expect(loadOf('9.66 8.81 7.78 3/1234 5678', 4)).toBeCloseTo(2.415)
  expect(loadOf('', 4)).toBeNull()
  expect(loadOf(LOAD, 0)).toBeNull()
})

test('the machine is built from the four texts, and an unreadable disk counts as no space at all', () => {
  const m = machineOf({ df: DF, batt: PMSET, load: LOAD, cpus: 10 })
  expect(m.load).toBeCloseTo(0.966)
  expect({ ...m, load: null }).toEqual({ diskFree: 106859044864, diskTotal: 994662584320, battery: { percent: 87, isCharging: false }, load: null })
  expect(machineOf({ df: '', batt: '', load: '', cpus: 10 })).toEqual({ diskFree: 0, diskTotal: 0, battery: null, load: null })
})

test('a low disk is reported once a day, and again on the next day', () => {
  const low = machine({ diskFree: 5368709120, diskTotal: 107374182400 })
  const first = machineNews(low, NOTHING_TOLD, DAY)
  expect(first.kinds).toEqual(['disk'])
  expect(first.told.diskDay).toBe(DAY)
  expect(machineNews(low, first.told, DAY).kinds).toEqual([])
  expect(machineNews(low, first.told, '2026-11-25').kinds).toEqual(['disk'])
})

test('a disk with enough space, or one that cannot be read, is never reported as low', () => {
  expect(machineNews(machine(), NOTHING_TOLD, DAY).kinds).toEqual([])
  expect(machineNews(machine({ diskFree: 0, diskTotal: 0 }), NOTHING_TOLD, DAY).kinds).toEqual([])
})

test('a low battery is reported once per discharge, and again after it has been charged', () => {
  const low = machine({ battery: { percent: 10, isCharging: false } })
  const first = machineNews(low, NOTHING_TOLD, DAY)
  expect(first.kinds).toEqual(['battery'])
  expect(first.told.isBatteryTold).toBe(true)
  expect(machineNews(low, first.told, DAY).kinds).toEqual([])
  const charging = machineNews(machine({ battery: { percent: 12, isCharging: true } }), first.told, DAY)
  expect(charging.kinds).toEqual([])
  expect(charging.told.isBatteryTold).toBe(false)
  expect(machineNews(low, charging.told, DAY).kinds).toEqual(['battery'])
})

test('a hot computer is reported only after three looks in a row, and once', () => {
  const hot = machine({ load: 1.6 })
  const r1 = machineNews(hot, NOTHING_TOLD, DAY)
  const r2 = machineNews(hot, r1.told, DAY)
  const r3 = machineNews(hot, r2.told, DAY)
  const r4 = machineNews(hot, r3.told, DAY)
  expect([r1.kinds, r2.kinds, r3.kinds, r4.kinds]).toEqual([[], [], ['hot'], []])
})

test('a look between one and one and a half changes nothing, and a quiet look starts the count again', () => {
  const told = { diskDay: '', isBatteryTold: false, hotLooks: 2, isHotTold: false }
  expect(machineNews(machine({ load: 1.2 }), told, DAY).told).toEqual(told)
  expect(machineNews(machine({ load: 0.5 }), told, DAY).told).toEqual({ diskDay: '', isBatteryTold: false, hotLooks: 0, isHotTold: false })
})
