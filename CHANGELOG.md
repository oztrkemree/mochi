# Changelog

## Unreleased

- Nothing opens by the date any more. The thirteen things that came with a holiday (witch hat, pumpkin, santa hat, sakura, red envelope, candy, lantern, sprouts, songpyeon, diya, pin, rosette, cake) are earned now: four by level (26 to 39) and nine by badges (six of them new and hard). An occasion still dresses Mochi in them, once earned.
- Six hard badges: iron month (30-day streak), five hundred commits, regular (100 active days), craftsman (5,000 edits), bulldozer (10,000 lines removed) and vampire (150 night turns). The pin comes with the hundred-commits badge.

## 0.4.0

- The details pane, rebuilt in four tabs. **Now**: the context and the 5-hour and weekly limits as thin bars with when each resets (or fills at this pace), the session in one line, then chats, changes and the context as rows that fold; the tab counts the chats waiting for you. **History**: activity, level and badges. **Mochi**: the wardrobe. **Settings**: every setting and action. A click anywhere on a row folds it; the tab and what is open are kept.
- Everything `/mochi` does is in the pane now. Switches turn the shield, alerts, sound, CI, tips, breaks and plugin reactions on and off (the whole row is clickable); the language and your birthday are set there, and Mochi hidden. The card, a wrapped and a snapshot, the tour, what is new, a bug report, export and reset (still asking first) are buttons. The card and a wrapped open as soon as they are made, the snapshots' folder too, and the bug report's form in the browser; what an action answers stays in the pane with an Open button (and Copy for the card's line and the report's link).
- Arrange each tab your way: ⠿ turns it into a list where you drag a part to another place and click to hide it; with the focus, ↑↓ pick, shift+↑↓ move and space hides. **Default order** puts it back. Where nothing can be dragged (the terminal, VS Code), ↑ and ↓ buttons do the same.

- Fifty more for the head, the face and the neck: 27 hats and ears, 16 for the face, from heart glasses to a teardrop, and 7 for the neck, from a spiked collar to overalls. The headphones are gone; one worn before is taken off.
- Nineteen things to hold: whisk, rolling pin, ice cream cone, cupcake, pinwheel, joystick, bubble wand, ping-pong paddle, sunflower, toadstool, potted cactus, four-leaf clover, star wand, potion bottle, star key, pocket compass, red flag, harmonica and tambourine. Five come from habits (a 14-day streak, 100 commits, 500 turns, 60 active days, 50 night turns); the other fourteen from levels 40 to 46.
- Twenty more to stand beside Mochi: red mushroom, frog, toy robot, ramen bowl, snail, campfire, bonsai, penguin, lava lamp, taco, camping tent, hedgehog, watering can, macarons, arcade machine, snowman, toy rocket, watermelon slice, treasure chest and axolotl. Two a level, from levels 47 to 56.
- Ultracode: Mochi answers a workflow. The `Workflow` call and the word `ultracode` in a prompt show the agent face; while a workflow's agents run, the band counts them (`ultracode · 3/9 · 4 agents`) with helpers beside Mochi, and when the last one has ended there is a party with how many agents it took and for how long. A finished workflow's notification no longer reads as frustration.

### Fixes

- The shield sees git commands with git's own options before them (`git -C ../app push --force`, `git -c x=y reset --hard`, `git.exe`), and a long run of dashes or dots in a file no longer stalls the secret guard.
- A setting changed in one chat is no longer undone when another chat changes a different one.
- `/mochi wear tea` puts on the tea glass, not the teardrop: an exact name wins over a longer one.
- Mochi's `git status` takes no lock, so it never makes Claude's own `git add` or commit fail; names with letters beyond ASCII show as they are in Changes, with their line counts.
- The 5-hour and weekly pace keep their history: the readings no longer double on every save.
- `/mochi ci on` while CI is followed no longer leaves "ci running" on the band.
- A summary prepared ahead of time, or a subagent's compaction, no longer shows "compacted" or sounds the context alarm again.
- A control character in a command, a file or a prompt no longer blanks the band or the pane; a link's user and password stay off the band.
- The terminal's wardrobe marks what is worn at rest, as the desktop does; **Default order** shows the default order at once while arranging; the next unlock named is the nearest one.
- An instruction offered for CLAUDE.md keeps its letter case (`NODE_ENV`, `README.md`).
- After an update, the new items are named four at a time, with how many more.

## 0.3.1

- The wardrobe shows one category at a time, picked from a row of buttons with how many items are unlocked, instead of every category at once. Cells are wider and a locked item shows its name with the hint to open it.

## 0.3.0

Needs Claude Code 2.1.293 or later.

### The shield

