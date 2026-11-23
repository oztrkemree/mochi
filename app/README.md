# Mochi Buddy on the desktop

One Mochi on your screen, for every agent you run. It stands in a corner above your other windows, wears the face of the chat that most needs you, and speaks up in a short bubble when something happens:

- a chat is waiting for you (a permission, a question, a plan),
- a chat finished a turn of a minute or more,
- a chat hit an error.

News of several chats comes one at a time, the most pressing first. Press the bubble to open its chat in the Claude app; press Mochi for the list of chats, or to hear how things stand. Drag it anywhere: it stays where you leave it. Everything around Mochi lets your presses through to the window behind. With no chat open it sleeps.

It works for macOS and Windows, with the Mochi Buddy mod or without it.

## Where it gets what it knows

- **Claude Code with the Mochi Buddy mod:** every chat's Mochi already writes a small file under `~/.claude/mochi/live/`. The app reads them. Nothing to set up.
- **Claude Code without the mod:** in Settings, **Claude Code → Connect**. It adds Mochi's entries to the `hooks` of `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`), after any you have, touches nothing else in the file, and keeps the file as it was once, beside it, as `settings.json.mochi-backup`. Chats you open from then on tell Mochi what they do. **Disconnect** takes Mochi's entries out again and leaves yours.
- **Codex:** in Settings, **Codex → Connect**. The same, in `~/.codex/hooks.json` (or `$CODEX_HOME/hooks.json`). Codex asks you to approve new hooks: run `/hooks` once in Codex.

On Windows the hook connection is not tried yet: if the agent runs hooks through PowerShell, the quoted path may need `&` before it.

Each hook runs `mochi-desktop hook <agent>`, which takes the call and is gone: it prints nothing, never stops the agent, and writes nothing while the app is not running. While the app runs, it leaves each call in `~/.claude/mochi/inbox/` for the app to take, keeping only what the app reads: which event, the session and folder, the tool's name, the chat's title, the first 300 characters of a command and the first 200 of a prompt.

## One Mochi, whichever you use

The app keeps its files where the mod keeps its own, in the same shapes ([docs/DATA.md](../docs/DATA.md)). A chat the app follows is written to `live/` for every other Mochi to see, and what you do in it is counted into `days/` the way the mod counts its own chats: turns, tool calls, edits, commits. So work in Codex earns the same experience as work in Claude Code, and if you install the mod weeks later it opens on the level you already have.

Each chat has one writer. With the mod on, a Claude Code chat is the mod's and the app only reads it; the app never counts a chat twice.

## The mod and the app together

The app's Mochi wears what the band's Mochi wears: the mod writes your picks and what you have opened to `~/.claude/mochi/look.json`, and the app dresses its Mochi by them, with the same seasons and nightcap.

While the app's Mochi is on screen it writes `~/.claude/mochi/app.json` every 15 seconds, and at once when you show or hide it from the tray. The mod reads it, and its band above the prompt goes on without the mascot: the line, the trail, the facts and the rings stay. Hide or quit the app and the mascot is back in the band within a few seconds. `/mochi desktop off` keeps the mascot in the band whatever the app does.

## Updates

Updates start with the first release signed with the project's key; until then the app looks for none. From that release on, the app looks for a new version a minute after it starts and every 6 hours, on this repository's `desktop-latest` release. It checks the new version's signature before it puts anything in, then starts again on it. Nothing is sent but that request.

## Install

Download the file for your computer from the latest `desktop-v` release.

The app is not signed with an Apple or Microsoft certificate yet, so the first start asks once:

- **macOS:** open it, then in System Settings → Privacy & Security, choose **Open Anyway** for Mochi Buddy.
- **Windows:** SmartScreen says it does not know the app: **More info** → **Run anyway**. Windows 11's Smart App Control may block it outright.

## Building it

You need Node 22 or later, pnpm, Rust and, on macOS, the Xcode Command Line Tools.

```
cd app
pnpm install
pnpm tauri dev      # runs it, and reloads as you edit
pnpm test           # the window's logic
cd src-tauri && cargo test   # files, the inbox, the agents' hooks files, where a press is Mochi's
```

The drawing and the rules are the mod's own files in `../hooks`; the app imports them as they are.

To release: set the version in `src-tauri/tauri.conf.json` and `package.json`, merge, and push a tag `desktop-vX.Y.Z` on that commit. `.github/workflows/desktop.yml` builds the three installers. With the `TAURI_SIGNING_PRIVATE_KEY` secret set (and the key's public half as `plugins.updater.pubkey` in `tauri.conf.json`), it also signs the update files and points `desktop-latest` at them; without it, it builds installers that do not update themselves.
