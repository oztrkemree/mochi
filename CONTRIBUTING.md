# Contributing to Mochi

Thanks for helping. Bug reports, ideas, translations, art and code are all welcome.

## Reporting a bug

Open an issue with the **Bug report** form. `/mochi feedback` prints a link to it with the versions, your system, the surface and the language already filled in. The most useful details:

- what you did, what you expected, what happened instead;
- where Mochi runs: the desktop app or a terminal, and your OS;
- your Claude Code version (`claude --version`) and Mochi's language (`/mochi status`);
- a screenshot of the band or the details pane, if it is about drawing.

## Suggesting an idea

Open an issue with the **Feature request** form, saying what you would like Mochi to notice or show and why. Something new for Mochi to wear goes in the **Outfit idea** form.

## Working on the code

1. Fork the repository and clone your fork.
2. Point Claude Code at your copy so every session runs it, and reloads it as you save: in `~/.claude/settings.json`,

   ```json
   { "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/your/mochi", "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1" } }
   ```

   (Uninstall the marketplace copy first, or Mochi loads twice.)
3. Before you open a pull request, both of these must pass, with Claude Code 2.1.293 or later:

   ```
   claude plugin validate .
   claude plugin test .
   ```

4. Open the pull request against `main` and fill in the template.

### Where things are

| Path | What it holds |
| --- | --- |
| `hooks/register.tsx` | The hooks and everything that acts through `$`: events, state, `/mochi`, and one block for each feature |
| `hooks/render.tsx` | The band and the details pane, drawn from state |
| `hooks/state.ts` | The defaults of the state and the bookkeeping both of those share |
| `hooks/rig.ts` | The mascot drawing: poses, transitions, accessories |
| `hooks/panel.ts`, `hooks/detail.ts` | The band and the details pane as SVG |
| `hooks/react.ts` | What Mochi says about each tool call, prompt and turn |
| `hooks/guard.ts` | The shield's dangerous-command rules and the loop watch |
| `hooks/shield.ts` | Force pushes by branch, “Always allow here”, `shield.json` and the secret guard |
| `hooks/chats.ts` | The board of every chat, long waits and the limit coming back |
| `hooks/party.ts` | The party: where each chat stands, in what order, which Mochis move and how a crowd is grouped |
| `hooks/ci.ts` | Reading `gh` about a push's runs and the branch's pull request |
| `hooks/coach.ts` | Tips, the instructions worth adding to `CLAUDE.md`, the tour and what is new |
| `hooks/share.ts` | The card, the wrapped and the snapshots |
| `hooks/badges.ts` | The badges and how each is earned |
| `hooks/fun.ts` | Special days, small surprises and breaks |
| `hooks/level.ts` | Experience, levels, unlocks and outfits |
| `hooks/api.ts` | What other plugins may ask of Mochi through `$.mochi` |
| `hooks/data.ts` | What `/mochi export`, `reset` and `feedback` take |
| `hooks/system.ts` | The commands that differ by system: notifications, deleting files, the system's language |
| `hooks/lang/*.ts` | Every text, one file per language |
| `types/index.d.ts` | The shared types, and `$.mochi`'s contract for other plugins |
| `tests/*.test.ts` | The tests, one file per feature: `mochi`, `shield`, `chats`, `party`, `ci`, `coach`, `share`, `delight`, `data` |
| `docs/API.md` | How another plugin makes Mochi react |
| `docs/OUTFITS.md` | How to add something for Mochi to wear |
| the `art` branch | The source pictures `hooks/assets.ts` and `hooks/wear.ts` are generated from, with their drafts and prompts; kept off `main` so the plugin stays small (`git worktree add ../mochi-art art`) |

The engine follows `$` only into functions declared in the same file, and reads the state a file uses from that file's own consts. So code that acts through `$` goes in `register.tsx`, in its feature's block (`// ---------- shield ----------` and the like), and a `/mochi` subcommand is one more entry in its `commands` list. Code that does not touch `$` goes in its own module, where its feature's test file can call it directly.

### Style

- Status lines are short, plain and factual: what is happening, not jokes.
- Match the surrounding code: its naming, comment density and idiom.
- A change you can see comes with a test where the test kit allows it, in its feature's test file.

### The demo

`docs/demo.svg`, the animation at the top of the README, is drawn by Mochi's own code. After a change to the band, the mascot or what Mochi says, draw it again from the repository's folder with Node 22.18 or later:

```
node scripts/demo.mjs
```

It uses a fixed moment, so the same code always gives the same file.

### Adding a language

1. Copy `hooks/lang/en.ts` to `hooks/lang/<code>.ts` and translate every value, keeping the keys and the functions' parameters (the type `typeof en` checks you missed none).
2. Add it to `DICTS` and `Lang` in `hooks/i18n.ts`, and its names to `NAMES` there.
3. Teach Mochi what people say in it: good night, love and hello in `hooks/fun.ts`; thanks and “it does not work” in `hooks/react.ts`. The standing instructions people give (always, never, use…), their “this” and “here” and their “please”, in `hooks/coach.ts`.
4. Run the tests: one of them checks that every language has every key.

Keep lines short, especially in Chinese, Japanese and Korean, where each character takes two columns.

## License

By contributing, you agree that your contribution is licensed under the MIT License of this project.
