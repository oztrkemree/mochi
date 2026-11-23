import { danger, setRules } from '../../hooks/guard'
import { parseRules } from '../../hooks/shield'
import { words } from './words'

/**
 * The shield for the chats the app follows, by the mod's own rules: a shell
 * command that would destroy something is named before it runs, and Claude
 * Code asks the person first, with Mochi's reason in its own dialog.
 */

/** Puts the person's own rules from shield.json in force, as the mod does; rules that do not read are left out. */
export function useRules(text: string | null) {
  const { mine, off } = parseRules(text ?? '')
  setRules({ mine, off })
}

/** Why a shell command waiting on the shield should be asked about first, or null to let it go: what it would do, or that it was too long to read whole. */
export function verdictOf(event: Record<string, unknown>): string | null {
  const input = (event.tool_input ?? {}) as { command?: unknown; cut?: unknown }
  if (typeof input.command !== 'string' || input.command === '') return null
  if (input.cut === true) return words().tooLong
  return danger(input.command)
}
