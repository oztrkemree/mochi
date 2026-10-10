# Changelog

## 0.3.0

Needs Claude Code 2.1.293 or later.

### The shield

- Knows the Windows ways to destroy things (`Remove-Item -Recurse`, `del /s`, `Format-Volume`, `reg delete`, `Stop-Computer`…) and reads commands Claude runs through PowerShell as well as Bash.
- Asks about many more commands that cannot be undone: cloud deletes, database wipes, history rewrites, scripts piped from the internet, `npm unpublish`, `docker system prune -a`.
- Judges a force push by its branch: onto `main`, `master`, `trunk` or `develop` it asks and names the branch; a `--force-with-lease` to your own branch only gets a nervous look.
- Secret guard: before Claude writes, `git add`s or commits something that looks like a live key or token, or a file like `.env` or `id_rsa`, Mochi asks and shows the value masked.
- “Always allow here” remembers a kind of command for one repository; `/mochi shield` lists what is allowed, `/mochi shield reset` forgets it.
- Your own rules in `~/.claude/mochi/shield.json`: patterns to ask about, and built-in kinds to stop asking about.

### Chats and limits

- A board of every chat on the machine, in the details pane and in `/mochi chats`: this one first, the ones waiting for you next, each with its branch, worktree, what it is doing and for how long.
- When a 5-hour or weekly limit you had used 90% of resets, Mochi celebrates, and one notification goes out for the whole machine.
- A chat that has waited five minutes for you sends one more notification.

### CI

- After a push, Mochi follows the GitHub Actions runs through your own `gh`: `ci running · 2/5` in the band, a party on a pass, and the failed workflow's name on a failure, with a notification if Claude is not working.
- The details pane shows the last CI result and your branch's pull request with its review and checks.
- `/mochi ci` turns it off; `/mochi status` says when `gh` is missing or not signed in.

### Tips

- While Mochi is idle, now and then, one short Claude Code tip that fits what just happened. At most one an hour and three a day; `/mochi tips` turns them off.
- Give the same instruction a third time and Mochi offers to add it to the project's `CLAUDE.md`. It writes only if you pick Add.
- A three-step tour on the very first start (`/mochi tour`), and a note after each update (`/mochi news`).

### Badges, special days and breaks

- 12 badges earned from real work, each celebrated once: `/mochi badges` and a Badges section in the details pane.
- Eid al-Fitr, Eid al-Adha, Lunar New Year, Nowruz, Diwali, Chuseok, sakura season, Hacktoberfest, your birthday (`/mochi birthday`) and Mochi's own anniversary, each with a greeting and something to wear. The wardrobe grows to 46 items.
- Small surprises: say good night, thank Mochi or tell it you love it, in any of its languages; a wink at 13:37.
- After two hours of work with no break, a suggested stretch, once for all your chats. `/mochi breaks` turns it off.
- Three new moods: stretching, in love and winking.

### Sharing

- `/mochi card` draws a card for your GitHub profile, with the line to paste into its README.
- `/mochi wrapped` sums up your month (or `/mochi wrapped year` your year) across every chat; Mochi tells you once when last month's is ready.
- `/mochi snap` saves the band and the details pane as pictures.

### Your data and other plugins

- `/mochi export` saves everything Mochi keeps in one JSON file; `/mochi reset level`, `history` or `all` clears it after asking; `/mochi feedback` prints a bug report link filled with versions only.
- Other plugins can make Mochi react through `$.mochi`, signed with their name and at most once every 10 seconds ([docs/API.md](docs/API.md)); `/mochi plugins` turns it off.
- A guide for adding something to wear ([docs/OUTFITS.md](docs/OUTFITS.md)) and an Outfit idea form.

### Everywhere

- Runs the same on Windows, Linux and macOS: notifications, the system's language, the home folder and deleting old files each the system's own way.
- Item ids are English now; what older versions saved carries over.
- A lighter timer while Mochi dozes.
- When another chat waits for you, Mochi now looks like it is waiting too; when one hits an error, it looks nervous.
- No longer reads the settings or files of Brutex, Mochi's earlier name.
- `/mochi` lists every command in its hint and in `/mochi status`.

## 0.2.0 and earlier

Mochi's first releases: a clay mascot above the prompt with 27 moods, rings for the context and the limits with a forecast, the shield, the loop watch, long-job alerts, other chats, the details pane, a wardrobe of 36 items, and 10 languages.
