import type { Item } from '../../types'
import { SLOTS } from '../../hooks/level'
import type { Pick } from './wardrobe'

/** How many saved looks are kept at most. */
export const MAX_OUTFITS = 8
/** How many characters a saved look's name may have. */
export const NAME_MAX = 24
/** The storage key saved looks are kept under. */
export const KEY = 'outfits'
/** A look kept under a name. */
export type Saved = { name: string; pick: Pick }

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const chars = (s: string): string[] => [...s]
const clip = (s: string): string => chars(s).slice(0, NAME_MAX).join('')

/** The looks kept, from stored text: each checked, an odd one left out, MAX_OUTFITS at most. */
export function outfitsFrom(text: string | null): Saved[] {
  let data: unknown
  try {
    data = JSON.parse(text ?? '')
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: Saved[] = []
  for (const entry of data) {
    if (!isObj(entry) || typeof entry.name !== 'string' || !isObj(entry.pick)) continue
    const name = entry.name.trim()
    if (name === '' || chars(name).length > NAME_MAX) continue
    const pick: Pick = {}
    for (const slot of SLOTS) {
      const v = entry.pick[slot]
      if (v === null) pick[slot] = null
      else if (typeof v === 'string') pick[slot] = v as Item
    }
    out.push({ name, pick })
  }
  return out.slice(0, MAX_OUTFITS)
}

/** The looks with one more kept, newest first: a look of the same name is replaced; the oldest goes when there are too many. */
export function saved(list: readonly Saved[], name: string, pick: Pick): Saved[] {
  // Cut, then trimmed again, so the stored name is the one outfitsFrom reads back.
  const clean = clip(name.trim()).trim()
  if (clean === '') return [...list]
  return [{ name: clean, pick: { ...pick } }, ...list.filter(s => s.name !== clean)].slice(0, MAX_OUTFITS)
}

/** The looks without the one of this name. */
export function removed(list: readonly Saved[], name: string): Saved[] {
  return list.filter(s => s.name !== name)
}

/** A kept look as it can be worn now: a slot whose item is no longer owned is left to Mochi. */
export function wearable(pick: Pick, items: readonly Item[]): Pick {
  const out: Pick = {}
  for (const slot of SLOTS) {
    const v = pick[slot]
    if (v === null || (v !== undefined && items.includes(v))) out[slot] = v
  }
  return out
}
