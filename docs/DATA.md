# Mochi's files

Mochi keeps everything it knows in one folder, `~/.claude/mochi/`. The mod inside Claude Code and the desktop app both read and write it, so a person can use either, or both, and meet the same Mochi: the same level, the same wardrobe, the same chats.

This page is the contract between the two. Change a file's shape here first.

## Rules

1. **One writer per file.** A chat's files (`live/<id>.json`, `days/<id>.json`) are written by whichever Mochi follows that chat, never by both.
   - A chat in Claude Code with the mod on is the mod's.
   - Every other chat is the app's: Claude Code without the mod, Codex, any agent whose hooks call the app.
   - The app checks before each write. A fresh `live/<id>.json` that does not say `"by": "app"` belongs to the mod, and the app lets go of that chat: no file, no counting.
2. **A reader never trusts a file.** Each field is checked, a file that does not parse is read again next time, and a missing field counts as its zero.
3. **The app writes whole files**: beside the file first, then over it. The mod writes through Claude Code's own file call, which this page does not promise is whole; rule 2 covers it.
4. **Names are plain.** A chat's id is letters, digits, `-` and `_`. A Claude Code chat's id is its session id, whoever writes it. Another agent's is `<agent>-<session>`, for example `codex-019a…`.
5. **Nothing secret is written.** No prompt text beyond a chat's short label, no file contents, no tokens.

## Files

| File | Written by | What it holds |
|---|---|---|
| `live/<id>.json` | the chat's Mochi: on a change (the mod at most every 1.5 s) and again every 15 s | Where the chat stands now. See below. |
| `days/<id>.json` | the chat's Mochi, when a turn ends | `{id, label, isLabelFromPrompt, folder?, days: {"YYYY-MM-DD": DayRec}}`. `folder`, where the chat works, is written by the app (the mod does not yet); a reader without it goes by `label` |
| `level.json` | any Mochi (the mod, or the app), when the level or the wardrobe grew | `{level, items}`: what was last celebrated, so it is celebrated once, by whichever Mochi saw it first |
| `badges.json` | any Mochi (the mod, or the app), when a badge is won | the badges, oldest first; added to, never taken from |
| `said-level.json`, `said-badges.json` | the first Mochi to see a new level or badge | `{at, id}`: who says it, so it is said once. `at` names the news: `level × 1000 + items open` for the level, the number of badges for the badges. Claimed only while the app's Mochi is out (shown): the app as `app`, the mod's chats with their session id. With the app hidden or closed, the mod says it without a claim |
| `prefs.json` | any Mochi, when the person chooses what Mochi wears | `{v: 1, at, pick, skin?}`: the last choice, slot by slot (an item, `null` for nothing, no key for Mochi's own pick), and Mochi's colour chosen in either Mochi (`hooks/skins.ts`; absent for its own clay). The other Mochi wears the pick and the colour too; a Mochi that writes only a pick keeps the colour as it was |
| `statusline.json` | the app, when the person makes Mochi Claude Code's status line | the `statusLine` setting they had before, which Mochi's goes on showing and gives back. Its only copy: no reset takes it, and while it cannot be read the app does not give their line up |
| `look.json` | the mod, when the look changes | `{v: 1, pick, items, tz, birthday, firstDay}`: what Mochi wears |
| `usage.json` | the mod, every 5 minutes | `[{kind, at, p}]`: readings of the usage windows |
| `reset-<kind>.json` | the first Mochi to see a usage window reset | `{at, id}`: who says so, so it is said once |
| `repos.json` | any Mochi, at most once an hour for each repository a chat works in | `{"<repo root>": lastSeenMs}`, without those quiet for 30 days; the stand-up reads those seen in 14 |
| `coach.json` | the mod | which tips were shown, and rules a person repeats |
| `app.json` | the app, every 15 s while it runs; removed when it quits | `{v: 1, at, isShown, version, approve, shield}` |
| `app.log` | the app: a crash, or an error in its window, a line each; kept to its last 64 KB | `<ms> <what>` lines, for the person to send with a bug report if they want. Nothing is sent anywhere |
| `inbox/<ms>-<pid>.json` | the app's `hook` command, one file per hook call; the app takes each out as it reads it. A call that waits on Mochi is named `<ms>-<pid>-ask.json`, and read at once | `{source, at, event, ask?}` |
| `answers/<ms>-<pid>-ask.json` | the app: the person's answer to a request for permission in Mochi's bubble, or the shield's word on a shell command; the waiting hook takes it out | `{behavior, why}`: `allow`, `deny`, `none`, or `ask` with why |
| `shield.json` | the person, by hand | `{add, off}`: their own shield rules |
| `share/`, `export-*.json` | the mod, when asked | pictures and exports |

### `live/<id>.json`

One chat as its Mochi last saw it. A file not written for 45 seconds is a closed chat.

| Field | Meaning |
|---|---|
| `id`, `label`, `title` | the chat's id, its short name (its folder, or its first words), and its title in the app if it has one |
| `state` | `busy`, `asking`, `idle` or `error` |
| `since`, `stateAt`, `at` | when the turn began, when the chat came to its state, when the file was written (ms) |
| `v` | `2` when the fields below are there |
| `activity` | what a busy chat does: `thinking`, `reading`, `writing`, `testing`… |
| `waitingFor` | what an asking chat waits for: `permission`, `question`, `plan` |
| `lastTurn` | `{at, reason, seconds}` of the last finished turn |
| `agents` | the chat's subagents running now, at most 8 |
| `plan` | `{total, done, now}`: how far the chat's plan (its to-do list or tasks) is, and the step under way in 60 characters; absent where the writer does not know it. Written by the app; the version stays 2, so an older mod still reads the rest |
| `context`, `cost`, `limit`, `windows` | context use, cost, and the usage windows, where the writer knows them |
| `folder`, `branch`, `isWorktree`, `app` | where the chat works, and its session in the Claude app if a link can open it |
| `by` | `"app"` in a file the desktop app wrote; absent in the mod's |

### `DayRec`

One day of work in one chat: `turns`, `tools`, `edits`, `errors`, `commits`, `cost`, `secs`, `night`, `add`, `del`, `early`, `langs`. All are sums except `langs`, a set of bits. Every Mochi adds every chat's days into one history; experience is `turns × 10 + edits × 2 + commits × 25 + active days × 30`.

The app counts a chat it follows from the agent's hook calls, the same way the mod counts its own, so work in Codex earns what work in Claude Code does. From hooks alone it cannot know `cost`, `add`, `del` or `langs`; they stay 0 for now.

The room's Work tab adds every chat's days up by project: by `folder` where the file has it, else by `label` against the folders in `repos.json`, a worktree under `.claude/worktrees` counting toward the repository that holds it. A chat named by its first words has no project, nor one in a worktree Claude Code named itself unless `repos.json` still holds its folder. `secs` is the agents' time: chats that ran side by side each count theirs.

With Mochi as Claude Code's status line (`mochi-desktop statusline`, set from the app's Settings), a chat the app follows also says how full its context is, what it cost, and where the usage limits stand: `context`, `cost`, `windows` and `limit` in its `live` file, as the mod writes them for its own. The call is left in the inbox as an event named `StatusLine`, with those numbers and nothing else.

