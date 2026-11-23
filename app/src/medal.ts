import type { Tier } from './feats'

/**
 * An achievement's medal: its tier in the shape and the metal of the rim
 * (a round bronze coin, a silver hexagon, a gold star, a rosette of every
 * colour), its theme's colour in the face, and its own sign in white.
 * Drawn on a 48-unit square; a sign is drawn on 24, as the mod's badges are.
 */

/** Each tier's rim: its outline, and the metal it is cast in, light to dark. */
const RIM: Record<Tier, { shape: string; metal: [string, string, string] }> = {
  easy: { shape: '<circle cx="24" cy="24" r="22.5"/>', metal: ['#F3C29A', '#C9875A', '#7E4A2A'] },
  medium: { shape: polygon(6, 23.5, 23.5, -90), metal: ['#FFFFFF', '#C9D1D9', '#7C8794'] },
  hard: { shape: polygon(16, 24, 20.6, -90), metal: ['#FFF0B3', '#F2C14E', '#B07A12'] },
  impossible: { shape: polygon(20, 24.5, 18.2, -90), metal: ['#FF9FD0', '#B794F6', '#4FA8F0'] },
}

/** A closed outline around the centre, alternating between two radii (equal radii make a polygon). */
function polygon(points: number, outer: number, inner: number, start: number): string {
  const corners = Array.from({ length: points }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const a = ((start + (360 / points) * i) * Math.PI) / 180
    return `${(24 + r * Math.cos(a)).toFixed(2)},${(24 + r * Math.sin(a)).toFixed(2)}`
  })
  return `<polygon points="${corners.join(' ')}" stroke-linejoin="round"/>`
}

/** A colour mixed toward white (amount above 0) or black (below). */
function mix(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const to = amount > 0 ? 255 : 0
  const k = Math.abs(amount)
  const channel = (shift: number) => Math.round(((n >> shift) & 255) + (to - ((n >> shift) & 255)) * k)
  return `#${[16, 8, 0].map(s => channel(s).toString(16).padStart(2, '0')).join('')}`
}

export function medalSvg(ink: string, sign: string, tier: Tier, isDone: boolean): string {
  const rim = RIM[tier]
  const face = isDone ? ink : '#8C8580'
  // Named by what it draws: every medal on the page shares one set of definitions, and the first of a name wins.
  const id = `${tier}-${face.slice(1)}`
  const [light, mid, dark] = rim.metal
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%">',
    '<defs>',
    `<linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`,
    `<radialGradient id="face-${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${mix(face, 0.35)}"/><stop offset=".6" stop-color="${face}"/><stop offset="1" stop-color="${mix(face, -0.3)}"/></radialGradient>`,
    '</defs>',
    `<g${isDone ? '' : ' opacity=".42"'}>`,
    // The rim, its edge caught by the light, and a shadow under the face.
    `<g fill="url(#rim-${id})" stroke="url(#rim-${id})" stroke-width="2">${rim.shape}</g>`,
    `<g fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".8">${rim.shape}</g>`,
    '<circle cx="24" cy="25" r="16.4" fill="#000" opacity=".22"/>',
    `<circle cx="24" cy="24" r="16" fill="url(#face-${id})"/>`,
    '<circle cx="24" cy="24" r="14.6" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".9"/>',
    '<path d="M13 19.5a12 9 0 0 1 22 0a13 6 0 0 0-22 0z" fill="#fff" opacity=".2"/>',
    // The all but impossible ones glint.
    tier === 'impossible' && isDone ? '<g fill="#fff"><path d="M40 6.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/><path d="M7.5 38l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/></g>' : '',
    // The sign, with a soft shadow below it so it stands on the face.
    `<g transform="translate(24.5 24.8) scale(1.32) translate(-12 -12)" stroke="#000" stroke-opacity=".25" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${sign}</g>`,
    `<g transform="translate(24 24) scale(1.32) translate(-12 -12)" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${sign}</g>`,
    '</g></svg>',
  ].join('')
}

