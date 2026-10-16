import { atom, read } from 'claude-code'
import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Badge, Block, Env, Item, Prefs, Section } from '../types'
import { BADGES, badgeHint, badgeName, badgeSvg } from './badges'
import { ciLine, prLine } from './ci'
import { changesPieces, detailHeight, detailParts, diffable, levelSummary, levelSvg, metersSvg, partLines, partSvg, pieceSvg, ruleSvg, switchSvg } from './detail'
import type { Part, Parts } from './detail'
import { baseName, clockAt, forecasts } from './facts'
import { birthdayName } from './fun'
import { DICTS, LANGS, t } from './i18n'
import { ASCII_HAT, SLOT, SLOTS, SLOT_ITEMS, hintFor, itemName, itemShort, outfitNow, slotName, unlocked } from './level'
import type { Slot } from './level'
import { LOOKS, asciiRows, kaomoji } from './looks'
import { nameOf } from './live'
import { PANEL_H, limitName, panelSvg } from './panel'
import { SHOWN, floorOf, memberLines, membersOf, partyOf, statusLine } from './party'
import { duration } from './react'
import { VECTOR_WEAR, svgFor } from './rig'
import { ALL_ITEMS, DEFAULT_PREFS, NO_DIFF, NO_ENV, NO_FACE, NO_PANEL, NO_SAID, TABS, TAB_OF, chat, inTab } from './state'
import { WEAR } from './wear'

// What Mochi draws: the band above the prompt (the mascot and its line in the
// terminal, the panel on the desktop) and the details pane, with its level,
// wardrobe and badges. It only reads the values register.tsx keeps, named here
// again because the engine reads the state a file uses from that file's own consts.

const face = atom({ plugin: 'mochi-buddy', key: 'face' } as const, NO_FACE)
const panel = atom({ plugin: 'mochi-buddy', key: 'panel' } as const, NO_PANEL)
const detail = atom({ plugin: 'mochi-buddy', key: 'detail' } as const, NO_ENV)
const frame = atom({ plugin: 'mochi-buddy', key: 'frame' } as const, 0)
const sec = atom({ plugin: 'mochi-buddy', key: 'sec' } as const, 0)
const env = atom({ plugin: 'mochi-buddy', key: 'env' } as const, NO_ENV)
const prefs = atom({ plugin: 'mochi-buddy', key: 'prefs' } as const, DEFAULT_PREFS)
const said = atom({ plugin: 'mochi-buddy', key: 'said' } as const, NO_SAID)
const diff = atom({ plugin: 'mochi-buddy', key: 'diff' } as const, NO_DIFF)
const party = atom({ plugin: 'mochi-buddy', key: 'party' } as const, { pick: '' })
const dirs = atom({ plugin: 'mochi-buddy', key: 'dirs' } as const, { open: [] as string[] })

const width = (s: string) => [...s].length
const cut = (s: string, max: number) => (width(s) <= max ? s : `${[...s].slice(0, Math.max(1, max - 1)).join('')}…`)

/** The pane's buttons, picker and field act in the `ui.press`, `ui.select` and `ui.input` hooks, where `$` is at hand; their own handlers have nothing left to do. */
const pressed = () => undefined
const picked = () => undefined

// The clear regions the desktop draws over the details pane, each from a surface
// module of its own named here as fixed text (the directory reads which).
type DeskPane = Extract<Parameters<MatchedHook<'ui.render', { component: 'Pane' }>>[1], { surface: 'desktop' }>

/** Over a card or tab: a click presses `key` (hit.tsx). */
function tapRegion($: EngineInterface, desk: DeskPane, key: string, rows: number) {
  const { Box, Client } = $.ui.resolve(desk)
  return <Box position="absolute" top={0} left={0} right={0} bottom={0}><Client key={key} module="./hit.tsx" props={{ rows }} width="100%" height="100%" /></Box>
}

/** Over the floor of chats: a click picks whoever stands there (floor.tsx). */
function floorRegion($: EngineInterface, desk: DeskPane, rows: number) {
  const { Box, Client } = $.ui.resolve(desk)
  return <Box position="absolute" top={0} left={0} right={0} bottom={0}><Client key="party" module="./floor.tsx" props={{ rows }} width="100%" height="100%" /></Box>
}

/** The sections, dragged into order or out of view (arrange.tsx). */
function arrangeRegion($: EngineInterface, desk: DeskPane, props: { rows: { id: Block; title: string; gist: string; isHidden: boolean }[]; shown: string; hidden: string }) {
  const { Client } = $.ui.resolve(desk)
  return <Client key="arrange" module="./arrange.tsx" props={props} width="100%" height={props.rows.length * 2} />
}

/** An item's picture for the wardrobe, faded and grey while locked. */
function iconSvg(item: Item, isOpen: boolean): string {
  const vector = VECTOR_WEAR[item]
  if (vector) {
    const [x, y, w, tall] = vector.box
    // Glasses read as glasses on a patch of Mochi's own clay, not on the dark card.
    const skin = vector.onSkin ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${tall - 2}" rx="${Math.min(w, tall) / 2 - 1}" fill="#D97757"/>` : ''
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${tall}" width="100%" height="100%"><g opacity="${isOpen ? 1 : 0.32}"${isOpen ? '' : ' style="filter:grayscale(1)"'}>${skin}${vector.svg}</g></svg>`
  }
  const a = WEAR[item]
  if (a === undefined) return ''
  const scale = Math.min(44 / a.w, 30 / a.h)
  const w = a.w * scale
  const tall = a.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 32" width="100%" height="100%"><image href="${a.uri}" x="${(46 - w) / 2}" y="${(32 - tall) / 2}" width="${w}" height="${tall}" opacity="${isOpen ? 1 : 0.32}"${isOpen ? '' : ' style="filter:grayscale(1)"'}/></svg>`
}

