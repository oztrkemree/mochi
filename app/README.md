# Mochi Buddy on the desktop

One Mochi on your screen, for every agent you run. It stands in a corner above your other windows, wears the face of the chat that most needs you, and speaks up in a short bubble when something happens:

- a chat is waiting for you (a permission, a question, a plan),
- a chat finished a turn of a minute or more,
- a chat hit an error.

News of several chats comes one at a time, the most pressing first. Press the bubble to open its chat in the Claude app; press Mochi for the list of chats, or to hear how things stand. Drag it anywhere: it stays where you leave it. Everything around Mochi lets your presses through to the window behind. With no chat open it sleeps.

It shows your usage limits too: the session and the week as two small rings by its feet, and in full at the top of the list. It says so when one passes four fifths, when one is nearly gone and when it is back, and it is tired near the end of one. With the mod the limits come from its chats; without it, **Settings → Limits without the mod → Connect** makes Mochi Claude Code's status line, which is where Claude Code says them. Your own status line, if you have one, goes on showing: Mochi's runs it and prints what it prints, and Disconnect gives it back as it was.

Press Mochi for its pocket.

- **Now**: the limits, and the chats, each with how far its plan is (`2/4 · Writing the tests`) and its subagents.
- **Today**: your stand-up (the last day you worked and today, your commits and turns, ready to copy), what is not yet safe on a remote, and the pull requests waiting on you. Read from your own `git` and `gh` when you open it.
- **Mochi**: the level and how far to the next, your streak, your badges, the wardrobe, the card to share, and the last weeks as a city. The level is counted from every chat's days, so it is the same level the mod shows, and a new level or badge is said once, by one Mochi. What you pick in the wardrobe the mod's Mochi wears too.

After a `git push` in a chat it follows, Mochi watches that commit's CI and says how it ended. When a turn ends with changes left uncommitted and no commit for an hour and a half, it says so once.

Its eyes follow your pointer when you come near, two quick presses are a pat, and in Settings you can give its news a soft sound. Push it off the bottom of the screen and only its head peeks out; press it, or let news come, and it is back. Enter or Space presses it from the keyboard, it holds still if your system asks for less motion, and it speaks the mod's sixteen languages.

The first time it starts, Mochi says hello, offers to listen to Claude Code and Codex, and asks whether requests may be answered from its bubble. Later it tells one thing more it can do, a day apart at most.

Mochi moves when something happens and holds still the rest of the time: when its mood changes, when it speaks, when your pointer comes over it, for a breath each minute, and now and then while a chat works. Its drawing in motion costs about a fifth of a processor core; at rest, measured with the screen on, the whole app takes about 0.3% of one.

It works for macOS and Windows, with the Mochi Buddy mod or without it.

## Answering a request for permission from the bubble

Off until you say yes; Mochi asks once, the first time it starts. With it on, when a Claude Code chat asks for permission its hook waits up to thirty seconds on Mochi's bubble, which shows the tool and what it is for.

- **Allow** is offered only for a shell command you can read whole: on one line and short enough for the bubble. You answer for what you see.
- An edit (the bubble shows the file, not the change), a long command, or a tool that says nothing of itself can be **denied** here, or opened by pressing the bubble. They are never waved through.
- Answer in Claude Code instead, or do nothing, and the request is Claude Code's own dialog's as always: the hook lets go when the chat goes on, and after thirty seconds at the latest.

In the Claude app the dialog and the bubble are both up and the first answer counts. In a terminal Claude Code may hold its own dialog back while the hook waits.

## The shield

On by default, a switch in Settings. In a Claude Code chat the app follows (not one the mod writes, which the mod shields itself), a shell command that might destroy something waits up to 2.5 seconds while Mochi reads it whole by the mod's own rules and yours in `~/.claude/mochi/shield.json`. One that would (a force push, `rm -rf`, a dropped table, a script piped from the internet…) is asked about first: Claude Code shows its own dialog, with what the command would do, and Mochi says it too. Commands with none of the words the shield looks for (`app/src-tauri/shield-words.json`) do not wait at all; with Mochi hidden, none waits.

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

Updates start with the first release signed with the project's key. Until then the app asks GitHub every 6 hours which desktop releases there are, and says once when a newer one is out, with a button to its page. From that release on, the app looks for a new version a minute after it starts and every 6 hours, on this repository's `desktop-latest` release. It checks the new version's signature before it puts anything in, then starts again on it. Nothing is sent but that request.

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
pnpm dev            # then open http://localhost:1420/preview.html: the window in a browser tab, the app played by a script
pnpm test           # the window's logic
cd src-tauri && cargo test   # files, the inbox, the agents' hooks files, where a press is Mochi's
```

The drawing and the rules are the mod's own files in `../hooks`; the app imports them as they are.

Something went wrong? A crash, or an error in the window, leaves a line in `~/.claude/mochi/app.log` (its last 64 KB). Nothing is sent anywhere; attach it to a bug report if you like.

To release: set the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json`, merge, and push a tag `desktop-vX.Y.Z` on that commit. `.github/workflows/desktop.yml` builds the three installers onto a draft release, which you publish by hand. With the `TAURI_SIGNING_PRIVATE_KEY` secret set (and the key's public half as `plugins.updater.pubkey` in `tauri.conf.json`), it also signs the update files and points `desktop-latest` at them; without it, it builds installers that do not update themselves.
