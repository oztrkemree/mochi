# Mochi's art

The source pictures behind Mochi's body, props and wardrobe, kept apart from the plugin so it stays small enough to install and to list in the Claude directory.

- `parts.png` and `props.png` are what `hooks/assets.ts` on `main` is generated from.
- `wear.png`, `wear2.png` … `wear6.png`, the four layers in `proposed/` and the held things in `proposed/held/` are what `hooks/wear.ts` on `main` is generated from.
- `proposed/` also holds the drafts and overview sheets that came before them, and `proposed/PROMPTS.md` the prompts they were made with (ChatGPT image generation).

Mochi never reads these files at run time; it draws from the generated TypeScript only. To work on the art, check this branch out next to `main`:

```
git worktree add ../mochi-art art
```
