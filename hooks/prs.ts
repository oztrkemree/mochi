import type { Inbox, Mood, Pull } from '../types'

export type { Inbox, Pull }
import { ago } from './facts'
import { DEFS, STYLE } from './gauge'
import { t } from './i18n'
import { clip, cols, rtlStyle } from './text'

// /mochi prs: the pull requests waiting on the person, on every GitHub
// repository they can see, from one call of their own gh: those that ask for
// their review, those they reviewed that got commits after, and their own
// with what stands in the way of merging each.

/** The three searches, in one GraphQL call: each pull request with its checks, its merge state and the last review of each reviewer. */
export const PRS_QUERY = `query($review:String!,$mine:String!,$seen:String!){
viewer{login}
review:search(query:$review,type:ISSUE,first:30){nodes{...P}}
mine:search(query:$mine,type:ISSUE,first:30){nodes{...P}}
seen:search(query:$seen,type:ISSUE,first:30){nodes{...P}}
}
fragment P on PullRequest{number title url isDraft updatedAt repository{name} author{login} reviewDecision mergeable
commits(last:1){nodes{commit{committedDate statusCheckRollup{state}}}}
latestReviews(first:30){nodes{author{login} submittedAt}}}`

/** What each search asks for: open pull requests in repositories not archived. */
export const PRS_SEARCH = {
  review: 'is:pr is:open archived:false review-requested:@me',
  mine: 'is:pr is:open archived:false author:@me',
  seen: 'is:pr is:open archived:false reviewed-by:@me -author:@me',
}


const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const time = (v: unknown): number => Date.parse(str(v)) || 0
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})
const nodes = (v: unknown): unknown[] => { const list = rec(v).nodes; return Array.isArray(list) ? list : [] }

/** The answer of `gh api graphql` to PRS_QUERY, read into the three lists; null when it is not that answer. */
export function inboxOf(json: string): Inbox | null {
  let data: Record<string, unknown>
  try {
    data = rec(rec(JSON.parse(json)).data)
  } catch {
    return null
  }
  const me = str(rec(data.viewer).login)
  if (me === '') return null
  const pull = (x: unknown): Pull | null => {
    const p = rec(x)
    if (typeof p.number !== 'number') return null
    const commit = rec(rec(nodes(p.commits)[0]).commit)
    const mine = nodes(p.latestReviews).map(rec).filter(r => str(rec(r.author).login) === me)
    return {
      repo: str(rec(p.repository).name), number: p.number, title: str(p.title), url: str(p.url), author: str(rec(p.author).login),
      isDraft: p.isDraft === true, updatedAt: time(p.updatedAt), committedAt: time(commit.committedDate),
      decision: str(p.reviewDecision), mergeable: str(p.mergeable), checks: str(rec(commit.statusCheckRollup).state),
      reviewedAt: Math.max(0, ...mine.map(r => time(r.submittedAt))),
    }
  }
  const list = (key: string) => nodes(data[key]).map(pull).filter((p): p is Pull => p !== null)
  return { review: list('review'), mine: list('mine'), seen: list('seen') }
}

/** A pull request untouched this long is old: left out and counted. */
export const PR_OLD_DAYS = 30
const TITLE_COLS = 64
const DAY_MS = 86_400_000

/** Where one of the person's own stands, as the words in `t().prs` name it. */
export type PullState = 'draft' | 'conflict' | 'ciFailed' | 'changes' | 'ciRunning' | 'waitingReview' | 'approved' | 'ready'

/** What stands in the way of merging one of the person's own, most pressing first; empty when nothing does. */
export function blockers(p: Pull): PullState[] {
  return [
    ...(p.isDraft ? ['draft' as const] : []),
    ...(p.mergeable === 'CONFLICTING' ? ['conflict' as const] : []),
    ...(p.checks === 'FAILURE' || p.checks === 'ERROR' ? ['ciFailed' as const] : []),
    ...(p.decision === 'CHANGES_REQUESTED' ? ['changes' as const] : []),
  ]
}

/** One of the person's own: what blocks it, else what it waits for, else ready to merge. */
export function statesOf(p: Pull): PullState[] {
  const block = blockers(p)
  if (block.length > 0) return block
  if (p.checks === 'PENDING' || p.checks === 'EXPECTED') return ['ciRunning']
  if (p.decision === 'REVIEW_REQUIRED') return ['waitingReview']
  return [p.decision === 'APPROVED' ? 'approved' : 'ready']
}

