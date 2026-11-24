import { isNewer } from '../../hooks/coach'
import type { Words } from './words'

/** What an update row says and what its one button does: put a newer one in, or install one that is not there. */
export type Row = { text: string; action: 'install' | 'update' | null }

/**
 * `have` is null when it is not installed, `latest` null when there is none to offer: GitHub could not be asked
 * (`online` false: the row says so), or it has no release of this kind yet (the row says only what is installed).
 * Either way there is no version to put in.
 */
export function rowOf(have: string | null, latest: string | null, w: Words['update'], online = true): Row {
  if (latest === null) {
    const here = have ?? w.missing
    return { text: online ? here : `${here} · ${w.offline}`, action: null }
  }
  if (have === null) return { text: w.missing, action: 'install' }
  if (isNewer(latest, have)) return { text: `${have} → ${latest}`, action: 'update' }
  return { text: w.upToDate(have), action: null }
}
