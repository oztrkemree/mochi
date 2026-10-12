# Mochi: design for the next three features

Status: **proposal, nothing implemented.** Written 2026-10-12 against Mochi 0.5.1 (`bc0ebee`) and the Claude Code mods documentation as of v2.1.290.

| # | Feature | Priority | MVP size | Follow-up size |
| --- | --- | --- | --- | --- |
| 1 | **Agent Command Center** ("Crew") | **First** | M (≈4–6 days) | L (≈8–12 days) |
| 2 | **Mochi Time Machine** | **Second** | M–L (≈5–7 days) | XL (≈12–18 days) |
| 3 | **Mochi Room / Arcade** | **Third**, Room before Arcade | Room M (≈5–7), Arcade L (≈6–9) | XL |

Estimates are one engineer who knows the codebase, and include tests and the 16 language dictionaries. They are guesses, not commitments.

Why this order: Crew fills the clearest gap, builds on what 0.5.0 just started (following background agents), asks nothing new of the person's privacy, and its data feeds the other two. Time Machine is the most useful after it but is the only one that has to change what Mochi stores. Room/Arcade is delight, not utility, and carries the most performance and "don't distract me" risk.

---

## 0. How this was researched, and what it does not cover

- **Mochi** was audited from the source: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/API.md`, `types/index.d.ts`, `hooks/state.ts`, `hooks/chats.ts`, and the `on(...)` hooks, `$.*` calls and render sites in `hooks/register.tsx` / `hooks/render.tsx`.
- **The four reference repositories** were read at README / catalogue level through a page summarizer, plus the third-party mods they link to (Flightdeck, swarm, code-pet, boss-fight, Intermission, replay-theater). **No third-party source code was read.** That is deliberate: it keeps every design below a clean-room design from documented behaviour (see §5).
- **The mods API** was checked against Anthropic's pages `plugins/mods/overview`, `interface` and `reference` (reference states "as of v2.1.290"). The authoritative source is `mods/types/claude-code.d.ts` in `anthropics/claude-code`, which I did **not** open. Every point marked **[verify]** below must be confirmed against the types for the build in use in the first spike (§6, M0).
- **Not covered:** the full 3,570-entry catalogue at `mods.aidojo.si` was not browsed, so "nobody has built X" below means "none of the mods named in the four repositories' READMEs did", not "none exists".
- `karanb192/awesome-claude-code-mods` and `whyashthakker/awesome-claude-code-mods` are directories; the real prior art is in the mods they list.

### Prior art found in the four repositories

| Area | What exists (author) | What it shows | What it lacks |
| --- | --- | --- | --- |
| Agent dashboards | Agent Board, Desktop Agent Desk (whyashthakker); swarm, agent-narrator, agent-race (OneWave); Flightdeck (scasella); cctop (tomstagl); activity (mishgoldenberg) | tree/cards/swimlanes of subagents, per-agent tokens, permission verdicts, narration | one that lives *inside* a companion with an identity; attention ordering across chats; persistence into history/wrapped |
| History / replay | Turn Timeline, Command History, Handoff Notes (whyashthakker); session-wrapped (OneWave); context-keeper "checkpoints" (mishgoldenberg, a *context handoff note*, not file state); replay-theater (Anthropic sample) | per-turn durations, last-turn edit replay, in memory only | the whole whyashthakker README says outright that none of its mods offer "replay, rewind, or checkpoints"; nothing spans turns or sessions |
| Games / pets | code-pet, boss-fight (OneWave); Intermission, claude-doom (community, Doom engines); Mindful Claude; pixelband | a pet that reacts, a boss tied to failing tests, Doom in a pane | no turn-based or idle-friendly game; nothing that ties a "room" to earned progress |
| Safety | launch-codes (OneWave), guardrails + loop-breaker (mishgoldenberg) | | Mochi's shield and loop watch already cover this; **not** a gap |

---

## 1. Constraints that apply to all three

### 1.1 What Mochi is, and must stay

- Local-first: **no network** except the user's own `gh` (CI) and the version check; nothing new may add a request.
- Lightweight UX: the band stays one strip; everything else is behind a click or `/mochi`. `/mochi small`, `/mochi hide`, `/mochi sound off`, `/mochi tips off` must keep silencing the new features.
- Brand rules visible in the README and code: status lines are short, plain, factual (`CONTRIBUTING.md`); levels and wardrobe are "earned by real work" (nothing opens by date or by playing); the panel does not name what other chats do (commit `acb9a0a`); stored data is counts, "never whole prompts".
- Structure rules (`CONTRIBUTING.md`): code that acts through `$` lives in `register.tsx` in a feature block, because the engine follows `$` only into functions declared in the same file; everything else goes in its own module with its own test file. Every user-visible string is a key in all 16 `hooks/lang/*.ts` files (a test fails otherwise).
- Cross-cutting hooks that must keep working: `/mochi export` and `/mochi reset` cover any new data; `/mochi status` reports it; the README "What it touches" list is updated in the same change as any new file, process or call.

### 1.2 What the mods API allows (checked against the docs)

| Need | API | Limit that shapes the design |
| --- | --- | --- |
| See subagents | `agent.spawn` (fields Mochi already reads: `workflow`, `background`, `isTeammate`; result `agentId`), `tool.call` / `tool.check` / `turn.step` carry `agentId` (`tool.check` ≥ 2.1.290), `$.agent.list()` with `status` ∈ pending, running, waiting, idle, completed, failed, killed (`idle`/`waiting` ≥ 2.1.289) | Mochi 0.5.1 never calls `$.agent.list`; it requires ≥ 2.1.293, so all of this is available. Exact field names on spawn and list rows: **[verify]** |
| Message traffic between agents | `session.send`, `session.receive` | Only for teammates; optional |
| Per-agent tokens | `turn.step` is an async generator of chunks; `turn.complete` | Chunk kind that carries `usage`: **[verify]** |
| Draw | `$.ui.open` panes, `AbovePrompt` band, `Svg` (desktop only), `Raster` (terminal only, ≤512×256 cells), `Client` (desktop and terminal; its file gets **no** mods API; talks via `ui.message`; fails to `ui.fault`) | Mochi already uses Svg + Client on the desktop and text on the terminal; `Raster` would be new |
| Animate | `$.ui.blit` repaints one `Raster` without re-running `ui.render` | `ui.invalidate` is throttled to 10/s (30/s terminal, visible pane) |
| Input | `Button` hotkey = one digit or one lowercase letter; `Input`; `Select`; Tab, arrows, Esc **cannot** be rebound; there are **no key-release events** | A pane gets focus only when the prompt is empty and nothing else has focus; games must use `w a s d` and cannot rely on held keys. A **digit** hotkey on the *band* also fires when the person types that digit alone into an empty prompt, so **no band hotkeys** |
| Pane placement | pane the mod opens *by itself* appears only at ≥ 144 columns (110 after the person opened it once); opened by a command or press it appears at any width | Every new pane opens from a `/mochi …` command or a button, never from a timer |
| Persist | `$.store` (4 MiB total, shared by all sessions, get-then-set is not atomic), `$.fs` (4 MiB per file, **write replaces in place, no append, not atomic**), `$.state` (session) | Appending logs is impossible; use **one small file per unit** (per turn, per game) so concurrent chats never overwrite each other, as `days/<session>.json` and `live/<session>.json` already do |
| Run things | `$.process.run` (30 s default), already used for `git`, `gh`, `rm` | Any new process is a README change |
| Models | `$.model.complete/fork/classify` | **Not used by any feature here.** Mochi makes no model calls today and keeps it that way (§4) |

Not available, and therefore not designed around: killing or steering a subagent (`$.agent` only has `register`, `spawn`, `list`; `$.turn.abort` aborts the main turn only); restoring Claude Code's own `/rewind` checkpoints (no API found); any way to cover Claude Code's permission prompt.

### 1.3 Visual identity to match

Clay mascot with 30 moods and eased transitions (no jump cuts); the existing `agent` mood and helper figures beside Mochi; the palette in `hooks/panel.ts` (`PEER_INK` for chat states, tool-kind colours: read blue, edit violet, bash pink, agent green, ask amber); thin-bar meters and folding cards in the details pane (tabs Now / History / Mochi / Settings, arrangeable via `layoutOf`); soft chimes only (`hooks/sound.ts`); short lowercase factual lines. New surfaces reuse these cards, inks and the `Card` helper in `detail.ts` rather than introducing a second look. Terminal fallbacks follow the existing pattern (`partLines` / text rows) because `Svg` is desktop-only.

---

## 2. Feature 1: Agent Command Center ("Crew")

### 2.1 Audit: what Mochi already has

- `env.agents`, a count from `tool.call` on the `Agent`/`Task` tool (`register.tsx:2148`), and `scene.agents`, which draws that many helpers beside Mochi.
- `chat.flow` (`state.ts:231`): ids of workflow and background agents from `agent.spawn` until their turn ends, totals, "last one ended" party with count and duration, and "ultracode · 3/9 · 4 agents" in the band (0.4.0, 0.5.0).
- `agent` mood and a status line `agent · <what the subagent's tool call is>` (only the latest call; `register.tsx:2142`).
- `team` badge at `TEAM_AT` agents.
- The subagent calls feed the loop watch and the tool strip's "agent" kind.
- **Other chats**: a board with state (busy / asking / idle / error), folder, branch, worktree, title, age; a notification after a five-minute wait (`chats.ts`, `live/*.json` refreshed every 15 s).

### 2.2 What is genuinely missing

1. **Identity.** Mochi knows *how many* agents run, not *which*: no type, task, model, parent, or per-agent history. A finished agent leaves nothing behind.
2. **Per-agent activity**: only a single shared status line, overwritten by whichever subagent called last.
3. **Per-agent cost signal** (tokens), and which agent is the expensive or stuck one.
4. **Which agent is waiting on a permission**, as opposed to "a call is waiting".
5. **A tree / timeline** (who spawned whom, who overlapped).
6. **One attention queue** that ranks "needs you" across this chat's agents *and* the other chats.
7. Agents in **History**: no per-day or per-month agent counts, nothing in wrapped.

Not a gap (do not rebuild): the chat board, the "waiting for you" notification, loop detection, and the finale party.

### 2.3 Compatibility

All required hooks exist and Mochi already registers `agent.spawn`, `tool.call`, `turn.step`. New: `$.agent.list` (read-only), `tool.check` for the permission cell, and a read of the usage chunk in `turn.step`. Plugin validation will list `agent.list` under `calls:`; README "What it touches" gains one line. Cloud sessions and the VS Code chat panel run hooks but draw nothing, so Crew data is still collected there and shown by `/mochi crew` as text (the existing pattern for `/mochi chats`).

### 2.4 Interaction design

**Band (no new strip).** While agents exist the band's existing agent text becomes `crew 3 · 1 waiting` and the rings' click target opens the details pane as today. When an agent is waiting on a permission, Mochi uses the existing `waiting`/`asking` look, never a new alarm. No hotkeys on the band.

**Details pane, Now tab: new section `crew`** (sits after `chats`, foldable, hidden when empty, covered by `layoutOf` so older saved layouts pick it up). One row per agent, same row grammar as the chats card:

```
 Crew                                   3 running · 1 waiting
 ● explorer   reading src/auth.ts                  0:42  18k
   └ ● tester editing auth.test.ts                 0:19   6k
 ◐ reviewer   waiting for you · Bash               2:10
 ✓ planner    done · 5 tools                       1:03  9k
```

Dot colours reuse `PEER_INK`; the action text reuses `beforeTool(...).line`; finished rows fade after the turn and move to *Recent* (last 10). Folded by default once all are done.

**Full view: `/mochi crew`** opens a pane (`id: mochi-crew`, `closeOnEscape`, `focus` only because the person asked). Tabs as two plain buttons (the documented pattern): `1 Tree` · `2 Timeline`. Tree = the table above with parent nesting. Timeline = a time axis (Svg on the desktop, text bars in the terminal) showing overlaps. Keys: `1`/`2` tabs, `r` running only, `a` all, `c` copy a status snapshot (`$.ui.copy`), Esc closes. Selecting a row (Tab, Enter) expands: model, spawned-by, tools by kind, files touched, tokens, duration, last 5 actions.

**Mochi's part.** Helpers beside Mochi are no longer anonymous: each helper is drawn in the colour of its agent's current tool kind and a waiting helper raises a hand. No new art beyond a tint and one arm pose from the existing rig.

### 2.5 Data model

Session-only ledger in `$.state`, capped at 50 agents × ~1 KB:

```ts
type Crew = { id: string; kind: string /* agent type */; label: string /* ≤ 40 cols, task start */; model?: string
  parent?: string; background: boolean; teammate: boolean
  state: 'running'|'waiting'|'idle'|'done'|'failed'|'stopped'; startedAt: number; endedAt: number
  tools: Record<ToolKind, number>; files: string[] /* ≤ 8 paths */; last: string; waitingOn?: string
  inTok: number; outTok: number }
