import { atom, read } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import type { Badge, Item } from '../types'
import { BADGES, badgeHint, badgeName, badgeSvg } from './badges'
import { detailHeight, detailLines, detailSvg, levelSummary, levelSvg } from './detail'
import { clockAt, forecasts } from './facts'
import { t } from './i18n'
import { ASCII_HAT, SLOT, SLOTS, SLOT_ITEMS, hintFor, itemName, itemShort, outfitNow, slotName, wearable } from './level'
import { peersLine } from './live'
import { LOOKS, asciiRows, kaomoji } from './looks'
import { PANEL_H, limitName, panelSvg } from './panel'
import { duration } from './react'
import { VECTOR_WEAR, svgFor } from './rig'
import { ALL_ITEMS, DEFAULT_PREFS, NO_ENV, NO_FACE, NO_PANEL, chat } from './state'
import { WEAR } from './wear'

// What Mochi draws: the band above the prompt (the mascot and its line in the
// terminal, the panel on the desktop) and the details pane, with its level,
// wardrobe and badges. It only reads the values register.tsx keeps, named here
// again because the engine reads the state a file uses from that file's own consts.

const face = atom({ plugin: 'mochi', key: 'face' } as const, NO_FACE)
const panel = atom({ plugin: 'mochi', key: 'panel' } as const, NO_PANEL)
const detail = atom({ plugin: 'mochi', key: 'detail' } as const, NO_ENV)
const frame = atom({ plugin: 'mochi', key: 'frame' } as const, 0)
const sec = atom({ plugin: 'mochi', key: 'sec' } as const, 0)
const env = atom({ plugin: 'mochi', key: 'env' } as const, NO_ENV)
const prefs = atom({ plugin: 'mochi', key: 'prefs' } as const, DEFAULT_PREFS)

const width = (s: string) => [...s].length
const cut = (s: string, max: number) => (width(s) <= max ? s : `${[...s].slice(0, Math.max(1, max - 1)).join('')}…`)

/** The wardrobe's buttons act in the `ui.press` hook, where `$` is at hand; their own handler has nothing left to do. */
const pressed = () => undefined

