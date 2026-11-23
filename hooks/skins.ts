// Mochi's colours: thirty skins, opened by level. A skin recolours Mochi's
// clay (its body, arms, feet and antenna) through a gradient map that keeps the
// light and the shade of the drawing: its darkest, middle and lightest colour.
// The last ones lay something over the clay as well, kept inside its outline:
// stitches, stars, cracks, frost, a sheen. Everything is still: drawn once, it
// costs nothing more to show.

export type SkinId =
  | 'clay' | 'peach' | 'cream' | 'rose' | 'coral' | 'lemon' | 'mint' | 'sky' | 'lavender' | 'sage'
  | 'teal' | 'plum' | 'cocoa' | 'charcoal' | 'snow' | 'cherry' | 'ocean' | 'forest' | 'sunset' | 'bubblegum'
  | 'gold' | 'chrome' | 'zombie' | 'ghost' | 'lava' | 'ice' | 'galaxy' | 'neon' | 'rainbow' | 'holo'

export type Skin = {
  id: SkinId
  /** The level that opens it. */
  level: number
  /** The clay's darkest, middle and lightest colour; none for Mochi's own clay. */
  map?: [string, string, string]
  /** What is laid over the clay, inside its outline (the body's mask, `bm`). */
  over?: string
  /** The eyes' and mouth's ink, where the clay is too dark for the usual. */
  ink?: string
  /** How much of the clay shows through (a ghost). */
  alpha?: number
  /** The colour a swatch shows it by: one colour, or a gradient's stops. */
  swatch: string[]
}

const s = (id: SkinId, level: number, map: [string, string, string] | undefined, more: Partial<Skin> = {}): Skin => ({ id, level, map, swatch: [map?.[1] ?? '#D97757'], ...more })

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
/** A gradient's stops laid on the clay in its own colours. */
const tint = (id: string, stops: string[], opacity: number, angle = 0) =>
  `<defs><linearGradient id="skin-${id}" x1="0" y1="0" x2="${angle ? 1 : 0}" y2="${angle ? 0 : 1}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>` +
  `<rect x="18" y="28" width="64" height="56" fill="url(#skin-${id})" opacity="${opacity}" style="mix-blend-mode:color"/>`

