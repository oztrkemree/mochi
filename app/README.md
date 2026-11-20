# Mochi Buddy on the desktop

One Mochi on your screen, outside Claude Code. It stands in a corner above your other windows, wears the face of the chat that most needs you, and speaks up in a short bubble when something happens:

- a chat is waiting for you (a permission, a question, a plan),
- a chat finished a turn of a minute or more,
- a chat hit an error.

Press Mochi to open that chat in the Claude app; when there is nothing to open, it tells you how things stand. Drag it anywhere: it stays where you leave it. With no chat open it sleeps.

It works for macOS and Windows.

## Where it gets what it knows

- **Claude Code with the Mochi Buddy mod:** every chat's Mochi already writes a small file under `~/.claude/mochi/live/`. The app reads those once a second. Nothing to set up.
- **Codex:** in the tray menu, **Connect Codex**. It adds Mochi's entries to `~/.codex/hooks.json` (or `$CODEX_HOME/hooks.json`), after any you have, and keeps the file as it was once, beside it, as `hooks.json.mochi-backup`. Codex asks you to approve new hooks: run `/hooks` once in Codex. **Disconnect Codex** takes Mochi's entries out again and leaves yours.

Each Codex hook runs `mochi-desktop hook codex`, which takes the call and is gone: it prints nothing, never stops Codex, and writes nothing while the app is not running. While the app runs, it leaves each call in `~/.claude/mochi/inbox/` for the app to take, keeping only what the app reads: which event, the session and folder, the tool's name, the first 300 characters of a command and the first 200 of a prompt.

## The mod and the app together

While the app's Mochi is on screen it writes `~/.claude/mochi/app.json` every 15 seconds, and at once when you show or hide it from the tray. The mod reads it, and its band above the prompt goes on without the mascot: the line, the trail, the facts and the rings stay. Hide or quit the app and the mascot is back in the band within a few seconds. `/mochi desktop off` keeps the mascot in the band whatever the app does.

## Updates

A release build looks for a new version a minute after it starts and every 6 hours, on this repository's `desktop-latest` release. It checks the new version's signature before it puts anything in, then starts again on it. Nothing is sent but that request.

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
cd src-tauri && cargo test   # files, the inbox, Codex's hooks file
```

The drawing and the rules are the mod's own files in `../hooks`; the app imports them as they are.

To release: set the version in `src-tauri/tauri.conf.json` and `package.json`, merge, and push a tag `desktop-vX.Y.Z` on that commit. `.github/workflows/desktop.yml` builds the three installers, signs the update files with the `TAURI_SIGNING_PRIVATE_KEY` secret and points `desktop-latest` at them.
