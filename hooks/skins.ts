// Mochi's colours: thirty-six skins, opened by level. A skin recolours Mochi's
// clay (its body, arms, feet and antenna) through a gradient map that keeps the
// light and the shade of the drawing: five colours from its deepest shade to
// its glint, turning in hue on the way as light does on a real thing. Some lay
// light and colour over the clay as well, kept inside its outline: a glow, a
// run of colours, stitches, stars, frost. Everything is still: drawn once, it
// costs nothing more to show.

export type SkinId =
  | 'clay' | 'sorbet' | 'peach' | 'aurora' | 'cream' | 'rose' | 'lagoon' | 'coral' | 'lemon' | 'dusk' | 'mint' | 'sky'
  | 'opal' | 'lavender' | 'sage' | 'ember' | 'teal' | 'plum' | 'cocoa' | 'charcoal' | 'snow' | 'cherry' | 'ocean' | 'forest'
  | 'sunset' | 'bubblegum' | 'gold' | 'chrome' | 'zombie' | 'ghost' | 'lava' | 'ice' | 'galaxy' | 'neon' | 'rainbow' | 'holo'

export type Skin = {
  id: SkinId
  /** The level that opens it. */
  level: number
  /** The clay's colours, from its deepest shade to its glint; none for Mochi's own clay. */
  map?: string[]
  /** What is laid over the clay: layers, each cut to the body's outline by itself (see `on`). */
  over?: string
  /** The eyes' and mouth's ink, where the clay is too dark for the usual. */
  ink?: string
  /** How much of the clay shows through (a ghost). */
  alpha?: number
  /** The colours a swatch shows it by. */
  swatch: string[]
}

const s = (id: SkinId, level: number, map: string[] | undefined, more: Partial<Skin> = {}): Skin =>
  ({ id, level, map, swatch: map ? [map[3]!, map[2]!, map[1]!] : ['#F2A27E', '#D97757', '#A84E34'], ...more })

/**
 * A layer over the clay, cut to the body's outline (its mask, `bm`) and blended
 * into the clay beneath. Each layer carries the mask itself: one group holding
 * them all would be a picture of its own, and their blend would never reach the clay.
 */
const on = (svg: string, blend = '') => `<g mask="url(#bm)"${blend ? ` style="mix-blend-mode:${blend}"` : ''}>${svg}</g>`
const BOX = 'x="18" y="28" width="64" height="56"'
/** A run of colours across the clay, along a line of its box (top to bottom unless given). */
const wash = (id: string, stops: string[], blend: string, opacity = 1, [x1, y1, x2, y2] = [0, 0, 0, 1]) =>
  on(`<defs><linearGradient id="skin-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${+(i / (stops.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>` +
    `<rect ${BOX} fill="url(#skin-${id})" opacity="${opacity}"/>`, blend)
/** A soft light of one colour on the clay, fading out from its middle. */
const light = (id: string, color: string, cx: number, cy: number, r: number, opacity = 1, blend = 'screen') =>
  on(`<defs><radialGradient id="skin-${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect ${BOX} fill="url(#skin-${id})" opacity="${opacity}"/>`, blend)
/** A four-pointed glint. */
const glint = (cx: number, cy: number, r: number) => {
  const [a, b] = [+(r * 0.27).toFixed(2), +(r * 0.73).toFixed(2)]
  return `<path d="M${cx} ${+(cy - r).toFixed(2)}l${a} ${b} ${b} ${a}-${b} ${a}-${a} ${b}-${a}-${b}-${b}-${a} ${b}-${a}z"/>`
}