export const SKINS: Skin[] = [
  s('clay', 1, undefined),
  s('peach', 3, ['#9A5032', '#F09A72', '#FFD2B8']),
  s('cream', 5, ['#8C7154', '#E8D2B2', '#FFF6E6']),
  s('rose', 7, ['#8E3A4E', '#E07A92', '#FFC4D2']),
  s('coral', 9, ['#9A3428', '#F06A54', '#FFB8A6']),
  s('lemon', 11, ['#8C6A10', '#F2C94C', '#FFF2B0']),
  s('mint', 13, ['#2E6E58', '#6FD3A8', '#C8F5E2']),
  s('sky', 15, ['#2E5A8E', '#6FB2F0', '#CFE8FF']),
  s('lavender', 17, ['#4E3A86', '#A78BFA', '#E2D8FF']),
  s('sage', 19, ['#4A5A3A', '#9CB083', '#DCE6CC']),
  s('teal', 21, ['#11504E', '#2BA6A0', '#9EE6DE']),
  s('plum', 23, ['#3E1A44', '#8E4A9E', '#D8A8E2']),
  s('cocoa', 25, ['#3A2216', '#8A5A3E', '#D2A88A']),
  s('charcoal', 27, ['#141416', '#45464C', '#8E9098'], { ink: '#F3EEE9' }),
  s('snow', 29, ['#9AA4B2', '#E6EBF2', '#FFFFFF']),
  s('cherry', 31, ['#5A0E16', '#C8283A', '#FF8A96']),
  s('ocean', 33, ['#0E2A5A', '#2A62C8', '#8AB8FF']),
  s('forest', 35, ['#14361E', '#2E7A44', '#8AD49E']),
  s('sunset', 38, ['#6E2A1A', '#E8875A', '#FFD8A8'], { over: tint('sunset', ['#FFB347', '#FF6A88', '#8E5CF7'], 0.75), swatch: ['#FFB347', '#FF6A88', '#8E5CF7'] }),
  s('bubblegum', 41, ['#7A4A6E', '#F2A6D2', '#FFE2F2'], { over: tint('bubblegum', ['#FF9AD5', '#9AD8FF'], 0.7, 1), swatch: ['#FF9AD5', '#9AD8FF'] }),
  s('gold', 45, ['#4A3008', '#D4A029', '#FFF4BE'], { over: SHEEN, swatch: ['#FFF1A8', '#D4A029', '#8A5E0E'] }),
  s('chrome', 48, ['#20252E', '#9AA6B6', '#FFFFFF'], { over: SHEEN, swatch: ['#FFFFFF', '#9AA6B6', '#3A4250'] }),
  s('zombie', 52, ['#26381C', '#7E9E58', '#CFE6A8'], { over: STITCHES, swatch: ['#7E9E58', '#4E6A36'] }),
  s('ghost', 56, ['#9AA6BA', '#E6ECF6', '#FFFFFF'], { alpha: 0.58, swatch: ['#FFFFFF', '#C9D3E2'] }),
  s('lava', 60, ['#120806', '#3A1A12', '#7A3A26'], { over: CRACKS, ink: '#FFD9B8', swatch: ['#3A1A12', '#FF8A2B'] }),
  s('ice', 64, ['#2A5E80', '#9AD6F2', '#F4FCFF'], { over: FROST, swatch: ['#F4FCFF', '#9AD6F2', '#4A90B8'] }),
  s('galaxy', 68, ['#06061E', '#2A2066', '#7E6AE8'], { over: STARS, ink: '#F3EEE9', swatch: ['#2A2066', '#7E6AE8', '#06061E'] }),
  s('neon', 72, ['#14061E', '#8A1AE0', '#FF7AF6'], { over: SCAN, ink: '#F6E8FF', swatch: ['#FF7AF6', '#8A1AE0', '#7DF9FF'] }),
  s('rainbow', 80, ['#5A5A66', '#C8C8D2', '#FFFFFF'], { over: tint('rainbow', ['#FF5E5E', '#FFB84D', '#FFE84D', '#5EE07A', '#4DB8FF', '#A06BFF'], 0.85), swatch: ['#FF5E5E', '#FFE84D', '#5EE07A', '#4DB8FF', '#A06BFF'] }),
  s('holo', 90, ['#3A3A5A', '#C8C2E8', '#FFFFFF'], { over: tint('holo', ['#7DF9FF', '#FF9AF0', '#FFF59A', '#9AFFC2'], 0.8, 1) + SHEEN + '<g fill="#fff"><path d="M64 40l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/><path d="M34 66l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/></g>', swatch: ['#7DF9FF', '#FF9AF0', '#FFF59A', '#9AFFC2'] }),
]

export const skinOf = (id: unknown): Skin | undefined => SKINS.find(k => k.id === id)

/** The skins open at a level. */
export const skinsAt = (level: number): Skin[] => SKINS.filter(k => k.level <= level)

const ch = (hex: string, at: number) => (Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16) / 255).toFixed(3)

/** The filter that recolours the clay by a skin's gradient map, keeping its light and shade; none for Mochi's own clay. */
export function skinFilter(k: Skin | undefined): string {
  if (!k?.map) return ''
  const [dark, mid, light] = k.map
  const fn = (c: 'R' | 'G' | 'B', at: number) => `<feFunc${c} type="table" tableValues="${ch(dark, at)} ${ch(mid, at)} ${ch(light, at)}"/>`
  const alpha = k.alpha ? `<feFuncA type="linear" slope="${k.alpha}"/>` : ''
  // Named by the skin: several Mochis on one page share one set of definitions, and the first of a name wins.
  return `<filter id="skin-map-${k.id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.33 0.5 0.17 0 0  0.33 0.5 0.17 0 0  0.33 0.5 0.17 0 0  0 0 0 1 0"/><feComponentTransfer>${fn('R', 0)}${fn('G', 1)}${fn('B', 2)}${alpha}</feComponentTransfer></filter>`
}
