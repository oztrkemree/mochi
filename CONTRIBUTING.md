# Contributing to Mochi

Thanks for helping. Bug reports, ideas, translations, art and code are all welcome.

## Reporting a bug

Open an issue with the **Bug report** form. The most useful details:

- what you did, what you expected, what happened instead;
- where Mochi runs: the desktop app or a terminal, and your OS;
- your Claude Code version (`claude --version`) and Mochi's language (`/mochi status`);
- a screenshot of the band or the details pane, if it is about drawing.

## Suggesting an idea

Open an issue with the **Feature request** form, saying what you would like Mochi to notice or show and why.

## Working on the code

1. Fork the repository and clone your fork.
2. Point Claude Code at your copy so every session runs it, and reloads it as you save: in `~/.claude/settings.json`,

   ```json
   { "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/your/mochi", "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1" } }
   ```

   (Uninstall the marketplace copy first, or Mochi loads twice.)
3. Before you open a pull request, both of these must pass:

   ```
   claude plugin validate .
   claude plugin test .
   ```

4. Open the pull request against `main` and fill in the template.

### Where things are

| Path | What it holds |
| --- | --- |
| `hooks/register.tsx` | The hooks: events, state, commands, the band and the details pane |
| `hooks/rig.ts` | The mascot drawing: poses, transitions, accessories |
| `hooks/panel.ts`, `hooks/detail.ts` | The band and the details pane as SVG |
| `hooks/react.ts` | What Mochi says about each tool call, prompt and turn |
| `hooks/guard.ts` | The shield's dangerous-command rules and the loop watch |
| `hooks/level.ts` | Experience, levels, unlocks and outfits |
| `hooks/lang/*.ts` | Every text, one file per language |
| `tests/mochi.test.ts` | The tests |

### Style

- Status lines are short, plain and factual: what is happening, not jokes.
- Match the surrounding code: its naming, comment density and idiom.
- A change you can see comes with a test where the test kit allows it.

### Adding a language

1. Copy `hooks/lang/en.ts` to `hooks/lang/<code>.ts` and translate every value, keeping the keys and the functions' parameters (the type `typeof en` checks you missed none).
2. Add it to `DICTS` and `Lang` in `hooks/i18n.ts`, and its names to `NAMES` there.
3. Run the tests: one of them checks that every language has every key.

Keep lines short, especially in Chinese, Japanese and Korean, where each character takes two columns.

## License

By contributing, you agree that your contribution is licensed under the MIT License of this project.
