import type { Register } from 'claude-code'

// Mochi cheers when a deploy command finishes, and frets when one fails.
// What it shows goes through `$.mochi`, which Mochi checks, limits and signs
// with this plugin's name (see Mochi's docs/API.md). Everything sits inside
// `register`, so Mochi's own tests can load this file as it is.

export const register: Register = on => {
  /** Commands that ship something: a package's deploy script, or a host's own deploy command. */
  const DEPLOY = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?deploy\b|vercel\b.*--prod\b|(?:fly|flyctl|firebase|wrangler|netlify|railway)\s+(?:deploy|up)\b)/i

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const cmd = (e.tool === 'Bash' || e.tool === 'PowerShell') && typeof e.command === 'string' ? e.command : ''
    if (!DEPLOY.test(cmd) || ran.deny !== undefined) return ran
    try {
      if (ran.isError) await $.mochi.react({ mood: 'nervous', line: 'deploy failed' })
      else await $.mochi.celebrate({ line: 'deployed' })
    } catch {
      // Without Mochi there is no one to cheer; the command's result stands.
    }
    return ran
  }).catch(($, e, next) => next(e))
}