/** How far down its own list one of the person's own goes: blocked first, then ready, then waiting, drafts last. */
const rank = (p: Pull): number => {
  const states = statesOf(p)
  return states.some(x => x !== 'draft' && blockers(p).includes(x)) ? 0 : states[0] === 'approved' || states[0] === 'ready' ? 1 : p.isDraft ? 3 : 2
}

/** The three lists as shown: fresh ones only, each in its order; and how many old ones were left out. */
export function sorted(inbox: Inbox, now: number): Inbox & { old: number } {
  const fresh = (p: Pull) => now - p.updatedAt < PR_OLD_DAYS * DAY_MS
  const review = inbox.review.filter(fresh).sort((a, b) => a.updatedAt - b.updatedAt)
  // Those asking for a review again are in the first list already.
  const seen = inbox.seen.filter(p => fresh(p) && p.committedAt > p.reviewedAt && !review.some(r => r.url === p.url)).sort((a, b) => b.committedAt - a.committedAt)
  const mine = inbox.mine.filter(fresh).sort((a, b) => rank(a) - rank(b) || b.updatedAt - a.updatedAt)
  return { review, seen, mine, old: [...inbox.review, ...inbox.mine].filter(p => !fresh(p)).length }
}

/** The list, by section; with `withLinks`, each pull request's link under it, for copying. */
export function prsText(inbox: Inbox, now: number, withLinks = false): string {
  const s = t().prs
  const { review, seen, mine, old } = sorted(inbox, now)
  const head = (p: Pull) => `  • ${p.repo} #${p.number} ${clip(p.title, TITLE_COLS)}`
  const link = (p: Pull) => (withLinks && p.url !== '' ? [`    ${p.url}`] : [])
  const lines: string[] = []
  const part = (title: string, list: Pull[], tail: (p: Pull) => string) => {
    if (list.length === 0) return
    if (lines.length > 0) lines.push('')
    lines.push(title)
    for (const p of list) lines.push(`${head(p)} · ${tail(p)}`, ...link(p))
  }
  part(s.review(review.length), review, p => `${p.author} · ${ago(now - p.updatedAt)}`)
  part(s.seen(seen.length), seen, p => `${p.author} · ${ago(now - p.committedAt)}`)
  part(s.mine(mine.length), mine, p => statesOf(p).map(x => s[x]).join(', '))
  if (lines.length === 0) lines.push(s.none)
  if (old > 0) lines.push('', s.old(old, PR_OLD_DAYS))
  return lines.join('\n')
}

// ---------- the board ----------

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const STATE_INK: Record<PullState, string> = {
  draft: '#A1A09B', conflict: '#F0645A', ciFailed: '#F0645A', changes: '#F2B84B', ciRunning: '#B794F6', waitingReview: '#7AA2F7', approved: '#4CC38A', ready: '#4CC38A',
}
const SECTION_INK = { review: '#7AA2F7', seen: '#B794F6', mine: '#73DACA' } as const
const PEOPLE_INK = ['#7AA2F7', '#73DACA', '#B794F6', '#F07CB8', '#FF9E63', '#4CC38A', '#F2B84B', '#5FB3F0']

/** A wait's colour: fresh under a day, getting long under three, long after. */
const heat = (ms: number): string => (ms < DAY_MS ? '#4CC38A' : ms < 3 * DAY_MS ? '#F2B84B' : '#F0645A')
/** A person's colour, the same every time for the same login. */
const personInk = (login: string): string => PEOPLE_INK[[...login].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PEOPLE_INK.length]!

const HEAD_H = 104
const TITLE_H = 30
const ROW_H = 56
const GAP = 6

/** Where a press on the board lands: a card's top and bottom (in the drawing's pixels) and the link it opens. */
export type Spot = { y0: number; y1: number; url: string }

/**
 * The pull requests as a board `w` wide: Mochi over three counts, then a card
 * for each pull request, by section, with its state in coloured pills and how
 * long it has waited as a bar along its foot. `mascot` draws Mochi in a mood
 * (rig's mascotInner), so this file needs none of the rig. The cards slide in
 * one after another; drawn later, they stand where they end.
 */
