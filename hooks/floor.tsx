import type { ClientModule } from 'claude-code'

/**
 * A clear region laid over the party's floor. The floor is an image and hears
 * no clicks; this region does, and tells the plugin how far across it the
 * press landed (0 to 1), which the floor's own layout turns into a chat. Every
 * Mochi stands on one line, so across is all it takes. Like hit.tsx, it draws
 * an explicit height in rows, and its holder clips what is past the floor.
 */
const Floor: ClientModule<{ rows: number }> = (props, surface) => {
  surface.onPointer(e => {
    if (e.type !== 'up' || (e.button !== undefined && e.button !== 'left') || surface.columns <= 0) return
    surface.post({ fx: (e.fine?.x ?? e.x + 0.5) / surface.columns })
  })
  const { Box } = surface.elements
  return <Box key="floor" width="100%" height={props.rows} />
}

export default Floor