- Knows the Windows ways to destroy things (`Remove-Item -Recurse`, `del /s`, `Format-Volume`, `reg delete`, `Stop-Computer`…) and reads commands Claude runs through PowerShell as well as Bash.
- Asks about many more commands that cannot be undone: cloud deletes, database wipes, history rewrites, scripts piped from the internet, `npm unpublish`, `docker system prune -a`.
- Judges a force push by its branch: onto `main`, `master`, `trunk` or `develop` it asks and names the branch; onto your own branch it asks with a nervous look instead of the alarm, and a `--force-with-lease` there only gets the look.
- Secret guard: before Claude writes, `git add`s or commits something that looks like a live key or token, or a file like `.env` or `id_rsa`, Mochi asks and shows the value masked.
- “Always allow here” remembers a kind of command for one repository, for what stays inside it: a command or an edit that reaches outside asks again. `/mochi shield` says whether the shield is on and lists what is allowed, `/mochi shield on` or `off` switches it, `/mochi shield reset` forgets it.
- Your own rules in `~/.claude/mochi/shield.json`: patterns to ask about, and built-in kinds to stop asking about. Mochi asks before Claude itself changes that file, and says when it changed.

### Chats and limits

- A board of every chat on the machine, in the details pane and in `/mochi chats`: this one first, the ones waiting for you next, each with its branch, worktree, what it is doing and for how long.
- When a 5-hour or weekly limit you had used 90% of resets, Mochi celebrates, and one notification goes out for the whole machine.
- A chat that has waited five minutes for you sends one more notification.

### CI

- After a push, Mochi follows the GitHub Actions runs through your own `gh`: `ci running · 2/5` in the band (and between runs your pull request), a party on a pass, and the failed workflow's name on a failure, with a notification if Claude is not working.
- The details pane shows the last CI result and your branch's pull request with its review and checks.
- `/mochi ci` turns it off; `/mochi status` says when `gh` is missing or not signed in.

### Tips

- While Mochi is idle, now and then, one short Claude Code tip that fits what just happened. At most one an hour and three a day; `/mochi tips` turns them off.
- Give the same instruction a third time and Mochi offers to add it to the project's `CLAUDE.md`. It writes only if you pick Add.
- A three-step tour on the very first start (`/mochi tour`), and a note after each update (`/mochi news`).

### Badges, special days and breaks

- 12 badges earned from real work, each celebrated once: `/mochi badges` and a Badges section in the details pane.
- Eid al-Fitr, Eid al-Adha, Lunar New Year, Nowruz, Diwali, Chuseok, sakura season, Hacktoberfest, your birthday (`/mochi birthday`) and Mochi's own anniversary, each with a greeting and something to wear. The wardrobe grows to 46 items.
- Small surprises: say good night (Mochi goes to sleep once the reply is done), call its name, thank it or tell it you love it, in any of its languages; a wink at 13:37.
- After two hours of work with no break, a suggested stretch, once for all your chats. `/mochi breaks` turns it off.
- Three new moods: stretching, in love and winking.

### Sharing

- `/mochi card` draws a card for your GitHub profile, with the line to paste into its README.
- `/mochi wrapped` sums up your month (or `/mochi wrapped year` your year) across every chat; Mochi tells you once when last month's is ready.
- `/mochi snap` saves the band and the details pane as pictures, leaving out your other chats and the lines of your last edit; a PNG too where `rsvg-convert` or ImageMagick is installed.

### Your data and other plugins

- `/mochi export` saves everything Mochi keeps in one JSON file; `/mochi reset level`, `history` or `all` clears it after asking (exports and your `shield.json` stay); `/mochi feedback` prints a bug report link filled with versions only.
- Other plugins can make Mochi react through `$.mochi`, signed with their name and at most once every 10 seconds ([docs/API.md](docs/API.md)); `/mochi plugins` turns it off.
- A guide for adding something to wear ([docs/OUTFITS.md](docs/OUTFITS.md)) and an Outfit idea form.

### Everywhere

- Six more languages: Italian, Polish, Ukrainian, Hindi, Indonesian and Arabic. Mochi now speaks 16.
- Runs the same on Windows, Linux and macOS: notifications, the system's language, the home folder and deleting old files each the system's own way.
- Item ids are English now; what older versions saved carries over.
- A lighter timer while Mochi dozes or is hidden.
- Every on/off command takes `on` or `off` (`/mochi tips off`), and `/mochi status` also says whether tips, breaks and other plugins’ reactions are on.
- When another chat waits for you, Mochi now looks like it is waiting too; when one hits an error, it looks nervous.
- No longer reads the settings or files of Brutex, Mochi's earlier name.
- `/mochi` lists every command in its hint and in `/mochi status`.

## 0.2.0 and earlier

Mochi's first releases: a clay mascot above the prompt with 27 moods, rings for the context and the limits with a forecast, the shield, the loop watch, long-job alerts, other chats, the details pane, a wardrobe of 36 items, and 10 languages.
