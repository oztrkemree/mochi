import { isNewer } from '../../hooks/coach'
import type { Words } from './words'

/** What an update row says and what its one button does: put a newer one in, or install one that is not there. */
export type Row = { text: string; action: 'install' | 'update' | null }

/**
 * `have` is null when it is not installed, `latest` null when GitHub could not be asked.
 * With GitHub out of reach the row says so and offers nothing: there is no version to put in.
 */
export function rowOf(have: string | null, latest: string | null, w: Words['update']): Row {
  if (latest === null) return { text: have === null ? `${w.missing} · ${w.offline}` : `${have} · ${w.offline}`, action: null }
  if (have === null) return { text: w.missing, action: 'install' }
  if (isNewer(latest, have)) return { text: `${have} → ${latest}`, action: 'update' }
  return { text: w.upToDate(have), action: null }
}