/** Each milestone's own sign, by what it counts, drawn in white on 24 units. */
export const SIGN: Record<string, string> = {
  turns: '<path d="M7 8h10a2 2 0 0 1 2 2v4.4a2 2 0 0 1-2 2h-5l-3.4 2.7v-2.7H7a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"/>',
  dayTurns: '<path d="M5.5 7.5h8a1.6 1.6 0 0 1 1.6 1.6v3.6a1.6 1.6 0 0 1-1.6 1.6H9.4l-2.6 2.1v-2.1H5.5a1.6 1.6 0 0 1-1.6-1.6V9.1a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M17.6 10.6h.9a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6h-.9v2l-2.5-2h-2.6"/>',
  edits: '<path d="M7.5 16.5l.9-3.4 6.8-6.8 2.5 2.5-6.8 6.8-3.4.9zM13.6 7.9l2.5 2.5"/>',
  tools: '<path d="M14.8 6.4a3.6 3.6 0 0 0-3.5 4.7l-5 5 2 2 5-5a3.6 3.6 0 0 0 4.7-3.5l-2.1 1-1.9-1.9z"/>',
  added: '<path d="M12 7v10M7 12h10"/>',
  removed: '<path d="M7 12h10"/><path d="M8.5 8.4h7M8.5 15.6h7" stroke-opacity=".55"/>',
  langs: '<circle cx="12" cy="12" r="5.6"/><path d="M6.4 12h11.2M12 6.4c1.9 1.6 2.7 3.5 2.7 5.6s-.8 4-2.7 5.6c-1.9-1.6-2.7-3.5-2.7-5.6s.8-4 2.7-5.6z"/>',
  commits: '<circle cx="12" cy="12" r="2.7"/><path d="M5.2 12h4.1M14.7 12h4.1"/>',
  dayCommits: '<path d="M12 5.4c2.5 1.7 3.5 4.3 3.1 7.7l-1.5 2.1h-3.2l-1.5-2.1C8.5 9.7 9.5 7.1 12 5.4z"/><path d="M10.6 15.2l-.9 2.9M13.4 15.2l.9 2.9"/><circle cx="12" cy="10.2" r="1.1"/>',
  hours: '<circle cx="12" cy="12" r="5.8"/><path d="M12 8.8v3.4l2.3 1.5"/>',
  night: '<path d="M15.9 14.6A5.8 5.8 0 0 1 9.4 6.6a5.8 5.8 0 1 0 6.5 8z"/>',
  early: '<path d="M6.6 15.8h10.8M8.6 15.8a3.4 3.4 0 0 1 6.8 0M12 7.6v1.9M7.9 9.6l1.3 1.3M16.1 9.6l-1.3 1.3"/>',
  days: '<rect x="6.4" y="7.6" width="11.2" height="10" rx="2"/><path d="M6.4 11.2h11.2M9.6 6v3M14.4 6v3"/>',
  streak: '<path d="M12 5.8c2.7 2.7 4.4 4.9 4.4 7.5a4.4 4.4 0 0 1-8.8 0c0-1.5.6-2.7 1.5-3.7.3 1.5 1.1 2.3 2.1 2.5-.4-2.3.1-4.2.8-6.3z"/>',
  level: '<path d="M12 6.2l5.2 5.2H14v5.8h-4v-5.8H6.8z"/>',
  items: '<path d="M5.8 15.6h12.4M8 15.6c0-4.1 1.7-7.8 4-7.8s4 3.7 4 7.8"/><path d="M8.4 13.2h7.2" stroke-opacity=".55"/>',
  badges: '<path d="M9 6.4h6v3.8a3 3 0 0 1-6 0zM9 7.8H7.2a2 2 0 0 0 2 3.1M15 7.8h1.8a2 2 0 0 1-2 3.1M12 13.2v2.6M9.6 17.6h4.8"/>',
}
