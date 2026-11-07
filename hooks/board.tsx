import type { ClientModule } from 'claude-code'

/**
 * A clear region laid over the pull requests' board. The board is an image
 * and hears no clicks; this region does, and tells the plugin how far down
 * it the press landed (0 to 1), which the board's own layout turns into the
 * pull request to open. Like floor.tsx, it draws an explicit height in rows,
 * and its holder clips what is past the board.
 */
const Board: ClientModule<{ rows: number }> = (props, surface) => {
  surface.onPointer(e => {
    if (e.type !== 'up' || (e.button !== undefined && e.button !== 'left') || surface.rows <= 0) return
    surface.post({ fy: (e.fine?.y ?? e.y + 0.5) / surface.rows })
  })
  const { Box } = surface.elements
  return <Box key="board" width="100%" height={props.rows} />
}

export default Board