/** Stitches across the body, as a zombie has them. */
const STITCHES = '<g stroke="#2E2A20" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".75"><path d="M28 44 L44 41"/><path d="M31 41.6l.8 4.4M35 40.8l.8 4.4M39 40l.8 4.4"/><path d="M58 70 L72 66"/><path d="M61 67.6l.8 4.2M65 66.6l.8 4.2M69 65.6l.8 4.2"/></g><g fill="#3E5A2A" opacity=".45"><ellipse cx="66" cy="44" rx="4.5" ry="3"/><ellipse cx="34" cy="70" rx="3.5" ry="2.4"/></g>'
/** Stars, as on a clear night. */
const STARS = '<g fill="#fff"><circle cx="30" cy="42" r=".7"/><circle cx="41" cy="37" r=".5"/><circle cx="64" cy="40" r=".8"/><circle cx="72" cy="52" r=".5"/><circle cx="27" cy="58" r=".6"/><circle cx="36" cy="74" r=".5"/><circle cx="58" cy="76" r=".7"/><circle cx="70" cy="68" r=".5"/><path d="M47 70l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" opacity=".9"/><path d="M66 58l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" opacity=".8"/></g><ellipse cx="44" cy="62" rx="16" ry="6" fill="#B794F6" opacity=".18" transform="rotate(-20 44 62)"/>'
/** Glowing cracks, as lava cools. */
const CRACKS = '<g fill="none" stroke="#FF8A2B" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M26 48l6 3 2 6-4 5M34 57l7-2 5 4"/><path d="M60 38l3 6 7 2 2 7M63 44l-4 5"/><path d="M50 72l6-3 6 3 3 6M56 69l1-5"/></g><g fill="none" stroke="#FFD27A" stroke-width=".5" stroke-linecap="round" opacity=".9"><path d="M26 48l6 3 2 6M60 38l3 6 7 2M50 72l6-3 6 3"/></g>'
/** Frost, and a glint of ice. */
const FROST = '<g fill="#fff" opacity=".9"><path d="M32 42l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/><path d="M68 62l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/><circle cx="60" cy="40" r=".6"/><circle cx="38" cy="70" r=".6"/></g><path d="M28 40 q6 -6 14 -6" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>'
/** A sheen across the clay, as on polished metal. */
const SHEEN = '<path d="M24 50 C34 36 52 34 66 36 C54 40 40 44 30 58 Z" fill="#fff" opacity=".35"/>'
/** Lines of light, as on a screen. */
const SCAN = '<g stroke="#FF8BFF" stroke-width=".5" opacity=".35"><path d="M18 40h64M18 46h64M18 52h64M18 58h64M18 64h64M18 70h64M18 76h64"/></g><path d="M24 50 C34 38 50 36 62 37" stroke="#7DF9FF" stroke-width="1.4" fill="none" opacity=".6" stroke-linecap="round"/>'
export const SKINS: Skin[] = [
  s('clay', 1, undefined),
  s('sorbet', 2, ['#B4502A', '#F09A3C', '#FFD45E', '#FFEC9A', '#FFFCE0'], {
    over: wash('sorbet', ['#FF6EA8', '#FF9EB4', '#FFFFFF'], 'multiply', 1, [0.2, 0, 0, 0.9]),
    swatch: ['#FF6A7A', '#FF9E4E', '#FFD45E'],
  }),
  s('peach', 3, ['#8A2F2A', '#D9684F', '#F79A78', '#FFC7A3', '#FFF1DC']),
  s('aurora', 4, ['#06122E', '#0E3A5C', '#147A7A', '#4FD0A8', '#D6FFE8'], {
    over: light('aurora-a', '#9B5CFF', 67, 40, 27, 0.9) + light('aurora-b', '#3DFFB0', 33, 70, 22, 0.5) + on(`<g fill="#EFFFF8" opacity=".9">${glint(68, 44, 2.2)}${glint(31, 46, 1.4)}<circle cx="60" cy="74" r=".6"/><circle cx="40" cy="38" r=".5"/></g>`),
    ink: '#F1FFF8', swatch: ['#9B5CFF', '#147A7A', '#4FD0A8'],
  }),
  s('cream', 5, ['#8A5A3C', '#CFA57C', '#EFD5B0', '#FBEBD0', '#FFFDF4']),
  s('rose', 7, ['#7A1F4E', '#C74A78', '#EC7FA0', '#FFB3C4', '#FFE9EA']),
  s('lagoon', 8, ['#0A2A6E', '#0E6FC0', '#1FB6D9', '#7BEBDC', '#F0FFF2'], {
    over: light('lagoon-a', '#C8FFE8', 38, 36, 26, 0.55) + on('<g fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".38"><path d="M26 71q5-3 10 0t10 0"/><path d="M52 76q5-3 10 0t10 0"/><path d="M58 41q4-2.4 8 0t8 0"/></g>', 'soft-light'),
    swatch: ['#7BEBDC', '#1FB6D9', '#0E4FA8'],
  }),
  s('coral', 9, ['#8E1F33', '#DB4545', '#FB6F57', '#FFA583', '#FFE4C8']),
  s('lemon', 11, ['#A0540E', '#E39A1E', '#F8CE3F', '#FFE982', '#FFFBD6']),
  s('dusk', 12, ['#0E0A3A', '#2E1F7A', '#5536B8', '#9A6CF0', '#F0D8FF'], {
    over: light('dusk-a', '#FF4F7A', 50, 30, 42, 1, 'color') + light('dusk-b', '#FFA64F', 50, 27, 26, 0.85),
    swatch: ['#FFB36B', '#F0608A', '#5536B8'],
  }),
  s('mint', 13, ['#145E63', '#2FA98C', '#6FDCAB', '#B2F3CB', '#F1FFE9']),
  s('sky', 15, ['#2A3E9A', '#3F82DC', '#6DB6F7', '#A9DBFF', '#EEFBFF']),
  s('opal', 16, ['#6A6EA0', '#B4B8DC', '#E2E2F2', '#F8F6FF', '#FFFFFF'], {
    over: light('opal-a', '#FF7AC8', 31, 43, 27, 0.85, 'color') + light('opal-b', '#4FE0FF', 70, 52, 27, 0.85, 'color') + light('opal-c', '#5AFFC0', 47, 77, 22, 0.8, 'color') + on(SHEEN, 'soft-light'),
    swatch: ['#FFC2E6', '#F4F2FF', '#B4ECFF', '#C2FFE4'],
  }),
  s('lavender', 17, ['#3B2A90', '#7459DB', '#A78BFA', '#D0BDFF', '#F8EEFF']),
  s('sage', 19, ['#2F4A3C', '#6F8F66', '#A3BB88', '#D3DDB0', '#F8F7DF']),
  s('ember', 20, ['#1A0508', '#4A0E12', '#8E1E18', '#D8482A', '#FFC27A'], {
    over: light('ember-a', '#FF7A1A', 50, 66, 25, 0.75) + light('ember-b', '#FFD25A', 50, 68, 11, 0.6),
    ink: '#2A0A08', swatch: ['#FFB03A', '#D8482A', '#4A0E12'],
  }),
  s('teal', 21, ['#0B3558', '#12808C', '#2BB5A8', '#7FE3CC', '#E0FFF0']),
  s('plum', 23, ['#2C1150', '#6E2E96', '#A052B6', '#D68FD6', '#FFDDF0']),
  s('cocoa', 25, ['#2A120E', '#643726', '#96603F', '#C99670', '#F5DDBB']),
  s('charcoal', 27, ['#0A0A12', '#25262E', '#454752', '#7F8494', '#D0D6E6'], { ink: '#F3EEE9' }),
  s('snow', 29, ['#7C8FB8', '#C2CFE6', '#EAF0F8', '#FAFCFF', '#FFFFFF']),
  s('cherry', 31, ['#4A0624', '#A0122E', '#D82A3E', '#FF6A6A', '#FFD0C0']),
  s('ocean', 33, ['#0A1450', '#1840A8', '#2C6FE0', '#62AEFA', '#D0F4FF']),
  s('forest', 35, ['#0B2A2A', '#1A5C3A', '#2F8F4C', '#7CCB6E', '#E4F7B0']),
  s('sunset', 38, ['#2A0E5A', '#7A2E9E', '#D4488E', '#FF8E7A', '#FFE2B0'], {
    over: light('sunset-a', '#FFA53A', 50, 30, 38, 0.8),
    swatch: ['#FFB347', '#FF6A88', '#8E5CF7'],
  }),
  s('bubblegum', 41, ['#7A2E8E', '#E06AC0', '#FF9AD5', '#FFC8E8', '#FFFFFF'], {
    over: wash('bubblegum', ['#6AC4FF', '#B8A8FF', '#FF9AD5'], 'color', 0.9),
    swatch: ['#8AD0FF', '#C8A8FF', '#FF9AD5'],
  }),
  s('gold', 45, ['#3A1E04', '#9A5E0E', '#E0A82A', '#FFE27A', '#FFFFF0'], {
    over: on(SHEEN, 'soft-light') + on(`<g fill="#FFFBE0">${glint(66, 41, 2.4)}${glint(33, 70, 1.5)}</g>`),
    swatch: ['#FFF1A8', '#E0A82A', '#8A5E0E'],
  }),
  s('chrome', 48, ['#0E1220', '#4A5670', '#A8B4C8', '#EEF4FF', '#FFFFFF'], {
    over: wash('chrome', ['#CFE6FF', '#FFFFFF', '#5A6684', '#D8C0A0', '#FFF6E8'], 'soft-light', 0.7) + on(SHEEN, 'soft-light'),
    swatch: ['#FFFFFF', '#A8B4C8', '#3A4250'],
  }),
  s('zombie', 52, ['#2A1A3A', '#4A5E3A', '#86A85A', '#C6E08E', '#F4FFD0'], { over: on(STITCHES), swatch: ['#C6E08E', '#86A85A', '#3A3A4A'] }),
  s('ghost', 56, ['#5468D8', '#A4BAFF', '#DCE8FF', '#FFFFFF', '#FFFFFF'], { over: light('ghost-a', '#7AF0FF', 50, 80, 30, 0.7), alpha: 0.66, swatch: ['#FFFFFF', '#C4D4FF', '#8AA8F0'] }),
  s('lava', 60, ['#080304', '#1E0A08', '#3E1610', '#8A3018', '#FF8A2B'], {
    over: light('lava-a', '#FF5A1A', 50, 64, 26, 0.45) + on(CRACKS),
    ink: '#FFD9B8', swatch: ['#FF8A2B', '#3E1610', '#120806'],
  }),
  s('ice', 64, ['#1A3E8A', '#4E9EE0', '#A6E0FA', '#E8FAFF', '#FFFFFF'], {
    over: light('ice-a', '#FFFFFF', 36, 38, 22, 0.45) + on(FROST),
    swatch: ['#F4FCFF', '#A6E0FA', '#3A78C8'],
  }),
  s('galaxy', 68, ['#04041A', '#1A1456', '#4A2E9E', '#B06AE8', '#FFD6FF'], {
    over: light('galaxy-a', '#FF4FC8', 35, 44, 23, 0.6) + light('galaxy-b', '#3FD0FF', 67, 70, 24, 0.5) + on(STARS),
    ink: '#F3EEE9', swatch: ['#FF6AD0', '#4A2E9E', '#3FD0FF'],
  }),
  s('neon', 72, ['#0A0420', '#3A0E8A', '#B01AE0', '#FF5AF0', '#FFE0FF'], {
    over: light('neon-a', '#2DF5FF', 72, 74, 26, 0.7) + on(SCAN),
    ink: '#F6E8FF', swatch: ['#FF5AF0', '#8A1AE0', '#2DF5FF'],
  }),
  s('rainbow', 80, ['#6A6A8A', '#B8B8D2', '#E8E8F4', '#FFFFFF', '#FFFFFF'], {
    over: wash('rainbow', ['#FF4E5E', '#FFA63D', '#FFE23D', '#4EDC7A', '#3DB4FF', '#9A6BFF'], 'multiply', 1, [0.15, 0, 0, 1]),
    swatch: ['#FF5E5E', '#FFE84D', '#5EE07A', '#4DB8FF', '#A06BFF'],
  }),
  s('holo', 90, ['#3A3A6A', '#9A96D2', '#D2CCF2', '#F4F0FF', '#FFFFFF'], {
    over: wash('holo', ['#5DF0FF', '#FF8AF0', '#FFF07A', '#7AFFB8', '#7AB0FF'], 'color', 0.9, [0, 0, 1, 0.6]) + on(SHEEN, 'soft-light') + on(`<g fill="#fff">${glint(65, 42, 2.5)}${glint(34, 68, 2.1)}</g>`),
    swatch: ['#7DF9FF', '#FF9AF0', '#FFF59A', '#9AFFC2'],
  }),
]