/** An item's picture for the wardrobe, faded while locked. */
function iconSvg(item: Item, isOpen: boolean): string {
  const vector = VECTOR_WEAR[item]
  if (vector) {
    const [x, y, w, h] = vector.box
    // Glasses read as glasses on a patch of Mochi's own clay, not on the dark card.
    const skin = vector.onSkin ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${Math.min(w, h) / 2 - 1}" fill="#D97757"/>` : ''
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="100%" height="100%"><g opacity="${isOpen ? 1 : 0.38}">${skin}${vector.svg}</g></svg>`
  }
  const a = WEAR[item]
  if (a === undefined) return ''
  const scale = Math.min(44 / a.w, 30 / a.h)
  const w = a.w * scale
  const h = a.h * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 32" width="100%" height="100%"><image href="${a.uri}" x="${(46 - w) / 2}" y="${(32 - h) / 2}" width="${w}" height="${h}" opacity="${isOpen ? 1 : 0.38}"/></svg>`
}

/** The terminal drawing's hat row, when the mood leaves it empty and something is worn on the head. */
function withHat(rows: string[], head: Item | null, isShiftedRight: boolean): string[] {
  const hat = head ? ASCII_HAT[head] : undefined
  const top = rows[0]
  if (hat === undefined || top === undefined || top.trim() !== '') return rows
  const at = isShiftedRight ? 3 : 2
  return [top.slice(0, at) + hat + top.slice(at + 5), ...rows.slice(1)]
}

/** The details pane: the session in full, the level and the wardrobe; lines and buttons in the terminal. */
export const detailPane: MatchedHook<'ui.render', { component: 'Pane' }> = async ($, e) => {
  const v = { ...NO_ENV, ...(await read($, detail)) }
  const now = await $.clock.now()
  if (e.surface === 'desktop' || e.surface === 'mobile' || e.surface === 'vscode') {
    const { Box, Svg } = $.ui.resolve(e)
    const width = Math.round(Math.min(1400, Math.max(320, e.props.bodyColumns * 8.1 - 8)))
    const { Button, Text } = $.ui.resolve(e)
    const p = await read($, prefs)
    const dressed = outfitNow(p, v, (await read($, face)).mood, now)
    const ok = wearable(v.history, now, v.tz, p)
    const svg = detailSvg(v, now, width)
    const isAuto = SLOTS.every(slot => p.pick[slot] === undefined)
    // The wardrobe: every item with its picture; a press puts it on or takes it off.
    const cell = (item: Item) => {
      const isOn = dressed[SLOT[item]] === item
      const isOpen = ok.includes(item)
      return (
        <Box key={`cell:${item}`} flexDirection="column" alignItems="center" width={11} paddingTop={0.4} borderStyle="round" borderColor={isOn ? 'claude' : 'inactive'} borderDimColor={!isOn}>
          <Svg source={iconSvg(item, isOpen)} alt={itemName(item)} width={46} height={32} />
          {isOpen
            ? <Button key={`wear:${item}`} plain dimColor={!isOn} onPress={pressed}>{itemShort(item)}</Button>
            : <Text dimColor wrap="truncate">{hintFor(item)}</Text>}
        </Box>
      )
    }
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
    const worn = SLOTS.map(slot => dressed[slot]).filter((x): x is Item => x !== null).map(itemShort)
    const levelWidth = Math.max(280, width - 56)
    const level = p.open.level ? levelSvg(v, now, levelWidth) : ''
    // Folding sections under the drawing, folded by default: a heading
    // with the gist, the rest only when opened. Which are open is kept.
    return (
      <Box flexDirection="column">
        <Svg source={svg} alt={t().detail.title} width={width} height={Math.round(detailHeight(svg))} />
        <Box flexDirection="column" paddingX={2} paddingBottom={2} gap={1}>
          <Box key="sec:level" flexDirection="column" borderStyle="round" borderColor="inactive" borderDimColor paddingX={1} gap={0.5}>
            <Box flexDirection="row" alignItems="center" gap={2}>
              <Text bold dimColor>{t().ui.levelTitle}</Text>
              <Text wrap="truncate">{levelSummary(v)}</Text>
              <Box flexGrow={1} />
              <Button key="fold:level" variant="secondary" onPress={pressed}>{p.open.level ? t().ui.close : t().ui.open}</Button>
            </Box>
            {p.open.level ? <Svg source={level} alt={t().ui.levelTitle} width={levelWidth} height={Math.round(detailHeight(level))} /> : null}
          </Box>
          <Box key="sec:wardrobe" flexDirection="column" borderStyle="round" borderColor="inactive" borderDimColor paddingX={1} gap={1}>
            <Box flexDirection="row" alignItems="center" gap={2}>
              <Text bold dimColor>{t().ui.wardrobeTitle}</Text>
              <Text wrap="truncate">{`${t().ui.unlockedOf(ok.length, ALL_ITEMS.length)} · ${t().ui.wearing(worn.length > 0 ? worn.join(', ') : t().ui.nothing)}`}</Text>
              <Box flexGrow={1} />
              {p.open.wardrobe ? <Button key="wear:auto" variant={isAuto ? 'primary' : 'secondary'} onPress={pressed}>{t().ui.auto}</Button> : null}
              {p.open.wardrobe ? <Button key="wear:none" variant="secondary" onPress={pressed}>{t().ui.takeAllOff}</Button> : null}
              <Button key="fold:wardrobe" variant="secondary" onPress={pressed}>{p.open.wardrobe ? t().ui.close : t().ui.open}</Button>
            </Box>
            {p.open.wardrobe ? SLOTS.map(slot => (
              <Box key={`slot:${slot}`} flexDirection="column" gap={0.5}>
                <Text dimColor>{`${slotName(slot)} · ${dressed[slot] ? itemName(dressed[slot]) : t().ui.empty}${p.pick[slot] === undefined ? t().ui.autoMark : ''}`}</Text>
                <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0.5}>
                  {SLOT_ITEMS[slot].map(cell)}
                </Box>
              </Box>
            )) : null}
          </Box>
          <Box key="sec:badges" flexDirection="column" borderStyle="round" borderColor="inactive" borderDimColor paddingX={1} gap={1}>
            <Box flexDirection="row" alignItems="center" gap={2}>
              <Text bold dimColor>{t().fun.badgesTitle}</Text>
              <Text wrap="truncate">{t().fun.earned(v.badges.length, BADGES.length)}</Text>
              <Box flexGrow={1} />
              <Button key="fold:badges" variant="secondary" onPress={pressed}>{p.open.badges ? t().ui.close : t().ui.open}</Button>
            </Box>
            {p.open.badges ? <Box flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>{BADGES.map(medal)}</Box> : null}
          </Box>
        </Box>
      </Box>
    )
  }
  const { Box, Button, Text } = $.ui.resolve(e)
  const p = await read($, prefs)
  const dressed = outfitNow(p, v, (await read($, face)).mood, now)
  const ok = wearable(v.history, now, v.tz, p)
  return (
    <Box flexDirection="column">
      {detailLines(v, now).map(line => <Text wrap="truncate">{line}</Text>)}
      <Box flexDirection="row" gap={1}>
        <Text bold>{levelSummary(v)}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text bold>{`${t().ui.wardrobe} · ${t().ui.unlockedOf(ok.length, ALL_ITEMS.length)}`}</Text>
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
      <Box flexDirection="row" gap={1}>
        <Text bold>{`${t().fun.badges} · ${t().fun.earned(v.badges.length, BADGES.length)}`}</Text>
        <Button key="fold:badges" onPress={pressed}>{p.open.badges ? t().ui.close : t().ui.open}</Button>
      </Box>
      {p.open.badges ? BADGES.map(b => (
        <Text key={`badge:${b}`} dimColor={!v.badges.includes(b)} wrap="truncate">{`${v.badges.includes(b) ? '★' : '☆'} ${badgeName(b)} · ${badgeHint(b)}`}</Text>
      )) : null}
    </Box>
  )
}

/** The band above the prompt: the mascot, its line and the facts in the terminal; the panel on the desktop. */
export const band: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  chat.drawnOn = e.surface === 'terminal' ? 'terminal' : 'remote'
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
    // A clear region pulled back over the gauges: a click there opens the
    // detail pane. Columns are the band's own unit, about 8.1 pixels here;
    // 3.8 rows (lines) is the panel's height, so the band does not grow.
    const cardCols = Math.max(8, Math.round(drawn.card.w / 8.1))
    let hit: JSX.Element | null = null
    if (e.surface === 'desktop') {
      const { Client } = $.ui.resolve(e)
      hit = (
        <Box marginLeft={-cardCols} width={cardCols} height={3.8} flexShrink={0}>
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
  const others = peersLine(v.peers)
  const facts = [
    ...(v.context >= 0 ? [t().ctx.percent(v.context)] : []),
    ...(v.agents > 0 ? [t().st.agents(v.agents)] : []),
    ...(chat.isBusy && v.turnTools > 0 ? [t().st.tools(v.turnTools)] : []),
    ...(full !== undefined ? [`${limitName('five_hour')} ${t().panel.fullAt(clockAt(full, now, v.tz))}`] : []),
    ...(others !== null ? [others] : []),
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