```

Rules: `label` is the first words of the delegated task, cut to 40 columns, control characters stripped, and passed through the same masking the secret guard uses for commands (`shield.ts`); full task text is never kept. State is read from `$.agent.list()` on the existing 450 ms tick *only while something runs*, merged with the event-derived fields. **MVP persists nothing**; v2 adds an anonymous per-day counter (agents, deepest nesting) to `DayRec` for History and wrapped.

### 2.6 MVP and follow-up

**MVP (read-only, no new files, no new processes)**
- Ledger from `agent.spawn` / `tool.call` / `turn.step` / `$.agent.list`.
- Crew section in Now tab (terminal text fallback), band text, `/mochi crew` with Tree view, `/mochi crew off`.
- Per-agent waiting state via `tool.check` + existing `PermissionRequest` handling.
- Tests: `tests/crew.test.ts` for the ledger reducer (pure, in `hooks/crew.ts`), one end-to-end test in the style of the `ultracode` tests.

**Follow-up**
- Timeline view; teammate message arcs from `session.send`/`receive`.
- Attention queue: one list ranking waiting agents *and* waiting chats; extends `boardOf`. Other chats publish only **counts** (`crew: {running, waiting}`) in `live/<id>.json`, never names or tasks, following commit `acb9a0a`.
- Agents per day in History, an "agents" line in wrapped, a `crew` badge family (earned, like the others).
- Optional: a "stuck" hint when one agent has run far longer than its siblings with no tool call (reuses the loop-watch vocabulary).
- Explicitly **not** planned: killing or steering agents (no API; would need `$.prompt.submit` = a model turn, i.e. tokens), model-written narration (see agent-narrator; costs tokens).

### 2.7 Performance, tokens, privacy, security

- **Tokens: zero added.** No `prompt.*`, no `$.model.*`, no context injection.
- **CPU:** O(1) per event; one `$.agent.list()` per tick only while agents run; redraws ride Mochi's existing invalidation and Claude Code's 10/s throttle. Budget: ledger update < 1 ms, Crew card render < 5 ms for 20 agents.
- **Privacy:** session memory only in the MVP; task labels shortened and masked; nothing leaves the machine; other chats never see names.
- **Security:** read-only observer. It never denies, rewrites or delays a call (the shield stays the only blocker). A `tool.check` hook must call `next(e)` and return its result untouched. Treat `agent.spawn` text as untrusted display data (strip control and bidi characters as `text.ts` already does).

### 2.8 Acceptance criteria (MVP)

1. With a workflow of 4 agents, the Crew card lists 4 rows with type, current action, age; counts match `$.agent.list()` within one tick.
2. A subagent waiting on a permission shows `waiting for you` on its own row only; other rows keep their own actions (today they overwrite each other).
3. When all agents end, the existing finale still fires exactly once (regression test against 0.5.0 behaviour), and rows move to Recent.
4. A nested agent shows under its parent; an orphan (parent unknown) shows at top level, never crashes.
5. `/mochi crew` works on terminal, desktop and in a non-drawing surface (text reply); `Esc` closes; digits `1`/`2` switch tabs only while the pane has focus; typing digits in the prompt never triggers anything.
6. No hook changes a tool call's result; `tool.call`/`tool.check` outputs are identical with Crew on and off (test).
7. `/mochi crew off` removes the card and band text and stops the `$.agent.list` polling; `/mochi small`, `hide` honoured.
8. `/mochi export` and `reset` need no change (nothing persisted); `/mochi status` states whether Crew is on.
9. All 16 dictionaries have every new key; `claude plugin validate .` and `claude plugin test .` pass; README "What it touches" lists `$.agent.list`.
10. Adding 50 agents does not grow memory beyond the cap and does not slow the band's redraw beyond the stated budget.

---

## 3. Feature 2: Mochi Time Machine

### 3.1 Audit: what Mochi already has

- `env.turns`: last 40 turns (`at`, `seconds`, `tools`, `edits`, `errors`, `cost`), shown as a chart; in memory, rebuilt per chat.
- `env.files`: last 60 files read/edited with counts; the details pane's Changes list with per-file `git diff` against HEAD for the file picked, 60 lines (0.4.1).
- `env.lastEdit`: **one** hunk, the last edit only.
- `History`: per-day counts for 126 days across chats, streaks, calendar, wrapped (month/year), card, snap.
- `editDelta` / `lineDelta` / `parseDiff` helpers; the secret guard's patterns.
- The coach already tells people about `Esc Esc` after a stopped turn, i.e. Claude Code's own rewind.
- Stored on disk: per-chat `days/<id>.json`, `live/<id>.json`, `level.json`, `usage.json` (all counts).

### 3.2 What is genuinely missing

1. **Any per-turn memory of what changed.** After a turn ends, Mochi keeps one number for edits and forgets which files and what lines.
2. **Stepping through a turn's edits** (a replay), and across turns.
3. **A shape-of-the-session view**: when things went well or badly (errors, tests red/green, CI), per turn, with the commit and CI result attached.
4. **A "while you were away" briefing** after a long idle.
5. **Survival across `/clear`, `/resume` and new chats** (turns reset to nothing).
6. **Safe undo help** for Claude's changes (see the scoping argument below).

Not a gap (do not rebuild): rewinding conversation and files is Claude Code's built-in `/rewind`; Mochi must not pretend to replace it. Mochi's value is the *readable timeline and replay*, and later *git-backed snapshots* for the cases `/rewind` does not cover (see v2).

### 3.3 Compatibility

All inputs exist: `turn.start`/`turn.complete`, `tool.call` (Edit/Write/MultiEdit arguments, as `editDelta` already reads), `session.measure`, `$.fs` per-file writes, `$.process.run` for `git`. `$.session.messages()` (newest 4,096 entries) *could* rebuild history after a resume but is not needed for the MVP and would read whole prompts, so it is **not** used. No API restores Claude Code's own checkpoints, so v2 restore uses git (below).

### 3.4 Interaction design

**Entry points:** `/mochi time` (or a "Time" button in the History tab); a one-line hint after a turn with edits ("5 edits · /mochi time to step through"), through the existing tips pipeline so `/mochi tips off` silences it.

**Pane `mochi-time`** (own pane; needs height):

```
 Time Machine · this chat                      turn 7 of 12
 ▁▃▂█▅▂▁▆▃▂▁▄   one bar per turn: height = time, red tick = error
 turn 7 · 14:32 · 1m 12s · 8 tools · 3 files · +41 −12 · tests green
   src/cart.ts  +18 −4     cart.test.ts +23 −8     (CI passed)
 step 2/5  src/cart.ts · Edit
   - const total = items.reduce((a, b) => a + b.price, 0)
   + const total = sum(items.map(i => i.price))
 [p] prev  [n] next  [t] earlier turn  [y] later turn  [c] copy  [Esc] close
