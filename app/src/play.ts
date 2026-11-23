/**
 * Mochi's layers played between moves (see layersFor in hooks/rig.ts): each
 * layer carries its keyframes as numbers, and the app sets its transform at a
 * frame rate of its own, a clay figure's stop motion rather than a screen's
 * sixty a second, which a see-through window always on top pays for in full.
 */

/** One layer's keyframes: `tpl` with `{i}` filled by a frame's numbers, at `times` (0 to 1) over `dur` seconds. */
export type Track = { tpl: string; frames: number[][]; times: number[]; dur: number }

/** Frames a second the layers are played at. */
export const LIVE_FPS = 12

/** A layer's transform `s` seconds into its loop, eased in and out between keyframes. */
export function frameAt(t: Track, s: number): string {
  const phase = ((s % t.dur) + t.dur) % t.dur / t.dur
  let i = 0
  while (i < t.times.length - 2 && phase >= (t.times[i + 1] ?? 1)) i++
  const from = t.times[i] ?? 0
  const span = (t.times[i + 1] ?? 1) - from
  const k = span > 0 ? Math.min(1, Math.max(0, (phase - from) / span)) : 0
  const eased = k * k * (3 - 2 * k)
  const a = t.frames[i] ?? []
  const b = t.frames[i + 1] ?? a
  return t.tpl.replace(/\{(\d+)\}/g, (_, j: string) => {
    const x = a[Number(j)] ?? 0
    return String(Math.round((x + ((b[Number(j)] ?? x) - x) * eased) * 1000) / 1000)
  })
}

/** The tracks of the layers in a drawing; none in one without them. */
export function tracksIn(root: ParentNode): (Track & { el: HTMLElement })[] {
  return [...root.querySelectorAll<HTMLElement>('[data-tpl]')].flatMap(el => {
    try {
      const t = { el, tpl: el.dataset.tpl ?? '', frames: JSON.parse(el.dataset.frames ?? '[]') as number[][], times: JSON.parse(el.dataset.times ?? '[]') as number[], dur: Number(el.dataset.dur) }
      return t.dur > 0 && t.frames.length >= 2 && t.times.length === t.frames.length ? [t] : []
    } catch {
      return []
    }
  })
}
