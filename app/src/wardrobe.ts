import type { History, Item, Outfit } from '../../types'
import { type Choice, type Look, type Slot, SLOTS, SLOT_ITEMS, unlocked } from '../../hooks/level'

/**
 * What Mochi wears, chosen in either Mochi. The mod keeps the person's choice
 * in its own store and writes look.json from it; prefs.json carries the choice
 * last made, in the mod or here, so the other Mochi wears it too.
 */

/** The person's choice, slot by slot: an item, null for nothing, no key for Mochi's own pick. */
export type Pick = Partial<Outfit>

/**
 * The look this Mochi wears: what the history opened (the mod's look.json
 * until the history is read), the last choice made in either Mochi where
 * there is one, else the mod's; the birthday and first day only the mod knows.
 */
export function lookNow(history: History | null, modLook: Look | null, prefs: Choice | null, tz: number): Look | null {
  if (history === null && modLook === null) return null
  const items = history ? unlocked(history) : modLook?.items ?? []
  const given = prefs?.pick ?? modLook?.pick ?? {}
  const pick: Pick = {}
  for (const slot of SLOTS) {
    const chosen = given[slot]
    // A choice it can no longer wear is Mochi's to make again.
    if (chosen === null || (chosen !== undefined && items.includes(chosen))) pick[slot] = chosen
  }
  return { pick, items, tz: modLook?.tz ?? tz, birthday: modLook?.birthday ?? '', firstDay: modLook?.firstDay ?? '' }
}

/** The wardrobe: each slot with something open in it, and its items in the order the mod shows them. */
export function shelvesOf(items: readonly Item[]): { slot: Slot; items: Item[] }[] {
  return SLOTS.map(slot => ({ slot, items: SLOT_ITEMS[slot].filter(i => items.includes(i)) })).filter(s => s.items.length > 0)
}

/** A choice with one slot changed: an item, null for nothing, undefined to leave it to Mochi. */
export function chosen(pick: Pick, slot: Slot, item: Item | null | undefined): Pick {
  const next = { ...pick }
  if (item === undefined) delete next[slot]
  else next[slot] = item
  return next
}
