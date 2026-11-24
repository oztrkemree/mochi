/**
 * Mochi's layers played between moves (see layersFor in hooks/rig.ts): each
 * layer carries its keyframes as numbers, and the app hands them to the
 * compositor as an animation of the layer's transform. The compositor plays it
 * at the screen's own rate without drawing the layer again, so a fast loop (a
 * typing arm's 0.3 s, a giggle's 0.16 s) moves as the rig draws it, not in
 * stray samples of it, and costs next to nothing.
 */

/** One layer's keyframes: `tpl` with `{i}` filled by a frame's numbers, at `times` (0 to 1) over `dur` seconds, each step eased by `ease` when given. */
export type Track = { tpl: string; frames: number[][]; times: number[]; dur: number; ease?: number[][] }

/** A layer's loop as an animation: from keyframe to keyframe eased as the rig's SMIL eases it (its keySplines), else straight. */
export function animationOf(t: Track): { keyframes: { offset: number; transform: string; easing?: string }[]; options: { duration: number; iterations: number; easing: string } } {
  return {
    keyframes: t.frames.map((f, i) => ({
      offset: t.times[i] ?? i / (t.frames.length - 1),
      transform: t.tpl.replace(/\{(\d+)\}/g, (_, j: string) => String(f[Number(j)] ?? 0)),
      ...(t.ease?.[i] ? { easing: `cubic-bezier(${t.ease[i].join(', ')})` } : {}),
    })),
    options: { duration: t.dur * 1000, iterations: Infinity, easing: 'linear' },
  }
}

/** The tracks of the layers in a drawing; none in one without them. */
export function tracksIn(root: ParentNode): (Track & { el: HTMLElement })[] {
  return [...root.querySelectorAll<HTMLElement>('[data-tpl]')].flatMap(el => {
    try {
      const t = { el, tpl: el.dataset.tpl ?? '', frames: JSON.parse(el.dataset.frames ?? '[]') as number[][], times: JSON.parse(el.dataset.times ?? '[]') as number[], dur: Number(el.dataset.dur), ...(el.dataset.ease ? { ease: JSON.parse(el.dataset.ease) as number[][] } : {}) }
      return t.dur > 0 && t.frames.length >= 2 && t.times.length === t.frames.length ? [t] : []
    } catch {
      return []
    }
  })
}