export const skinOf = (id: unknown): Skin | undefined => SKINS.find(k => k.id === id)

/** The skins open at a level. */
export const skinsAt = (level: number): Skin[] => SKINS.filter(k => k.level <= level)

const ch = (hex: string, at: number) => (Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16) / 255).toFixed(3)

/** The filter that recolours the clay by a skin's gradient map, keeping its light and shade; none for Mochi's own clay. */
export function skinFilter(k: Skin | undefined): string {
  if (!k?.map) return ''
  const map = k.map
  const fn = (c: 'R' | 'G' | 'B', at: number) => `<feFunc${c} type="table" tableValues="${map.map(hex => ch(hex, at)).join(' ')}"/>`
  const alpha = k.alpha ? `<feFuncA type="linear" slope="${k.alpha}"/>` : ''
  // The clay's own greys only run from about .30 to .74: stretched to the whole run here, or the map's shade and glint are never reached and every colour comes out flat.
  const grey = '0.75 1.136 0.386 0 -0.682'
  // Named by the skin: several Mochis on one page share one set of definitions, and the first of a name wins.
  return `<filter id="skin-map-${k.id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${grey}  ${grey}  ${grey}  0 0 0 1 0"/><feComponentTransfer>${fn('R', 0)}${fn('G', 1)}${fn('B', 2)}${alpha}</feComponentTransfer></filter>`
}

/** A colour's swatch for the mod's wardrobe: a dot in its colours, greyed while locked. */
export function swatchSvg(k: Skin, isOpen: boolean): string {
  const stops = k.swatch.map((c, i) => `<stop offset="${k.swatch.length > 1 ? +(i / (k.swatch.length - 1)).toFixed(3) : 0}" stop-color="${c}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="sw-${k.id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>` +
    `<circle cx="16" cy="16" r="13" fill="url(#sw-${k.id})" stroke="#0003"${isOpen ? '' : ' opacity="0.32" style="filter:grayscale(1)"'}/></svg>`
}
