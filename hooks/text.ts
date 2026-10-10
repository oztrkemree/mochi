import { lang } from './i18n'

// Text measured as a terminal and the drawings measure it: an East Asian
// wide character (Chinese, Japanese, Korean, full-width forms) takes two
// columns, so a Japanese line clips as early as its width says; a mark that
// sits on the letter before it (Hindi's virama and most vowel signs, Arabic's
// harakat) and an invisible format character take none. In Arabic the
// drawings' lines read right to left.

/**
 * A drawing's style for a language read right to left: each line of text
 * (class `t`) keeps its place, its start and end anchors trading names, and
 * orders its words from the right; code (class `m`) stays as written.
 */
export const rtlStyle = (): string => (lang() === 'ar'
  ? '<style>text.t{direction:rtl;unicode-bidi:embed;text-anchor:end}text.t[text-anchor="end"]{text-anchor:start}text.t[text-anchor="middle"]{text-anchor:middle}</style>'
  : '')

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u
const NONE = /[\p{Mn}\p{Me}\p{Cf}]/u

const width = (ch: string) => (NONE.test(ch) ? 0 : WIDE.test(ch) ? 2 : 1)

/** How many columns the text takes. */
export function cols(s: string): number {
  let n = 0
  for (const ch of s) n += width(ch)
  return n
}

/** The text cut to `max` columns, an ellipsis marking the cut; a letter keeps its marks. */
export function clip(s: string, max: number): string {
  if (cols(s) <= max) return s
  let out = ''
  let n = 0
  for (const ch of s) {
    const w = width(ch)
    if (n + w > Math.max(1, max - 1)) break
    out += ch
    n += w
  }
  return `${out}…`
}