export function prsBoard(inbox: Inbox, now: number, w: number, mascot: (mood: Mood) => string): { svg: string; height: number; spots: Spot[] } {
  const s = t().prs
  const W = Math.max(300, Math.round(w))
  const { review, seen, mine, old } = sorted(inbox, now)
  const isBlocked = mine.some(p => blockers(p).some(x => x !== 'draft'))
  const mood: Mood = review.length + seen.length + mine.length === 0 ? 'party' : isBlocked ? 'nervous' : review.length > 0 ? 'asking' : seen.length > 0 ? 'reading' : 'waiting'
  const accent = mood === 'party' ? '#4CC38A' : isBlocked ? '#F0645A' : review.length > 0 ? SECTION_INK.review : seen.length > 0 ? SECTION_INK.seen : SECTION_INK.mine
  let order = 0
  /** Slides a part in at its turn: from the start of the drawing, so a drawing made later stands still where it ends. */
  const enter = (body: string) => {
    const wait = Math.min(1.2, order++ * 0.07)
    const dur = wait + 0.35
    const at = n(wait / dur)
    return `<g><animate attributeName="opacity" values="0;0;1" keyTimes="0;${at};1" dur="${n(dur)}s"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 10;0 10;0 0" keyTimes="0;${at};1" dur="${n(dur)}s" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.3 1"/>${body}</g>`
  }

  // ---- Mochi over three counts ----
  const tileX = 112
  const tileW = (W - tileX - 10) / 3
  const counts = [[review.length, s.countReview, SECTION_INK.review], [seen.length, s.countSeen, SECTION_INK.seen], [mine.length, s.countMine, SECTION_INK.mine]] as const
  const tiles = counts.map(([count, label, ink], i) => {
    const x = tileX + i * tileW
    return enter(`<rect x="${n(x)}" y="44" width="${n(tileW - 8)}" height="48" rx="10" fill="${ink}" fill-opacity="${count > 0 ? 0.14 : 0.05}" stroke="${ink}" stroke-opacity="${count > 0 ? 0.4 : 0.12}"/>` +
      `<text class="t" x="${n(x + 12)}" y="72" font-size="22" font-weight="750" fill="${count > 0 ? ink : '#8A8984'}" font-variant-numeric="tabular-nums">${count}</text>` +
      `<text class="t dim" x="${n(x + 12)}" y="85" font-size="10">${esc(clip(label, Math.max(4, Math.floor((tileW - 24) / 5.4))))}</text>`)
  }).join('')
  const head = `<defs><linearGradient id="prglow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.28"/><stop offset="0.6" stop-color="${accent}" stop-opacity="0.06"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>` +
    `<rect x="1" y="1" width="${W - 2}" height="${HEAD_H - 6}" rx="14" fill="url(#prglow)" stroke="${accent}" stroke-opacity="0.25"/>` +
    `<circle cx="54" cy="52" r="34" fill="${accent}" opacity="0.25" filter="url(#haze)"/>` +
    `<svg x="6" y="4" width="96" height="96" viewBox="0 0 100 100" overflow="visible">${mascot(mood)}</svg>` +
    `<text class="t fg" x="${tileX}" y="30" font-size="16" font-weight="700">${esc(clip(t().pane.prs, Math.floor((W - tileX - 12) / 9)))}</text>` + tiles

  // ---- a card for each ----
  const spots: Spot[] = []
  let y = HEAD_H + 4
  let body = ''
  const pill = (text: string, ink: string, right: number, top: number, isLive = false) => {
    const pw = cols(text) * 10.5 * 0.5 + (isLive ? 24 : 16)
    const x = right - pw
    const dot = isLive ? `<circle cx="${n(x + 9)}" cy="${n(top + 9)}" r="3" fill="${ink}"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite"/></circle>` : ''
    return { width: pw, svg: `<rect x="${n(x)}" y="${top}" width="${n(pw)}" height="18" rx="9" fill="${ink}" fill-opacity="0.16" stroke="${ink}" stroke-opacity="0.4"/>${dot}` +
      `<text class="t" x="${n(x + (isLive ? 17 : 8))}" y="${top + 12.6}" font-size="10.5" font-weight="650" fill="${ink}">${esc(text)}</text>` }
  }
  const section = (title: string, ink: string, list: Pull[], tags: (p: Pull) => { text: string; ink: string; isLive?: boolean }[], waited: (p: Pull) => number) => {
    if (list.length === 0) return
    body += enter(`<circle cx="9" cy="${y + 15}" r="4" fill="${ink}"/><text class="t fg" x="20" y="${y + 19}" font-size="12" font-weight="700">${esc(title)}</text>`)
    y += TITLE_H
    for (const p of list) {
      const wait = Math.max(0, waited(p))
      // The pills sit by the title; where they would leave it too little room, by the line under it.
      const list2 = tags(p)
      const widths = list2.reduce((sum, tag) => sum + pill(tag.text, tag.ink, 0, 0, tag.isLive).width + 6, 0)
      const isLow = W - 72 - widths < 140
      let right = W - 12
      const pills = list2.map(tag => {
        const made = pill(tag.text, tag.ink, right, y + (isLow ? 27 : 10), tag.isLive)
        right -= made.width + 6
        return made.svg
      }).join('')
      const room = (isLow ? W - 12 : right) - 52 - 8
      const metaRoom = (isLow ? right : W - 12) - 52 - 4
      const bar = Math.max(8, Math.min(1, wait / (7 * DAY_MS)) * (W - 24))
      const initials = (p.author.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?').toUpperCase()
      body += enter(`<rect class="card" x="1" y="${y}" width="${W - 2}" height="${ROW_H}" rx="11"/>` +
        `<rect x="1" y="${y + 10}" width="3" height="${ROW_H - 20}" rx="1.5" fill="${ink}"/>` +
        `<circle cx="28" cy="${y + ROW_H / 2 - 2}" r="14" fill="${personInk(p.author)}"/>` +
        `<text class="t" x="28" y="${y + ROW_H / 2 + 2}" font-size="10.5" font-weight="750" fill="#fff" text-anchor="middle">${esc(initials)}</text>` +
        `<text class="t fg" x="52" y="${y + 22}" font-size="13" font-weight="650">${esc(clip(p.title, Math.max(6, Math.floor(room / 7))))}</text>` +
        `<text class="t dim" x="52" y="${y + 39}" font-size="11">${esc(clip(`${p.repo} #${p.number} · ${p.author} · ${ago(wait)}`, Math.max(4, Math.floor(metaRoom / 6.2))))}</text>` +
        pills +
        `<rect class="trackf" x="12" y="${y + ROW_H - 6}" width="${W - 24}" height="2.5" rx="1.25"/>` +
        `<rect x="12" y="${y + ROW_H - 6}" width="${n(bar)}" height="2.5" rx="1.25" fill="${heat(wait)}"/>`)
      spots.push({ y0: y, y1: y + ROW_H, url: p.url })
      y += ROW_H + GAP
    }
    y += 6
  }
  const age = (p: Pull) => ({ text: ago(now - p.updatedAt), ink: heat(now - p.updatedAt) })
  section(s.review(review.length), SECTION_INK.review, review, p => [age(p)], p => now - p.updatedAt)
  section(s.seen(seen.length), SECTION_INK.seen, seen, () => [{ text: s.newCommits, ink: SECTION_INK.seen }], p => now - p.committedAt)
  section(s.mine(mine.length), SECTION_INK.mine, mine, p => statesOf(p).map(x => ({ text: s[x], ink: STATE_INK[x], isLive: x === 'ciRunning' })), p => now - p.updatedAt)

  if (review.length + seen.length + mine.length === 0) {
    // Nothing waits: a tick drawn in a ring, and the words.
    body += enter(`<rect class="card" x="1" y="${y}" width="${W - 2}" height="64" rx="12"/>` +
      `<circle cx="34" cy="${y + 32}" r="15" fill="none" stroke="#4CC38A" stroke-width="2.5" stroke-dasharray="95" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="95;95;0" keyTimes="0;0.3;1" dur="1s"/></circle>` +
      `<path d="M27 ${y + 32}l5 5l9 -10" fill="none" stroke="#4CC38A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="22" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="22;22;0" keyTimes="0;0.6;1" dur="1.3s"/></path>` +
      `<text class="t fg" x="62" y="${y + 37}" font-size="13.5" font-weight="650">${esc(clip(s.none, Math.floor((W - 74) / 7.4)))}</text>`)
    y += 72
  }
  if (old > 0) {
    body += `<text class="t faint" x="6" y="${y + 12}" font-size="11">${esc(clip(s.old(old, PR_OLD_DAYS), Math.floor((W - 12) / 6)))}</text>`
    y += 22
  }
  const H = Math.round(y + 4)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${STYLE}${rtlStyle()}${DEFS}${head}${body}</svg>`
  return { svg, height: H, spots }
}