/** The terminal drawing's hat row, when the mood leaves it empty and something is worn on the head. */
function withHat(rows: string[], head: Item | null, isShiftedRight: boolean): string[] {
  const hat = head ? ASCII_HAT[head] : undefined
  const top = rows[0]
  if (hat === undefined || top === undefined || top.trim() !== '') return rows
  const at = isShiftedRight ? 3 : 2
  return [top.slice(0, at) + hat + top.slice(at + 5), ...rows.slice(1)]
}

/** The settings the pane switches on and off, each with the preference it turns. */
const TOGGLES = [['shield', 'hasShield'], ['alerts', 'hasAlert'], ['sound', 'hasSound'], ['ci', 'hasCi'], ['tips', 'hasTips'], ['breaks', 'hasBreaks'], ['plugins', 'hasPlugins']] as const

/** The pane's actions by group: each button's key after `do:`, and its label. */
function actionGroups(): [string, string, [string, string][]][] {
  const d = t().pane
  return [
    ['share', d.share, [['card', d.card], ['wrapped', d.wrappedMonth], ['year', d.wrappedYear], ['snap', d.snap]]],
    ['help', d.help, [['tour', d.tour], ['news', d.news], ['feedback', d.feedback]]],
    ['data', d.data, [['export', d.export], ['reset:level', d.resetLevel], ['reset:history', d.resetHistory], ['reset:all', d.resetAll]]],
  ]
}

/** Each block's name, as its row and the arranging list show it. */
const blockNames = (): Record<Block, string> => t().pane.names

/** The heading of a part's first card, left out under its row's own name. */
const CARD_TITLE: Record<Exclude<Part, 'overview'>, () => string> = {
  chats: () => t().chats.title, changes: () => t().detail.changes, context: () => t().detail.contextTitle, activity: () => '',
}

/** Each block's gist in a line: what its heading says while folded, and its row in the arranging list. */
function blockGists(v: Env, p: Prefs, parts: Parts, unlocked: number): Record<Block, string> {
  const d = t().pane
  return {
    overview: parts.context.gist, chats: parts.chats.gist, changes: parts.changes.gist, context: parts.context.gist, activity: parts.activity.gist,
    level: levelSummary(v), wardrobe: t().ui.unlockedOf(unlocked, ALL_ITEMS.length), badges: t().fun.earned(v.badges.length, BADGES.length),
    settings: TOGGLES.filter(([, pref]) => p[pref]).map(([key]) => d.setting[key].name).join(' · '), more: d.moreGist,
  }
}

/** A changed file's button under Changes: pressed, its diff shows in the card; pressed again (✕), it is put away. */
const diffLabel = (v: Env, path: string) => `${baseName(path)}${path === v.diff?.path ? ' ✕' : ''}`

/** The language picker's options: automatic, naming what it found, then each language in its own name. */
const langOptions = () => [{ value: 'auto', label: t().pane.langAuto(t().name) }, ...LANGS.map(l => ({ value: l, label: DICTS[l].name }))]

/**
 * The details pane: the overview on top, then folding sections, each heading
 * with its gist: what is live (chats, changes) open, what is looked at once in
 * a while folded; which are open is kept. The settings and every other action
 * of /mochi are here too, as buttons. Lines and buttons in the terminal.
 */
