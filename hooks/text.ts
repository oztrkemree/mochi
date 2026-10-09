// Text measured as a terminal and the drawings measure it: an East Asian
// wide character (Chinese, Japanese, Korean, full-width forms) takes two
// columns, so a Japanese line clips as early as its width says.

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u

/** How many columns the text takes. */
export function cols(s: string): number {
  let n = 0
  for (const ch of s) n += WIDE.test(ch) ? 2 : 1
  return n
}

/** The text cut to `max` columns, an ellipsis marking the cut. */
export function clip(s: string, max: number): string {
  if (cols(s) <= max) return s
  let out = ''
  let n = 0
  for (const ch of s) {
    const w = WIDE.test(ch) ? 2 : 1
    if (n + w > Math.max(1, max - 1)) break
    out += ch
    n += w
  }
  return `${out}…`
}