```

Single lowercase hotkeys only (no Tab/arrow remapping). Mochi's face in the pane header replays the mood that tool kind produced at that moment, using the eased transitions from `rig.ts`; no new art. Desktop uses `Svg` cards like the rest of the pane; terminal uses text rows.

**"While you were away"**: after ≥ 15 minutes idle, one soft toast on return: `while you were away: 3 turns · 12 edits · 1 error · CI passed`. From existing `TurnRec` + `Ci`, no new data.

### 3.5 Data model

```ts
type TurnFrame = { n: number; at: number; secs: number; kinds: Record<ToolKind, number>; errors: number; cost: number
  edits: { path: string; tool: string; add: number; del: number; at: number; hunk?: string[] /* ≤12 lines, memory only */ }[]
  commands: { cmd: string /* masked, ≤80 */; ok: boolean; secs: number }[]
  testState?: 'red' | 'green'; sha?: string /* HEAD at turn end */; ci?: Ci['state'] }
```

- **Memory:** hunks (code text) live **only in memory** for the current chat, last 20 turns, 12 lines per step. This matches what replay-theater is documented to do and keeps the current "nothing it reads is kept" promise.
- **Disk (MVP):** metadata only, one small file per turn: `~/.claude/mochi/timeline/<sessionId>/<n>.json`, ≈ 1–3 KB, no code, no prompt text; commands masked by the shield's secret patterns; paths are repo-relative. Retention 30 days or 5 MB, whichever first, deleted with the existing `rm` helper inside `~/.claude/mochi/`. `/mochi export` includes it; `/mochi reset history` clears it.
- **Opt-in:** `/mochi time keep on` also persists hunks (capped, secret-masked, never for `.env`/key files). Off by default, with the README stating exactly what is then on disk.

### 3.6 MVP and follow-up

**MVP (read-only)**
- Per-turn frames in memory; metadata files; `/mochi time` pane with turn strip, per-turn summary, step-through of the last 20 turns' edits (hunks from memory), `p/n/t/y/c`.
- "While you were away" toast.
- `/mochi time off`, export/reset/status support.
- Tests: `tests/time.test.ts` for the frame builder, retention pruning and masking (pure code in `hooks/time.ts`).

**Follow-up**
- **Git-backed checkpoints (opt-in `/mochi time snapshots on`).** At turn end, if the tree changed, build a snapshot commit *without touching the working tree, the real index or any branch*: temp `GIT_INDEX_FILE`, `git add -A`, `git write-tree`, `git commit-tree`, then `git update-ref refs/mochi/<session>/<n>`. This adds objects and refs to the user's repository, which breaks the README's "git only to read" line, so it is off by default and documented; `/mochi time clear` deletes the refs; `git gc` reclaims objects.
- **Restore, narrowly:** per file, only files Claude changed in that turn, only if the file still equals what Claude left (hash compare), always behind `$.ui.ask` showing the diff, never whole-tree, never a hard reset. For anything wider the pane shows the exact `git` command to copy and points to Claude Code's `/rewind`.
- Cross-session timeline (read the per-turn files of past chats), CI and PR markers on the strip, "diff between turn a and b", a timeline section in wrapped, an optional animated GIF/SVG of a session (reuses `scripts/gifs.mjs` drawing code).
- Not planned: model-written turn summaries (tokens), uploading anything.

### 3.7 Performance, tokens, privacy, security

- **Tokens: zero.** Pure observation.
- **CPU/disk:** one small write per turn (the count today is one `days` write per turn). Hunk capture reuses the `editDelta` read Mochi already does. Cap memory at 20 turns × 12 lines × (≤ 200 chars) ≈ well under 1 MB.
- **Privacy:** this is the feature that changes Mochi's data story, hence metadata-only by default, memory-only code, explicit opt-in for anything with code in it, masking, retention, export and reset coverage. Paths and command strings can still be sensitive (`rm ~/secret-project`): the "snap/card/wrapped" sharing code must **exclude** the timeline, as it already excludes other chats and the last edit.
- **Security:** hunks are untrusted text: strip control/bidi characters before drawing (`text.ts`). Restore (v2) only operates on resolved paths inside the repo root (reject `..` and symlink escapes), asks first, and refuses on divergence. Snapshot refs are namespaced under `refs/mochi/` and never pushed (`git push --all` does not push custom refs, but `--mirror` does: document it).

### 3.8 Acceptance criteria (MVP)

1. After a turn with 3 edits across 2 files, `/mochi time` lists that turn with the right files, line counts and duration, matching the Changes list and `git diff --numstat` for those files.
2. Step-through shows each edit's hunk in order, ≤ 12 lines per step with `⋯` for skipped runs; `p`/`n` stop at the ends; Esc closes.
3. With `keep` off, **no file under `~/.claude/mochi/timeline/` contains code, a prompt, or an unmasked secret** (test with a fixture command containing `AKIA…`, and a Write of a `.env` file).
4. Frames from a chat survive `/clear` and `/resume` as metadata, and the strip shows them; hunks do not.
5. Retention: files older than 30 days or beyond 5 MB are pruned on start; a test fills the directory and checks the oldest go first; deletion never leaves `~/.claude/mochi/`.
6. `/mochi export` includes the timeline; `/mochi reset history` removes it; `/mochi time off` stops all capture and writes.
7. `/mochi snap`, `card`, `wrapped` output is byte-identical to today when the timeline has data.
8. The idle-return toast shows once per return, honours `/mochi alerts off`, and never fires while Mochi shows something the person must not miss (same busy rules as `$.mochi.react`).
9. Subagent edits are attributed to the main turn and flagged `by agent` once Crew data exists; without Crew they still appear.
10. No change in tool-call behaviour with the feature on or off; two chats writing concurrently never overwrite each other's files (distinct session directories).
11. 16 dictionaries; `validate` and `test` pass; README "What it touches" lists the new directory.

---

## 4. Feature 3: Mochi Room / Arcade

### 4.1 Audit: what Mochi already has

- A wardrobe of 136 things, five slots; the `ground` slot holds 31 "beside Mochi" items, among them `arcade`, `campfire`, `bonsai`, `tent`, `lavalamp`, `robot`, `chest`, plus `joystick` in the hand slot. **Only one item per slot is shown at a time.**
- Earned progression: levels, habits, 18 badges (the hard ones open the rest of the wardrobe), special days; `fun.ts` for small surprises and breaks; soft sounds; the 30-mood rig; a `Scene` that already carries context % and agent count.
- A tip pipeline and an idle detector (`coach.ts`, `chat.lastActivity`) that can offer something at a quiet moment, rate-limited.

### 4.2 What is genuinely missing

1. **A place.** Mochi only ever appears as a strip; nothing shows the *whole* of what you've earned at once.
2. **Interaction with Mochi** beyond typing words at it: no poke, no petting, no feeding the feeling that it's alive.
3. **Anything to do during a long turn** other than wait.

Honest assessment: of the three features this is the least necessary, which is why it is last. It is also where Mochi's identity (a friend, not a dashboard) is strongest, and where the risks (distraction, performance, off-brand gamification) are highest.

### 4.3 Compatibility, and the constraints that decide the design

- Input is the hard part: **no key-release**, Tab/arrows reserved, focus only when the prompt is empty. So a real-time game that needs held keys is wrong for the terminal. A **turn-based** game needs none of it.
- Frame loops cost time inside Claude Code's own process (mods are not sandboxed or isolated). `Raster` + `$.ui.blit` avoids re-running `ui.render`, but any tick still shares the event loop with streaming.
- `Raster` is terminal-only and `Svg` desktop-only; Mochi's terminal look is text/kaomoji (`looks.ts`). A Raster Mochi would need a pixel-art pipeline Mochi does not have; so MVP terminal parity is **text**, not pixels.
- Games must never be able to answer or hide a permission prompt: keys only reach a pane while it has focus; I could not confirm what happens to pane focus when a permission dialog opens **[verify]**, so the design closes/blur the pane itself (`$.ui.focus`/`$.ui.close`) on `classic.PermissionRequest` and on the shield's `$.ui.ask`.

### 4.4 Interaction design

**Room (`/mochi room`, pane `mochi-room`).** Mochi on a floor with a window whose light follows the clock and season (local date only, no network), and **every ground item you own placed as furniture** (a real extension of the single worn slot): bonsai, tent, lava lamp, arcade cabinet… Layout is automatic (fixed anchor slots, ≤ 8 visible; `/mochi room put <item>` / `remove <item>` picks which). Mochi lives its **live mood** there (reads `shot`/`face`, so it types when Claude types, sleeps when you're away), and the agent helpers from Crew walk in as small helpers. Click/press `p` to pet: a short `love` mood, a soft chime if sound is on, rate-limited to once per 10 s, and **no XP or badge is ever awarded for interaction** (levels stay "earned by real work").

**Arcade (`/mochi arcade`, or the cabinet in the Room).** Cabinet menu with the games, high scores, `Esc` to leave. Never opens by itself. One optional nudge: when a single turn has run over two minutes and you haven't typed, the existing tip pipeline may say once per hour "a long one; `/mochi arcade` while you wait". Off with `/mochi tips off`.

Games, in build order:
1. **Mochi Pairs** (MVP): turn-based memory match, cards are Mochi's own wardrobe icons (`iconSvg` on desktop, glyph pairs in the terminal). No frame loop, no held keys, ~zero CPU; pointer on desktop, `w a s d` + `space` in the terminal.
2. **Mochi Hop** (v2): one-button runner, ≤ 10 fps, `space`; paused automatically when the pane loses focus, the turn ends, Mochi is hidden, or any ask appears.
3. **Mochi Munch** (v2): snake variant, `w a s d`; same pause rules.

Principles: the game pauses itself on every interruption and resumes only on a key; sound off unless `/mochi sound on`; games never touch the band's face (`mood`/`line` are not changed), so a game can never hide a waiting or danger state; scores are local, with no leaderboards (they would need a network).

### 4.5 Data model

- Room: `room` object in `$.store` (`placed: Item[]`, ≤ 8, `lastPet`), counts only.
- Arcade: `arcade.json` in `~/.claude/mochi/`: `{ pairs: { best, plays }, hop: { best, plays } }`, included in export/reset.
- Nothing about work content is read or stored by either.

### 4.6 MVP and follow-up

**MVP**
- Room with live Mochi, auto-placed owned ground items, day/night, petting; desktop `Svg`, terminal text scene.
- Arcade with Mochi Pairs only, plus scores.
- `/mochi room`, `/mochi arcade`, `/mochi room put|remove`, switch in Settings, `/mochi status` line.
- Tests: pure game logic (`hooks/pairs.ts`: deal, match, score), layout function, and a test that a `PermissionRequest` closes the pane.

**Follow-up**
- Real-time games under the frame budget below; a drag-to-arrange Room on the desktop (a `Client` file with pointer input, as `arrange.tsx` already does for the pane); Room seasons and special days (reuse `fun.ts` calendar); shareable Room snapshot via `share.ts` (SVG, no work data); "visitors": other chats' Mochis as sleeping or busy silhouettes using only the already-public `Peer.state`.
- Not planned: any engine or emulator (Intermission/Doom-style), downloads, multiplayer, XP or badge rewards for playing, ads of any kind.

### 4.7 Performance, tokens, privacy, security

- **Tokens: zero.**
- **Frame budget (v2 games):** ≤ 10 fps, tick runs only while the pane is open *and* focused *and* not paused, driven by `$.clock.every` and `$.ui.blit`; one frame < 2 ms; the timer is cancelled on close and on `ui.close`. Room: redraw with Mochi's existing beat; no extra timer; slows to the existing `DOZE_EVERY` cadence when idle.
- **Privacy:** local counts only; no work data; Room shares nothing about chats beyond the already-shown states.
- **Security:** no spawned processes, no downloads, no third-party engines (also avoids GPL entanglement, §5). Pane keys cannot reach other UI; the pane is closed before any dialog that needs the person.

### 4.8 Acceptance criteria (MVP)

1. `/mochi room` shows Mochi in its *current* mood and outfit, and exactly the owned ground items (not locked ones), max 8; a fresh install with no ground items shows an empty but pleasant room.
2. The window reflects local time of day; no network call is made (test with the HTTP mock failing the test on any call).
3. Petting changes the mood for ≤ 3 s, is rate-limited to once per 10 s, and awards **no** XP, badge or history count (test on `level.json`/`days`).
4. `/mochi arcade` launches Pairs; a full game is winnable by keyboard only (terminal) and by pointer (desktop); score saved to `arcade.json`; `reset all` removes it; `export` includes it.
5. A shield question, a Claude Code permission request, or a loop alarm while a game is open closes or blurs the pane before the question is shown, and the game never receives the answering keypress (test with both mocks).
6. A game never changes `face`, never plays sound unless sound is on, and creates no timer while idle or closed (test: no `$.clock.every` registered after `ui.close`).
7. The Room/Arcade never open without a command or button; nothing appears at < 110 columns unless asked; `/mochi small` and `hide` suppress the idle nudge.
8. With the Room open during a 100-tool turn, per-event overhead of Mochi's own hooks is unchanged within noise (benchmark in a test, ≤ 5% change).
9. 16 dictionaries, `validate` and `test` pass, README "What it touches" unchanged except for `arcade.json` and the room key.

---

## 5. Licenses and attribution

All repositories were checked at the file level where reachable.

| Project | Licence | Copyright line seen | Notes |
| --- | --- | --- | --- |
| `karanb192/awesome-claude-code-mods` | **CC0-1.0** per its README | not seen | A directory/catalogue; the `LICENSE` file at `main/LICENSE` returned 404, so confirm the file before quoting it. No code to reuse |
| `whyashthakker/awesome-claude-code-mods` | MIT | © 2026 Yash Thakker and contributors | 70 bundled mods (Agent Board, Turn Timeline, Command History…). It states community mods keep **their own** licences |
| `OneWave-AI/claude-code-mods` | MIT | © 2026 Claude Code Mods contributors | swarm, agent-narrator, agent-race, code-pet, boss-fight, session-wrapped, launch-codes, burn-meter |
| `mishgoldenberg/claude-mods` | MIT | © 2026 Michael Goldenberg | activity, context-keeper, changes, loop-breaker, guardrails |
| `scasella/claude-flightdeck` | MIT | © 2026 Stephen Casella | Closest prior art for Crew |
| `jarrodwatts/intermission` | mod MIT; **Odamex GPL-2.0**; **Freedoom BSD-3-Clause** | | Never bundle, link or derive |
| `ChaseWNorton/claude-doom` | **GPL-2.0-or-later** (Freedoom BSD) | | Never bundle, link or derive |
| `anthropics/claude-code-playground` → `replay-theater` | **not visible** on the page I read (it defers to the repo's own LICENSE) | | Treat as "licence unknown, do not copy" until the repo's LICENSE is read |

Policy for this work:

1. **No third-party code is copied.** Every design above is derived from *documented behaviour* and Anthropic's API pages. I did not read any of these projects' source, so a clean-room implementation is straightforward: the implementer should likewise build from this document and the official mods docs, not from their source.
2. Ideas and mechanics (an agent tree, a replay stepper, a pairs game) are not protected; **names, art, text and code are**. Do not reuse names such as "Flightdeck", "swarm", "Boss Fight", "code-pet", "replay-theater", or any pixel art. Mochi's art is its own (`art/`).
3. If a snippet is ever copied from an MIT project, it must carry that project's copyright and permission notice (MIT's one condition); add a `THIRD_PARTY_NOTICES.md` in the same commit. Mochi is MIT, so MIT code is compatible; **GPL code is not** (it would force the plugin under the GPL) and must never enter this repository.
4. Courtesy, not obligation: an "Inspired by" line in the CHANGELOG entry naming Flightdeck, swarm, replay-theater and code-pet for the ideas that shaped Crew, Time Machine and the Room.
5. Check the licence of any asset (sounds, fonts) before use; Mochi's chimes are generated in code (`sound.ts`), which is the model to keep.

---

## 6. Plan and rollout

| Step | What | Output |
| --- | --- | --- |
| **M0 spike (½ day, before anything)** | Read `claude-code.d.ts` for the running build: `agent.spawn` fields and result, `$.agent.list` row shape, `tool.check` input, usage chunk in `turn.step`, pane focus vs permission dialog, `Client` pointer events. Run `claude plugin validate` on a throwaway hook that only logs | Every **[verify]** above resolved or the design adjusted |
| **M1: Crew MVP** | §2.6 | 0.6.0 |
| **M2: Time Machine MVP** (read-only, metadata) | §3.6 | 0.7.0 |
| **M3: Room + Pairs** | §4.6 | 0.8.0 |
| Follow-ups | by demand: Crew attention queue and History, Time Machine snapshots, real-time games | |

Each release: CHANGELOG entry, README section and "What it touches" update in all ten README languages (a stale translated privacy list is the worst kind of drift), `docs/` screenshots via the existing `scripts/*.mjs`, version bump in `.claude-plugin/plugin.json`.

### Cross-cutting acceptance criteria (every feature)

1. Zero network requests added; zero model calls; zero added prompt or context tokens (test: no `prompt.*` hook returns anything, no `$.model.*`/`$.http.*` call in the new code).
2. `claude plugin validate .` and `claude plugin test .` pass on the minimum supported version (2.1.293) and the latest; `validate`'s `calls:` list changes are exactly the ones documented in the README.
3. Each feature has an on/off command and Settings switch, defaults to **on** for passive display (Crew card, timeline capture of metadata) and **off** for anything that stores more or runs more (`time keep`, `time snapshots`, real-time games' nudge).
4. Existing behaviours unchanged: shield decisions, loop watch, chats board, wardrobe, badges, forecast, `/mochi snap|card|wrapped` outputs (golden-file tests).
5. Works on terminal, desktop and a non-drawing surface (text reply fallback), and in the 16 languages (CJK/Arabic line widths checked with `cols()`).
6. Data hygiene: any new file is listed in README, covered by `export` and `reset`, deleted only by name inside `~/.claude/mochi/`, written one-file-per-unit (no shared append).

### Risks

| Risk | Where | Mitigation |
| --- | --- | --- |
| `register.tsx` grows past 2,400 lines | all | Pure logic in `hooks/crew.ts`, `time.ts`, `pairs.ts`, `room.ts`; only `$` glue in `register.tsx` |
| 16 languages × many new strings | all | Short factual lines, reuse existing keys (`agent`, `waiting`, `turn`), machine-translate drafts and mark for review per language, as previous releases did |
| API fields differ from the docs | Crew | M0 spike; the ledger reducer takes a narrow adapter so a field rename touches one function |
| Persisting code content breaks the privacy promise | Time Machine | Metadata-only default; opt-in; masking; retention; sharing excludes it |
| Git refs surprise users | Time Machine v2 | Off by default, namespaced, one command to remove, README line |
| Games steal attention or keys | Arcade | Never auto-open; turn-based first; pause/close on every ask; no face changes |
| Feature creep dilutes "lightweight" | all | Each has a one-line off switch, and Crew and Room are folded or closed by default |

### Decisions needed from the maintainer

1. Confirm the order (Crew → Time Machine → Room/Arcade), or swap Time Machine first if undo/forensics matters more than agent visibility.
2. Time Machine: is a **metadata-only** default acceptable, with code persisted only on opt-in? (Recommended.) Is writing `refs/mochi/*` into repositories acceptable even as opt-in?
3. Room/Arcade: confirm that playing never earns XP or badges (recommended, protects "earned by real work"), and that the first game is turn-based.
4. Minimum Claude Code version: stay at 2.1.293, or raise it if M0 shows a needed field arrived later.