export const detailPane: MatchedHook<'ui.render', { component: 'Pane' }> = async ($, e) => {
  const v = { ...NO_ENV, ...(await read($, detail)), diff: await read($, diff), dirs: (await read($, dirs)).open }
  const now = await $.clock.now()
  const p = await read($, prefs)
  const answer = await read($, said)
  const crewPick = (await read($, party)).pick
  const d = t().pane
  const diffs = diffable(v)
  if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
    const ui = $.ui.resolve(e)
    const { Box, Button, Link, Svg, Text } = ui
    const Select = 'Select' in ui ? ui.Select : null
    const Input = 'Input' in ui ? ui.Input : null
    const width = Math.round(Math.min(1400, Math.max(320, e.props.bodyColumns * 8.1 - 8)))
    // A section's inside: the pane less its margins, the border and the padding.
    const secW = Math.max(280, width - 72)
    const parts = detailParts(v, now, secW - 4)
    // As Mochi stands at rest, so a held item shows whatever the pose of the moment.
    const dressed = outfitNow(p, v, 'idle', now)
    const ok = unlocked(v.history)
    const isAuto = SLOTS.every(slot => p.pick[slot] === undefined)
    // The wardrobe: Mochi in what it has on, a tab per slot with what is worn
    // there, and the slot's items as cards of one size filling the row, those
    // that can be worn first. On the desktop a clear region over a card or tab
    // makes all of it clickable (see hit.tsx), keyed `tap:` and its button's key.
    const desk = e.surface === 'desktop' ? e : null
    const tap = (key: string, rows = 8) => (desk ? tapRegion($, desk, `tap:${key}`, rows) : null)
    const room = Math.max(30, e.props.bodyColumns - 9)
    const perRow = Math.max(2, Math.floor((room + 1) / 16))
    const cardW = Math.floor((room + 1) / perRow) - 1
    const cell = (item: Item) => {
      const slot = SLOT[item]
      const isOn = dressed[slot] === item
      const isOpen = ok.includes(item)
      return (
        <Box key={`cell:${item}`} flexDirection="column" alignItems="center" width={cardW} paddingX={1} paddingTop={0.5} overflow="hidden"
          borderStyle="round" borderColor={isOn ? 'claude' : 'inactive'} borderDimColor={!isOn} hover={isOpen && !isOn ? { borderColor: 'claude', borderDimColor: false } : undefined}>
          <Svg source={iconSvg(item, isOpen)} alt={itemName(item)} width={46} height={32} />
          {isOpen
            ? <Button key={`wear:${item}`} plain onPress={pressed}>{itemShort(item)}</Button>
            : <Text dimColor wrap="truncate">{itemShort(item)}</Text>}
          {isOn
            ? <Text color="claude" wrap="truncate">{`✓${p.pick[slot] === undefined ? t().ui.autoMark : ''}`}</Text>
            : <Text dimColor wrap="truncate">{isOpen ? ' ' : hintFor(item)}</Text>}
          {isOpen ? tap(`wear:${item}`) : null}
        </Box>
      )
    }
    const slotTab = (slot: Slot) => {
      const isHere = slot === p.shelf
      const on = dressed[slot]
      return (
        <Box key={`tab:${slot}`} flexDirection="row" alignItems="center" gap={1} paddingX={1} overflow="hidden"
          borderStyle="round" borderColor={isHere ? 'claude' : 'inactive'} borderDimColor={!isHere} hover={isHere ? undefined : { borderColor: 'claude', borderDimColor: false }}>
          {on ? <Svg source={iconSvg(on, true)} alt={itemName(on)} width={23} height={16} /> : null}
          <Button key={`shelf:${slot}`} plain onPress={pressed}>
            {`${slotName(slot)} ${SLOT_ITEMS[slot].filter(i => ok.includes(i)).length}/${SLOT_ITEMS[slot].length}`}
          </Button>
          {tap(`shelf:${slot}`)}
        </Box>
      )
    }
    const here = dressed[p.shelf]
    const shelf = [...SLOT_ITEMS[p.shelf].filter(i => ok.includes(i)), ...SLOT_ITEMS[p.shelf].filter(i => !ok.includes(i))]
    const mochi = svgFor({ mood: 'idle', scene: { context: -1, agents: 0, outfit: dressed }, from: null })
    // The badges: each medal with how it is earned, in colour once it is.
    const medal = (b: Badge) => {
      const isEarned = v.badges.includes(b)
      return (
        <Box key={`badge:${b}`} flexDirection="row" alignItems="center" gap={1} width={40}>
          <Svg source={badgeSvg(b, isEarned)} alt={badgeName(b)} width={26} height={26} />
          <Box flexDirection="column" flexShrink={1}>
            <Text bold={isEarned} dimColor={!isEarned} wrap="truncate">{badgeName(b)}</Text>
            <Text dimColor wrap="truncate">{badgeHint(b)}</Text>
          </Box>
        </Box>
      )
    }
    const worn = SLOTS.map(slot => dressed[slot]).filter((x): x is Item => x !== null)
    const ciTrouble = p.hasCi && chat.ghTrouble !== null ? t().ci[chat.ghTrouble] : ''
    const names = blockNames()
    const gists = blockGists(v, p, parts, ok.length)

    // A row of the tab's list: its name and gist, the arrow at the right; the
    // whole row folds it on the desktop. Hairlines part the rows.
    const titleW = 16
    const item = (id: Section, gist: string | JSX.Element, body: () => JSX.Element, isFoldable = true) => {
      const isOpen = !isFoldable || p.open[id]
      return (
        <Box key={`sec:${id}`} flexDirection="column" gap={isOpen ? 1 : 0}>
          <Box flexDirection="row" alignItems="center" gap={2}>
            <Box width={titleW} flexShrink={0}><Text bold wrap="truncate">{names[id]}</Text></Box>
            {typeof gist === 'string' ? <Text dimColor wrap="truncate">{gist}</Text> : gist}
            <Box flexGrow={1} />
            {isFoldable ? <Button key={`fold:${id}`} plain dimColor onPress={pressed}>{isOpen ? '▾' : '▸'}</Button> : null}
            {isFoldable ? tap(`fold:${id}`, 2) : null}
          </Box>
          {isOpen ? body() : null}
        </Box>
      )
    }
    const rule = (key: string) => <Box key={`rule:${key}`}><Svg source={ruleSvg(secW)} alt="" width={secW} height={9} /></Box>
    // A row drawn from the detail's own cards, with what goes under them; none when it has nothing to show.
    const drawn = (id: Exclude<Part, 'overview'> & Section, under: JSX.Element | null = null) => {
      const part = parts[id]
      if (part.cards.length === 0) return null
      return item(id, part.gist, () => {
        const svg = partSvg(part.cards, secW, CARD_TITLE[id]())
        const card = <Svg source={svg} alt={names[id]} width={secW} height={Math.round(detailHeight(svg))} />
        return under === null ? card : <Box flexDirection="column" gap={1}>{card}{under}</Box>
      })
    }
    // On the desktop each line of Changes is a drawing of its own with a clear region on it: a file pressed opens
    // its diff under it, a folder its files. Elsewhere the drawing hears no clicks, and the buttons below it do.
    const changes = () => {
      if (!desk) return drawn('changes', diffPicks)
      const part = parts.changes
      if (part.cards.length === 0) return null
      const pieces = part.cards[0]?.title === CARD_TITLE.changes() ? changesPieces(v, now, true) : []
      const others = part.cards.slice(pieces.length > 0 ? 1 : 0)
      return item('changes', part.gist, () => (
        <Box flexDirection="column">
          {pieces.map((piece, i) => (
            <Box key={`chg:${i}:${piece.key}`} overflow="hidden">
              <Svg source={pieceSvg(piece, secW)} alt={piece.key.replace(/^(diff|dir):/, '')} width={secW} height={piece.h} />
              {piece.key !== '' ? tap(piece.key, 3) : null}
            </Box>
          ))}
          {others.length > 0 ? <Box key="chg:ci" marginTop={1}>{(() => {
            const svg = partSvg(others, secW, '')
            return <Svg source={svg} alt={names.changes} width={secW} height={Math.round(detailHeight(svg))} />
          })()}</Box> : null}
        </Box>
      ))
    }
    // The drawing hears no clicks: a button for each changed file it lists shows that file's diff in it.
    const diffPicks = diffs.length === 0 ? null : (
      <Box key="diffs" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1} rowGap={0.5}>
        <Text dimColor>{d.diffPick}</Text>
        {diffs.map(f => <Button key={`diff:${f.path}`} variant={f.path === v.diff.path ? 'primary' : 'secondary'} onPress={pressed}>{diffLabel(v, f.path)}</Button>)}
      </Box>
    )

    // A setting: its name and what it does, its switch at the right; the whole row turns it on the desktop.
    const rowW = e.props.bodyColumns >= 120 ? Math.floor((e.props.bodyColumns - 11) / 2) : '100%'
    const row = (key: string, name: string, about: string, control: JSX.Element, isWarn = false, tapKey = '') => (
      <Box key={`row:${key}`} flexDirection="row" alignItems="center" gap={2} width={rowW} paddingY={0.5}>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          <Text wrap="truncate">{name}</Text>
          <Text dimColor={!isWarn} color={isWarn ? 'warning' : undefined} wrap="truncate">{about}</Text>
        </Box>
        <Box flexDirection="row" alignItems="center" gap={1} flexShrink={0}>{control}</Box>
        {tapKey !== '' ? tap(tapKey, 3) : null}
      </Box>
    )
    const toggle = (key: string, isOn: boolean, name: string) => desk
      ? <Svg source={switchSvg(isOn)} alt={`${name}: ${isOn ? d.on : d.off}`} width={32} height={19} />
      : <Button key={`set:${key}`} variant={isOn ? 'primary' : 'secondary'} onPress={pressed}>{isOn ? d.on : d.off}</Button>
    const settings = () => (
      <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={0.5}>
        {TOGGLES.map(([key, pref]) => {
          const s = d.setting[key]
          const isWarn = key === 'ci' && ciTrouble !== ''
          return row(key, s.name, isWarn ? ciTrouble : s.about, toggle(key, p[pref], s.name), isWarn, `set:${key}`)
        })}
        {row('visible', d.visible.name, d.visible.about, <Button key="visible" variant="secondary" onPress={pressed}>{p.isHidden ? d.show : d.hide}</Button>)}
        {row('lang', d.language.name, d.language.about, Select
          ? <Box width={24}><Select key="lang" options={langOptions()} value={p.lang} onSelect={picked} /></Box>
          : <Text dimColor>/mochi lang</Text>)}
        {row('bday', d.birthday.name, p.birthday === '' ? d.birthday.about : d.birthdayIs(birthdayName(p.birthday)), (
          <Box flexDirection="row" alignItems="center" gap={1}>
            {Input ? <Box width={14}><Input key="bday" placeholder="MM-DD" value={p.birthday} submitLabel={d.save} onSubmit={picked} /></Box> : <Text dimColor>/mochi birthday</Text>}
            {p.birthday !== '' ? <Button key="bday:off" variant="secondary" onPress={pressed}>{d.remove}</Button> : null}
          </Box>
        ))}
      </Box>
    )
    // Everything else /mochi does, a group to a line; what an action answered stays above them until dismissed.
    const more = () => (
      <Box flexDirection="column" gap={1}>
        {answer.text !== '' ? (
          <Box key="said" flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} gap={0.5}>
            {answer.text.split('\n').map((line, i) => /^https:\/\/\S+$/.test(line)
              ? <Link key={`said:${i}`} href={line} label={cut(line.replace(/^https:\/\//, ''), 60)} />
              : <Text key={`said:${i}`} wrap="wrap">{line}</Text>)}
            <Box flexDirection="row" gap={1}>
              {answer.open ? <Button key="said:open" variant="primary" onPress={pressed}>{d.open}</Button> : null}
              {answer.copy !== '' ? <Button key="said:copy" variant={answer.open ? 'secondary' : 'primary'} onPress={pressed}>{d.copy}</Button> : null}
              <Button key="said:close" variant="secondary" onPress={pressed}>{d.dismiss}</Button>
            </Box>
          </Box>
        ) : null}
        {actionGroups().map(([key, label, actions]) => (
          <Box key={`grp:${key}`} flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1} rowGap={0.5}>
            <Box width={titleW - 2} flexShrink={0}><Text dimColor wrap="truncate">{label}</Text></Box>
            {actions.map(([what, name]) => <Button key={`do:${what}`} variant="secondary" onPress={pressed}>{name}</Button>)}
          </Box>
        ))}
        <Text dimColor wrap="wrap">{d.commands}</Text>
      </Box>
    )

    // The party: every chat as a small Mochi on one floor, those that need the person by the door, those at work
    // at the bench, the rest asleep in the corner. A Mochi pressed opens its chat in the app, or shows its card under the floor.
    const chats = () => {
      const crew = v.me ? partyOf({ ...v.me, at: now }, v.peers ?? [], now) : null
      if (crew === null || !crew.isShown) return drawn('chats')
      // Every Mochi in the party wears what the person dressed Mochi in, as the band's does in that mood.
      const floor = floorOf(crew, now, crewPick, mood => outfitNow(p, v, mood, now))
      // As wide as it needs, never wider than the pane: a crowded floor shrinks to fit.
      const floorW = Math.min(secW, floor.width)
      const floorH = Math.round((floor.height * floorW) / floor.width)
      const all = membersOf(crew)
      const chosen = all.find(m => m.peer.id === crewPick)
      // Those a place has no room for, and everyone where the floor hears no clicks, as buttons.
      const unseen = desk ? (['door', 'shop', 'nap'] as const).flatMap(z => crew[z].slice(SHOWN[z])) : all
      const gist = parts.chats.gist || t().st.agents(v.me?.agents?.length ?? 0)
      return item('chats', gist, () => (
        <Box flexDirection="column" gap={1}>
          <Box key="party" flexDirection="row">
            <Box>
              <Svg source={floor.svg} alt={all.map(m => `${nameOf(m.peer)}: ${statusLine(m)}`).join(', ')} width={floorW} height={floorH} />
              {desk ? floorRegion($, desk, Math.ceil(floorH / 14) + 1) : null}
            </Box>
          </Box>
          {unseen.length > 0 ? (
            <Box key="party:more" flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0.5}>
              {unseen.map(m => <Button key={`crew:${m.peer.id}`} variant="secondary" onPress={pressed}>{nameOf(m.peer)}</Button>)}
            </Box>
          ) : null}
          {chosen ? (
            <Box key="party:pick" flexDirection="column" borderStyle="round" borderColor="inactive" paddingX={1} gap={0.5}>
              <Text bold wrap="wrap">{chosen.isSelf ? `${nameOf(chosen.peer)} (${t().chats.here})` : nameOf(chosen.peer)}</Text>
              {memberLines(chosen, now).map((line, i) => <Text key={`pick:${i}`} dimColor wrap="truncate">{line}</Text>)}
              <Box flexDirection="row"><Button key="crew:close" variant="secondary" onPress={pressed}>{t().ui.close}</Button></Box>
            </Box>
          ) : null}
        </Box>
      ))
    }

    const blocks: Record<Block, () => JSX.Element | null> = {
      overview: () => {
        const meters = metersSvg(v, now, secW)
        return <Box key="overview"><Svg source={meters} alt={t().detail.title} width={secW} height={Math.round(detailHeight(meters))} /></Box>
      },
      chats: () => chats(),
      changes,
      context: () => drawn('context'),
      activity: () => drawn('activity'),
      level: () => item('level', gists.level, () => {
        const level = levelSvg(v, now, secW)
        return <Svg source={level} alt={names.level} width={secW} height={Math.round(detailHeight(level))} />
      }),
      wardrobe: () => item('wardrobe', (
        <Box flexDirection="row" alignItems="center" gap={2}>
          <Text dimColor wrap="truncate">{gists.wardrobe}</Text>
          <Box flexDirection="row" alignItems="center" gap={1}>
            {worn.map(x => <Svg key={`worn:${x}`} source={iconSvg(x, true)} alt={itemName(x)} width={23} height={16} />)}
          </Box>
        </Box>
      ), () => (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" alignItems="center" gap={2}>
            <Svg source={mochi} alt={t().ui.wearing(worn.length > 0 ? worn.map(itemName).join(', ') : t().ui.nothing)} width={96} height={96} />
            <Box flexDirection="column" flexShrink={1} gap={1}>
              <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0.5}>{SLOTS.map(slotTab)}</Box>
              <Text dimColor wrap="truncate">{`${slotName(p.shelf)} · ${here ? itemName(here) : t().ui.empty}${p.pick[p.shelf] === undefined ? t().ui.autoMark : ''}`}</Text>
              <Box flexDirection="row" gap={1}>
                <Button key="wear:auto" variant={isAuto ? 'primary' : 'secondary'} onPress={pressed}>{t().ui.auto}</Button>
                <Button key="wear:none" variant="secondary" onPress={pressed}>{t().ui.takeAllOff}</Button>
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0.5}>
            {shelf.map(cell)}
          </Box>
        </Box>
      ), false),
      badges: () => item('badges', gists.badges, () => (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>{BADGES.map(medal)}</Box>
      )),
      settings: () => item('settings', '', settings, false),
      more: () => item('more', '', more, false),
    }

    // The tabs: the one in view outlined; "now" counts the chats waiting for the person.
    const waiting = (v.peers ?? []).filter(x => x.state === 'asking').length
    const tabBar = (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {TABS.map(tb => {
          const isHere = tb === p.tab
          return (
            <Box key={`tab:${tb}`} flexGrow={1} flexDirection="row" justifyContent="center" gap={1} overflow="hidden"
              borderStyle="round" borderColor={isHere ? 'claude' : 'inactive'} borderDimColor={!isHere} hover={isHere ? undefined : { borderColor: 'claude', borderDimColor: false }}>
              <Button key={`tab:${tb}`} plain dimColor={!isHere} onPress={pressed}>{d.tabs[tb]}</Button>
              {tb === 'now' && waiting > 0 ? <Text color="warning">{String(waiting)}</Text> : null}
              {tap(`tab:${tb}`, 3)}
            </Box>
          )
        })}
        <Button key="arrange" variant={p.isArranging ? 'primary' : 'secondary'} onPress={pressed}>{p.isArranging ? d.done : '⠿'}</Button>
      </Box>
    )

    // Arranging the tab in view: its blocks as a list, dragged into place and
    // shown or hidden (arrange.tsx); where nothing can be dragged, buttons move them.
    const inView = inTab(p.order, p.tab)
    const rows = inView.map(id => ({ id, title: names[id], gist: gists[id], isHidden: p.hidden.includes(id) }))
    const arranging = (
      <Box key="arranging" flexDirection="column" gap={1}>
        <Text dimColor wrap="wrap">{desk ? d.arrangeHint : d.arrangeHintPlain}</Text>
        {desk
          ? arrangeRegion($, desk, { rows, shown: d.shown, hidden: d.hidden })
          : rows.map((r, i) => (
            <Box key={`row:${r.id}`} flexDirection="row" alignItems="center" gap={1}>
              <Text bold={!r.isHidden} dimColor={r.isHidden} strikethrough={r.isHidden} wrap="truncate">{r.title}</Text>
              <Box flexGrow={1} />
              {i > 0 ? <Button key={`move:${r.id}:up`} variant="secondary" onPress={pressed}>↑</Button> : null}
              {i < rows.length - 1 ? <Button key={`move:${r.id}:down`} variant="secondary" onPress={pressed}>↓</Button> : null}
              <Button key={`hide:${r.id}`} variant={r.isHidden ? 'secondary' : 'primary'} onPress={pressed}>{r.isHidden ? d.show : d.hide}</Button>
            </Box>
          ))}
        <Box flexDirection="row"><Button key="arrange:reset" variant="secondary" onPress={pressed}>{d.layoutReset}</Button></Box>
      </Box>
    )
    const shown = inView.filter(b => !p.hidden.includes(b)).map(b => ({ b, el: blocks[b]() })).filter(x => x.el !== null)
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
        {tabBar}
        {p.isArranging ? arranging : shown.length === 0 ? <Text dimColor>{d.allHidden}</Text> : shown.flatMap(({ b, el }, i) => (i === 0 ? [el] : [rule(b), el]))}
      </Box>
    )
  }

  // The terminal: the same sections, as lines and buttons.
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const Select = 'Select' in ui ? ui.Select : null
  const Input = 'Input' in ui ? ui.Input : null
  // As at rest, like the desktop's wardrobe and the press that toggles it.
  const dressed = outfitNow(p, v, 'idle', now)
  const ok = unlocked(v.history)
  const lines = partLines(v, now)
  const head = (id: Section, title: string, gist: string) => (
    <Box key={`head:${id}`} flexDirection="row" gap={1}>
      <Text bold>{title}</Text>
      <Text dimColor wrap="truncate">{gist}</Text>
      <Button key={`fold:${id}`} onPress={pressed}>{p.open[id] ? t().ui.close : t().ui.open}</Button>
    </Box>
  )
  const block = (id: Exclude<Part, 'overview'> & Section, title: string, gist: string, under: JSX.Element | null = null) => lines[id].length === 0 ? null : (
    <Box key={`sec:${id}`} flexDirection="column">
      {head(id, title, gist)}
      {p.open[id] ? lines[id].map(line => <Text wrap="truncate">{line}</Text>) : null}
      {p.open[id] ? under : null}
    </Box>
  )
  const diffPicks = diffs.length === 0 ? null : (
    <Box key="diffs" flexDirection="row" flexWrap="wrap" columnGap={1}>
      <Text dimColor>{d.diffPick}</Text>
      {diffs.map(f => <Button key={`diff:${f.path}`} onPress={pressed}>{`${f.sign} ${diffLabel(v, f.path)}`}</Button>)}
    </Box>
  )
  const parts = detailParts(v, now, Math.max(300, e.props.bodyColumns * 7))
  const names = blockNames()
  const gists = blockGists(v, p, parts, ok.length)
  const blocks: Record<Block, () => JSX.Element | null> = {
    overview: () => <Box key="overview" flexDirection="column">{lines.overview.map(line => <Text wrap="truncate">{line}</Text>)}</Box>,
    chats: () => block('chats', names.chats, gists.chats),
    changes: () => block('changes', names.changes, gists.changes, diffPicks),
    context: () => block('context', names.context, gists.context),
    activity: () => block('activity', names.activity, gists.activity),
    level: () => <Box key="sec:level" flexDirection="row" gap={1}><Text bold>{levelSummary(v)}</Text></Box>,
    wardrobe: () => (
      <Box key="sec:wardrobe" flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold>{`${t().ui.wardrobe} · ${gists.wardrobe}`}</Text>
          <Button key="fold:wardrobe" onPress={pressed}>{p.open.wardrobe ? t().ui.close : t().ui.open}</Button>
        </Box>
        {p.open.wardrobe ? SLOTS.map(slot => (
          <Box key={`slot:${slot}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Text dimColor>{`${slotName(slot)}:`}</Text>
            {SLOT_ITEMS[slot].filter(i => ok.includes(i)).map(item => (
              <Button key={`wear:${item}`} plain dimColor={dressed[slot] !== item} onPress={pressed}>{itemShort(item)}</Button>
            ))}
          </Box>
        )) : null}
        {p.open.wardrobe ? (
          <Box flexDirection="row" gap={1}>
            <Button key="wear:auto" onPress={pressed}>{t().ui.auto}</Button>
            <Button key="wear:none" onPress={pressed}>{t().ui.takeAllOff}</Button>
          </Box>
        ) : null}
      </Box>
    ),
    badges: () => (
      <Box key="sec:badges" flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold>{`${t().fun.badges} · ${gists.badges}`}</Text>
          <Button key="fold:badges" onPress={pressed}>{p.open.badges ? t().ui.close : t().ui.open}</Button>
        </Box>
        {p.open.badges ? BADGES.map(b => (
          <Text key={`badge:${b}`} dimColor={!v.badges.includes(b)} wrap="truncate">{`${v.badges.includes(b) ? '★' : '☆'} ${badgeName(b)} · ${badgeHint(b)}`}</Text>
        )) : null}
      </Box>
    ),
    settings: () => terminalSettings,
    more: () => terminalMore,
  }
  const terminalSettings = (
    <Box key="sec:settings" flexDirection="column">
      {head('settings', names.settings, gists.settings)}
      {p.open.settings ? (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            {TOGGLES.map(([key, pref]) => <Button key={`set:${key}`} onPress={pressed}>{`${d.setting[key].name}: ${p[pref] ? d.on : d.off}`}</Button>)}
            <Button key="shield:forget" onPress={pressed}>{d.forget}</Button>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Button key={p.isCompact ? 'size:big' : 'size:small'} onPress={pressed}>{`${d.size.name}: ${p.isCompact ? d.small : d.big}`}</Button>
            <Button key="visible" onPress={pressed}>{`${d.visible.name}: ${p.isHidden ? d.show : d.hide}`}</Button>
            {p.birthday !== '' ? <Button key="bday:off" onPress={pressed}>{`${d.birthday.name}: ${birthdayName(p.birthday)} · ${d.remove}`}</Button> : null}
          </Box>
          {Select ? <Select key="lang" label={`${d.language.name}: `} options={langOptions()} value={p.lang} onSelect={picked} /> : null}
          {Input && p.birthday === '' ? <Input key="bday" label={`${d.birthday.name}: `} placeholder="MM-DD" submitLabel={d.save} onSubmit={picked} /> : null}
        </Box>
      ) : null}
    </Box>
  )
  const terminalMore = (
    <Box key="sec:more" flexDirection="column">
      {head('more', names.more, gists.more)}
      {p.open.more ? (
        <Box flexDirection="column">
          {answer.text !== '' ? answer.text.split('\n').map((line, i) => <Text key={`said:${i}`} color="claude" wrap="wrap">{line}</Text>) : null}
          {answer.text !== '' && answer.open ? <Button key="said:open" onPress={pressed}>{d.open}</Button> : null}
          {answer.text !== '' && answer.copy !== '' ? <Button key="said:copy" onPress={pressed}>{d.copy}</Button> : null}
          {answer.text !== '' ? <Button key="said:close" onPress={pressed}>{d.dismiss}</Button> : null}
          {actionGroups().map(([key, label, actions]) => (
            <Box key={`grp:${key}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text dimColor>{`${label}:`}</Text>
              {actions.map(([what, name]) => <Button key={`do:${what}`} onPress={pressed}>{name}</Button>)}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
  // The tabs' blocks one tab after another, as the desktop groups them.
  const order = TABS.flatMap(tb => inTab(p.order, tb))
  const shown = order.filter(b => !p.hidden.includes(b))
  return (
    <Box flexDirection="column">
      {p.isArranging ? (
        <Box flexDirection="column">
          <Text dimColor>{d.arrangeHintPlain}</Text>
          {order.map(id => (
            <Box key={`row:${id}`} flexDirection="row" gap={1}>
              <Text bold={!p.hidden.includes(id)} dimColor={p.hidden.includes(id)} strikethrough={p.hidden.includes(id)}>{`${d.tabs[TAB_OF[id]]} · ${names[id]}`}</Text>
              {inTab(p.order, TAB_OF[id])[0] !== id ? <Button key={`move:${id}:up`} onPress={pressed}>↑</Button> : null}
              {inTab(p.order, TAB_OF[id]).at(-1) !== id ? <Button key={`move:${id}:down`} onPress={pressed}>↓</Button> : null}
              <Button key={`hide:${id}`} onPress={pressed}>{p.hidden.includes(id) ? d.show : d.hide}</Button>
            </Box>
          ))}
        </Box>
      ) : shown.length === 0 ? <Text dimColor>{d.allHidden}</Text> : shown.map(b => blocks[b]())}
      <Box flexDirection="row" gap={1}>
        <Button key="arrange" onPress={pressed}>{p.isArranging ? d.done : d.arrange}</Button>
        {p.isArranging ? <Button key="arrange:reset" onPress={pressed}>{d.layoutReset}</Button> : null}
      </Box>
    </Box>
  )
}

/** The band above the prompt: the mascot, its line and the facts in the terminal; the panel on the desktop. */
export const band: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  chat.drawnOn = e.surface === 'terminal' ? 'terminal' : 'remote'
  chat.canClick = e.surface === 'desktop'
  const p = await read($, prefs)
  if (p.isHidden) return next(e)

  if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
    // The desktop rebuilds the whole band on every redraw, so this branch
    // reads the panel alone, which changes only when its drawing should; the
    // drawing resumes its animations mid-loop. An <img> (not interactive)
    // keeps the painted parts the interactive frame's scrub would strip.
    const { Box, Svg } = $.ui.resolve(e)
    const pane = await read($, panel)
    const now = await $.clock.now()
    const width = Math.round(Math.min(1600, Math.max(420, e.props.bodyColumns * 8.1 - 8)))
    const alt = `${pane.info.label}: ${pane.info.detail}`
    let drawn: ReturnType<typeof panelSvg>
    try {
      drawn = panelSvg({ panel: pane, now, width })
    } catch {
      // Never an empty band: the mascot alone if the panel cannot be drawn.
      return (
        <Box flexDirection="row" alignItems="center">
          <Svg source={svgFor(pane.shot, Math.max(0, now - pane.shot.at))} alt={alt} width={64} height={64} />
        </Box>
      )
    }
    // A clear region pulled back over the whole panel: a click anywhere on it
    // opens the detail pane. Columns are the band's own unit, about 8.1 pixels
    // here; 3.8 rows (lines) is the panel's height, so the band does not grow.
    const panelCols = Math.max(8, Math.round(drawn.width / 8.1))
    let hit: JSX.Element | null = null
    if (e.surface === 'desktop') {
      const { Client } = $.ui.resolve(e)
      hit = (
        <Box marginLeft={-panelCols} width={panelCols} height={3.8} flexShrink={0}>
          <Client key="hit" module="./hit.tsx" props={{ rows: 6 }} width="100%" height="100%" />
        </Box>
      )
    }
    return (
      <Box flexDirection="row" alignItems="stretch">
        <Svg source={drawn.svg} alt={alt} width={drawn.width} height={PANEL_H} />
        {hit}
      </Box>
    )
  }

  const f = await read($, face)
  const v = await read($, env)
  const look = LOOKS[f.mood]
  const elapsed = f.since > 0 ? (await read($, sec)) - Math.floor(f.since / 1000) : 0
  const status = elapsed >= 2 ? `${f.line} · ${duration(elapsed)}` : f.line
  const now = await $.clock.now()
  const full = forecasts(v, now).five_hour
  const facts = [
    ...(v.context >= 0 ? [t().ctx.percent(v.context)] : []),
    ...(v.agents > 0 ? [t().st.agents(v.agents)] : []),
    ...(chat.isBusy && v.turnTools > 0 ? [t().st.tools(v.turnTools)] : []),
    ...(v.ci?.state === 'running' ? [ciLine(v.ci)] : v.pr ? [prLine(v.pr)] : []),
    ...(full !== undefined ? [`${limitName('five_hour')} ${t().panel.fullAt(clockAt(full, now, v.tz))}`] : []),
  ].join(' · ')
  const factsColor = v.context >= 80 ? 'warning' : undefined

  const { Box, Text } = $.ui.resolve(e)
  const n = await read($, frame)
  const room = Math.max(12, e.props.bodyColumns)

  if (p.isCompact || e.props.maxRows < 5) {
    const head = `${kaomoji(f.mood, n)} `
    const tail = facts === '' ? '' : `  ${facts}`
    return (
      <Box flexDirection="row" gap={1}>
        <Text wrap="truncate">
          <Text color={look.color}>{head}{cut(status, Math.max(8, room - width(head) - width(tail) - 12))}</Text>
          <Text dimColor color={factsColor}>{tail}</Text>
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="row" gap={1}>
      <Box flexDirection="column">
        {withHat(asciiRows(f.mood, n, n === f.frameAt), outfitNow(p, v, f.mood, now).head, LOOKS[f.mood].isShaking === true && n % 2 === 0).map(row => (
          <Text color={look.color} wrap="truncate">{row}</Text>
        ))}
      </Box>
      <Box flexDirection="column" flexShrink={1} justifyContent="center">
        <Text bold color={look.color} wrap="truncate">{cut(status, room - 12)}</Text>
        <Text dimColor color={factsColor} wrap="truncate">{facts === '' ? ' ' : facts}</Text>
      </Box>
    </Box>
  )
}
