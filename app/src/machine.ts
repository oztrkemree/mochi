/** The computer as it stands: disk space in bytes, the battery (null with none), and the load of the last minute per core (null when unknown). */
export type Machine = { diskFree: number; diskTotal: number; battery: { percent: number; isCharging: boolean } | null; load: number | null }

/** What was already said: the day the disk was said, whether this discharge's low battery was said, and how many looks in a row the computer ran hot (and whether that was said). */
export type Told = { diskDay: string; isBatteryTold: boolean; hotLooks: number; isHotTold: boolean }

/** Nothing has been said yet. */
export const NOTHING_TOLD: Told = { diskDay: '', isBatteryTold: false, hotLooks: 0, isHotTold: false }
/** Free disk below this many bytes (ten gibibytes) is worth saying. */
export const DISK_LOW = 10 * 1024 ** 3
/** A battery at or below this percent, while not charging, is worth saying. */
export const BATTERY_LOW = 10
/** Load per core at or above this counts as hot. */
export const HOT_LOAD = 1.5
/** How many hot looks in a row make the computer worth saying. */
export const HOT_LOOKS = 3

/** The free and whole space of the disk, in bytes, from df's second line; null when it cannot be read. */
export function diskOf(df: string): { free: number; total: number } | null {
  const fields = (df.split('\n')[1] ?? '').trim().split(/\s+/)
  if (fields.length < 4 || !/^\d+$/.test(fields[1]) || !/^\d+$/.test(fields[3])) return null
  return { free: Number(fields[3]) * 1024, total: Number(fields[1]) * 1024 }
}

/** The battery's charge and whether it is charging, from pmset's or Linux's text; null with no battery. */
export function batteryOf(batt: string): { percent: number; isCharging: boolean } | null {
  const mac = /(\d+)%;\s*([A-Za-z ]+);/.exec(batt)
  if (mac) return { percent: Number(mac[1]), isCharging: mac[2].trim().toLowerCase() !== 'discharging' }
  const [first, status] = batt.split('\n').map(s => s.trim())
  if (!first || !/^\d+$/.test(first) || Number(first) > 100 || !status) return null
  return { percent: Number(first), isCharging: status.toLowerCase() !== 'discharging' }
}

/** The load of the last minute per core; null when it cannot be read. */
export function loadOf(load: string, cpus: number): number | null {
  const n = /\d+(\.\d+)?/.exec(load)
  if (!n || !Number.isInteger(cpus) || cpus < 1) return null
  return Number(n[0]) / cpus
}

/** The machine from what Rust handed over. */
export function machineOf(raw: { df: string; batt: string; load: string; cpus: number }): Machine {
  const disk = diskOf(raw.df)
  return { diskFree: disk?.free ?? 0, diskTotal: disk?.total ?? 0, battery: batteryOf(raw.batt), load: loadOf(raw.load, raw.cpus) }
}

/** What is worth saying about the machine now, and what has been said after it. */
export function machineNews(m: Machine, told: Told, today: string): { kinds: ('disk' | 'battery' | 'hot')[]; told: Told } {
  const kinds: ('disk' | 'battery' | 'hot')[] = []

  let diskDay = told.diskDay
  if (m.diskTotal > 0 && m.diskFree < DISK_LOW && told.diskDay !== today) {
    kinds.push('disk')
    diskDay = today
  }

  let isBatteryTold = told.isBatteryTold
  if (m.battery && (m.battery.isCharging || m.battery.percent > 20)) isBatteryTold = false
  if (m.battery && m.battery.percent <= BATTERY_LOW && !m.battery.isCharging && !isBatteryTold) {
    kinds.push('battery')
    isBatteryTold = true
  }

  let hotLooks = told.hotLooks
  let isHotTold = told.isHotTold
  if (m.load === null || m.load < 1) {
    hotLooks = 0
    isHotTold = false
  } else if (m.load >= HOT_LOAD) {
    hotLooks += 1
    if (hotLooks >= HOT_LOOKS && !isHotTold) {
      kinds.push('hot')
      isHotTold = true
    }
  }

  return { kinds, told: { diskDay, isBatteryTold, hotLooks, isHotTold } }
}