### `app.json` and the inbox

While `app.json` is fresh (60 seconds), the app is running. The mod's band steps its Mochi aside when `isShown` is true, and the `hook` command leaves calls in the inbox only then: with the app closed nobody would empty it.

`approve` in `app.json` is for how many seconds a Claude Code request for permission may wait on Mochi's bubble; 0, the default, means the person has not asked for that and no hook waits. A hook that waits says so in its call (`ask: {id, until}`), and prints Claude Code's own decision only when the bubble's answer (`answers/<id>.json`) is `allow` or `deny`. With `none`, or no answer by `until`, it prints nothing and the request is Claude Code's own dialog's, as always.

`shield` in `app.json` says the person keeps the app's shield on (the default) and Mochi is on screen. Then, in a Claude Code chat the app follows (not one the mod writes), a shell command with one of the words in `app/src-tauri/shield-words.json` waits up to 2.5 seconds for the app to read it by the mod's own rules. One that would destroy something gets `ask`, and the hook tells Claude Code to ask the person first, with what the command would do; anything else, or no word in time, goes on as always. Such a call keeps the first 4000 characters of the command, and is taken out of the inbox as it is read.

A call in the inbox keeps only what the app reads, cut short: the event's name, the session, the folder, the tool's name, the first 200 characters of a prompt (for the chat's label), the first 300 of a shell command (to tell a test or a commit, and to show the person what a request is for; `cut` says when there was more), a file's path, a subagent's id and type, and the chat's title.
