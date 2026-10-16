# mochi: the last version, which moves you to Mochi Buddy

Mochi, the clay mascot above the Claude Code prompt, is now called **Mochi Buddy** (`mochi-buddy@mochi`). This branch holds the last version of the old `mochi` plugin. The `mochi` marketplace still lists it, so someone who runs `claude plugin update mochi@mochi` gets this version. It has no mascot of its own: it shows one line above the prompt saying Mochi is now Mochi Buddy, with a **Move** button (or `/mochi move`).

**Move** runs these two commands, then asks you to restart Claude Code:

```bash
claude plugin install mochi-buddy@mochi
claude plugin uninstall mochi@mochi
```

If either fails, it shows them so you can run them yourself. On its first start Mochi Buddy copies the old plugin's settings: language, what is always allowed, your birthday and the rest of what `/mochi` set. Your level, history and wardrobe stay where they were, in `~/.claude/mochi/`. Once Mochi Buddy is on, this plugin draws nothing and leaves `/mochi` to Mochi Buddy.

Mochi Buddy itself lives on the `main` branch: https://github.com/oztrkemree/mochi

## Checking it

```bash
claude plugin validate .
```

```bash
claude plugin test .
```
