# Mochi for other plugins

Mochi adds one noun to `$`, **`$.mochi`**, so any Claude Code plugin can make it react: cheer when a deploy finishes, look worried when a check fails, wave when a long job is ready. Mochi decides how it looks, signs the line with your plugin's name, and keeps the person in charge.

## Depend on Mochi

List Mochi Buddy, `mochi-buddy`, under `dependencies` in your plugin's `.claude-plugin/plugin.json` (it was `mochi` before 0.7.0; the noun is still `$.mochi`):

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "dependencies": ["mochi-buddy"]
}
```

When Claude Code loads your plugin from a folder you own, it lays Mochi's contract (Mochi's `types/index.d.ts`) into your plugin's `.claude-plugin/types/mochi/index.d.ts`, so `$.mochi` is typed in your hooks. Do not copy the file.

## The calls

### `$.mochi.react({ mood, line, holdMs })`

| Field | What it takes |
| --- | --- |
| `mood` | One of `wave`, `pleased`, `success`, `proud`, `party`, `nervous`, `error`, `shocked`. |
| `line` | What happened, in a few plain words: `deploy failed`, `report ready`. Control characters and direction marks become spaces, and the line is cut to 60 columns. Mochi shows your plugin's name after it: `report ready · my-plugin`. |
| `holdMs` | How long it stays, in milliseconds: 1000 to 15000. Optional; 5000 when left out. |

### `$.mochi.celebrate({ line })`

The party mood with your line, held for 6 seconds, with the party sound when the person has sound on.

### The answer

Both resolve to `{ isShown: true }`, or to `{ isShown: false, reason }`:

| `reason` | Why nothing was shown |
| --- | --- |
| `off` | The person turned reactions from other plugins off (`/mochi plugins`). |
| `invalid` | The mood is not on the list, or there is no line. |
| `often` | Your plugin's last reaction was under 10 seconds ago. Each plugin has its own 10 seconds; a refused call does not use them. |
| `busy` | Mochi shows something the person should not miss: it waits on them, the shield asks about a command, a warning or a loop alarm is up, the context is being compacted, or there is a celebration. |

Nothing is queued: a call that is not shown is gone. Never let your plugin's own work depend on the answer.

### What Mochi never lets another plugin do

- Show a mood that means Mochi waits on the person, or that a command is dangerous (`asking`, `scared`, `dizzy`).
- Cover the shield's question, a warning, or a level-up.
- Speak more than once every 10 seconds, or without its name on the line.
- Interrupt someone who said no: `/mochi plugins` turns every other plugin's reactions off and on again.

## Good manners

- React to moments the person cares about (a deploy, a long job, a release), not to every tool call.
- Keep the line short, plain and factual, in lower case: what happened, not a joke. Mochi's own lines read the same way.
- Guard the call. When Mochi is not installed, `$.mochi` is not there; a `try`/`catch` around it keeps your hook working without it.

## Example

[`examples/mochi-deploy-cheer`](../examples/mochi-deploy-cheer) cheers when a deploy command finishes and frets when one fails. Its whole hooks module:

```ts
import type { Register } from 'claude-code'

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
```

Copy the folder, rename the plugin, and load it the way you load any plugin you are working on (see [CONTRIBUTING.md](../CONTRIBUTING.md)). `claude plugin validate .` in its folder checks it.

## Testing with Mochi

Mochi's own tests load a second plugin beside it and drive `$.mochi` end to end: see `tests/data.test.ts` ("a plugin that depends on Mochi makes it react"). A test there passes your plugin's `register` in `test(name, { plugins: [{ name, register }] }, body)` and reads Mochi's status line with `/mochi status`.

## Privacy

`$.mochi` stays on the machine: Mochi draws the reaction and keeps one timestamp per plugin in memory, for the 10 seconds. It writes nothing about the call and sends nothing anywhere.
