import type { ClientModule } from 'claude-code'

/**
 * A clear region laid over the panel's gauges. The panel itself is an image
 * and hears no clicks; this region does, and asks the plugin to open the
 * detail pane. The desktop's pointer target is as tall as what the module
 * draws (one line at least), so the region draws an explicit height in rows,
 * and its holder clips what is past the panel.
 */
const Hit: ClientModule<{ rows: number }> = (props, surface) => {
  surface.onPointer(e => {
    if (e.type === 'up' && (e.button === undefined || e.button === 'left')) surface.post({ open: 'detail' })
  })
  const { Box } = surface.elements
  return <Box key="hit" width="100%" height={props.rows} />
}

export default Hit
