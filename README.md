<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, a small clay mascot, waving, thinking, reading, typing, celebrating and falling asleep">

# Mochi

**A little clay friend for Claude Code.**<br>
It sits above your prompt, reacts to everything Claude does,<br>
and keeps the numbers you keep checking in plain sight.

[![License: MIT](https://img.shields.io/badge/license-MIT-E08A6A?style=flat-square)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#-install)
[![10 languages](https://img.shields.io/badge/languages-10-7AA2F7?style=flat-square)](#-languages)
[![36 accessories](https://img.shields.io/badge/wardrobe-36_items-B794F6?style=flat-square)](#-a-wardrobe-that-grows-with-you)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-4CC38A?style=flat-square)](CONTRIBUTING.md)

**English** · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-en-dark.png">
  <img src="docs/band-en-light.png" alt="Mochi's band above the prompt: editing checkout.tsx, the last tool calls, the branch, another chat waiting, and rings for context, the 5-hour session and the week">
</picture>

<p align="center"><sub>Everything at a glance: what Claude is doing right now, the last tool calls, your branch, another chat that needs you, and how full your context, session and week are.</sub></p>

## ✨ Install

```
/plugin install mochi --marketplace oztrkemree/mochi
```

Type it in any Claude Code chat, answer `y` to add the marketplace and pick the **user** scope. Mochi appears at once, and in every chat you open after that.

> [!NOTE]
> Mochi is built on Claude Code's hooks modules (function hooks), so it needs a Claude Code build that supports them.

## 🧡 What Mochi notices

<table>
<tr>
<td width="50%" valign="top">

**🎭 27 moods, no jump cuts**<br>
Thinking, reading, typing, running a command, waiting for you, celebrating a green test run, dizzy after three errors in a row, asleep when you are away. Every pose eases out of the last.

</td>
<td width="50%" valign="top">

**📊 Your limits, with a forecast**<br>
Rings for the context window, the 5‑hour session and the week. If you are burning through a window faster than it resets, Mochi tells you *when* it will run out.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ A shield for the scary commands**<br>
`rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `npm publish`, `sudo`… they stop and ask first, saying in plain words what they would destroy.

</td>
<td valign="top">

**🔁 A loop watch**<br>
The same command failing three times, the same error coming back, the same call returning the same thing: Mochi notices before your limit does.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Long-job alerts**<br>
A system notification (macOS, Windows or Linux) when a turn longer than two minutes ends, or when a long job stops to wait for your approval. Go make tea.

</td>
<td valign="top">

**💬 Your other chats**<br>
Every chat on your machine running Mochi shares where it stands, so this one can tell you that another is waiting for you or has finished.

</td>
</tr>
</table>

## 🔍 The details pane

Click the rings and everything opens up: this session at a glance, your other chats, and **every changed file with the lines added and removed**, the ones Claude touched in this chat first, and the last edit itself, red and green.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-en-dark.png">
  <img src="docs/details-en-light.png" width="720" alt="The details pane: rings for context and limits with a forecast, this session's numbers, other chats, and a list of changed files with line counts and the last edit">
</picture>

Further down: the context by category, your recent turns, and a calendar of every chat's days.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-en-dark.png">
  <img src="docs/history-en-light.png" width="720" alt="A calendar of the last months of work, with today's turns, the last seven days and your streak">
</picture>

## 👒 A wardrobe that grows with you

Every turn, edit, commit and working day earns experience. Levels unlock things to wear: **36 items** across head, face, neck, hand and the spot beside Mochi. Some arrive with the season (a witch hat in late October, a Santa hat in December), some with the hour (coffee in the morning, a night cap after midnight).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Twelve Mochis in different outfits: a beanie with coffee, a cowboy with a mustache, a wizard, a party hat, a crown with a monocle and a cat, a night cap with a scarf, and more">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-en-dark.png">
  <img src="docs/level-en-light.png" width="640" alt="Mochi's level: a ring of experience, the experience to the next level and the next item to unlock">
</picture>

Pick what to wear in the **Wardrobe** section of the details pane, or with `/mochi wear glasses`.

## ⌨️ Commands

| Command | What it does |
| --- | --- |
| `/mochi` | Hide or show the band |
| `/mochi details` | Open the details pane |
| `/mochi level` | Your level, experience and what is still locked |
| `/mochi wear [item \| auto \| none]` | Put something on, let Mochi dress itself, or take everything off |
| `/mochi shield` | Turn the shield on or off |
| `/mochi alerts` | Turn long-job notifications on or off |
| `/mochi sound` | Turn the sounds on or off |
| `/mochi lang [code \| auto]` | Show or change the language |
| `/mochi small` · `/mochi big` | One line or full size |
| `/mochi status` | What Mochi knows right now |

English command words always work, and each language adds its own (`/mochi aksesuar`, `/mochi idioma`, `/mochi sprache`…).

## 🌍 Languages

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어

Mochi speaks Claude Code's `language` setting when it is one of these; otherwise your system's preferred language, then `LANG`; otherwise English. `/mochi lang ja` picks one yourself, `/mochi lang auto` goes back to automatic.

## 🔒 What it touches

Everything stays on your machine. Mochi makes **no network requests**.

- It reads `git status`, `git log` and `git diff --numstat` in the chat's folder.
- For notifications it runs the system's own tool: `osascript` on macOS, PowerShell on Windows, `notify-send` on Linux. For the language, `defaults read -g AppleLanguages` on macOS and PowerShell on Windows; `uname` tells macOS from Linux.
- It writes small JSON files under `~/.claude/mochi/`: where each open chat stands, daily counts, your level, and usage readings for the forecast.

## 🤝 Contributing

Bug reports, ideas, translations, art and pull requests are all welcome. [Open an issue](https://github.com/oztrkemree/mochi/issues/new/choose), or read [CONTRIBUTING.md](CONTRIBUTING.md) to start on the code: two commands check everything (`claude plugin validate .` and `claude plugin test .`), and a new language is one file.

## 📄 License

[MIT](LICENSE). Use it, change it, share it.

<p align="center"><sub>Made with care by <a href="https://github.com/oztrkemree">Emre Öztürk</a> and Claude.</sub></p>
