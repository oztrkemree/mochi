import type { ClientModule } from 'claude-code'

/** One block of the details pane as the list shows it. */
type Row = { id: string; title: string; gist: string; isHidden: boolean }
type Props = { rows: Row[]; shown: string; hidden: string }
/** The block held and the place it would drop at; the order sent, and the order it replaced; the row the keys move. */
type State = { drag: { id: string; from: number; to: number } | null; sent: { ids: string[]; over: string } | null; sel: number }

/** Rows of the region per block: room enough to aim at. */
const H = 2
/** Columns at the right whose click shows or hides a block. */
const EYE = 12

/** The order with the block at `from` moved to `to`. */
const move = (ids: string[], from: number, to: number) => {
  const out = ids.filter((_, i) => i !== from)
  out.splice(to, 0, ids[from] ?? '')
  return out
}

/**
 * The details pane's blocks as a list to arrange: a block is dragged by its
 * row to another place, the list following the pointer, and dropped there; a
 * click at the right shows or hides it. With the focus, ↑↓ pick a row,
 * shift+↑↓ move it and space shows or hides it. Each change goes to the plugin
 * as `{ order }` or `{ hide }`; the pane draws it back.
 */
const Arrange: ClientModule<Props, State> = (props, surface) => {
  const s: State = surface.state ?? { drag: null, sent: null, sel: 0 }
  const given = props.rows.map(r => r.id)
  // What was sent stands while the pane still draws the order it replaced, so a drop never flashes back.
  const base = s.sent !== null && s.sent.over === given.join() ? s.sent.ids : given
  const ids = s.drag ? move(base, s.drag.from, s.drag.to) : base
  const byId = new Map(props.rows.map(r => [r.id, r]))
  const at = (y: number) => Math.max(0, Math.min(base.length - 1, Math.floor(y / H)))

  surface.onPointer(e => {
    if (e.type === 'down' && (e.button === undefined || e.button === 'left')) {
      const from = at(e.y)
      const id = base[from]
      if (id !== undefined && e.x < surface.columns - EYE) surface.setState({ ...s, drag: { id, from, to: from }, sel: from })
    } else if (e.type === 'move' && s.drag) {
      const to = at(e.y)
      if (to !== s.drag.to) surface.setState({ ...s, drag: { ...s.drag, to } })
    } else if (e.type === 'up') {
      if (s.drag) {
        const next = move(base, s.drag.from, s.drag.to)
        surface.setState({ drag: null, sent: { ids: next, over: given.join() }, sel: s.drag.to })
        if (s.drag.to !== s.drag.from) surface.post({ order: next })
      } else if (e.x >= surface.columns - EYE) {
        const id = base[at(e.y)]
        if (id !== undefined) surface.post({ hide: id })
      }
    }
  })
  surface.onKey(e => {
    const sel = Math.max(0, Math.min(base.length - 1, s.sel))
    const step = e.key === 'up' ? -1 : e.key === 'down' ? 1 : 0
    const to = Math.max(0, Math.min(base.length - 1, sel + step))
    if (step !== 0 && e.shift && to !== sel) {
      const next = move(base, sel, to)
      surface.setState({ ...s, sent: { ids: next, over: given.join() }, sel: to })
      surface.post({ order: next })
    } else if (step !== 0) surface.setState({ ...s, sel: to })
    else if (e.key === ' ' || e.key === 'space') {
      const id = base[sel]
      if (id !== undefined) surface.post({ hide: id })
    }
  })

  const { Box, Text } = surface.elements
  return (
    <Box key="arrange" flexDirection="column" width="100%">
      {ids.map((id, i) => {
        const r = byId.get(id)
        if (r === undefined) return null
        const isHeld = s.drag?.id === id
        const isPicked = s.drag === null && i === s.sel
        return (
          <Box key={`row:${id}`} height={H} flexDirection="row" alignItems="center" gap={2} paddingX={1}>
            <Text color={isHeld ? 'claude' : undefined} dimColor={!isHeld && !isPicked}>{isHeld ? '⠿▸' : isPicked ? '⠿›' : '⠿ '}</Text>
            <Text bold={!r.isHidden} dimColor={r.isHidden} strikethrough={r.isHidden} color={isHeld ? 'claude' : undefined}>{r.title}</Text>
            <Text dimColor wrap="truncate">{r.gist}</Text>
            <Box flexGrow={1} />
            <Text color={r.isHidden ? 'inactive' : 'claude'}>{r.isHidden ? `○ ${props.hidden}` : `● ${props.shown}`}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export default Arrange
