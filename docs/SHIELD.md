# What the shield can and cannot see

The shield is a **safety net against accidents, not a security sandbox.** It
reads the text of each command Claude is about to run through the Bash or
PowerShell tool and matches it against a list of patterns for things that cannot
be undone (`hooks/guard.ts`). If a pattern matches, it asks before the command
runs. It does not parse a shell, expand variables, decode anything, open script
files or watch what a process does once it starts.

The consequence is simple: **a destructive command is found when its words
appear in the command text, and missed when they do not.** Nesting by itself
(a subshell, `bash -c`, `$(...)`) does not hide anything, because the inner text
is still part of the text the shield reads. Hiding the words does.

Anyone who wants to get around the shield on purpose can. It is for the model
that means well and gets it wrong, not for one that is trying to evade it. If
you need real containment, use an OS-level sandbox, a container, a throwaway
VM, least-privilege credentials or a permission policy in Claude Code itself.

Audited against the rules in `hooks/guard.ts` at 0.5.1. Every case below was
run against `dangers()` with harmless fixture names; nothing was executed.
The "caught" cases are pinned by `tests/shield.test.ts`
("a destructive command is found inside shells…").

## Caught: the words are in the text

| Scenario | Example | Why |
| --- | --- | --- |
| Shell `-c` strings | `bash -c "rm -rf x"`, `sh -c '…'`, `zsh -lc "…"` | the pattern matches inside the quotes |
| Subshells and groups | `(rm -rf x)`, `{ rm -rf x; }` | same text |
| Command substitution | `echo $(rm -rf x)`, ``echo `rm -rf x` `` | same text |
| Process substitution | `cat <(rm -rf x)` | same text |
| Prefix wrappers | `env`, `nohup`, `nice`, `time`, `timeout`, `command`, `\rm`, `/bin/rm`, `sudo -u u` | the wrapper is just another word before `rm` |
| Commands fed commands | `… \| xargs rm -rf`, `find . -exec rm -rf {} +` | `rm -rf` is in the text |
| Literal `eval`, heredocs, newlines | `eval "rm -rf x"`, `sh <<EOF … EOF` | same text |
| Other interpreters, spelled out | `python3 -c "os.system('rm -rf x')"`, `node -e "…execSync('rm -rf x')"` | the shell command is a string inside the text |
| Remote and container hops | `ssh host "rm -rf /data"`, `docker exec c sh -c "…"`, `su -c "…"`, `wsl bash -c "…"` | the command is in the text, even though it runs elsewhere |
| PowerShell operators and nesting | `pwsh -c "Remove-Item -Recurse -Force x"` (flag followed by a space), `& Remove-Item x -Recurse`, `& { … }`, `% { Remove-Item $_ -Recurse }`, `Start-Process cmd -ArgumentList "/c rd /s /q x"`, `cmd /c "del /s /q x"` | same text |
| Other kinds, wrapped | git clean, `git reset --hard`, `curl … \| sh`, `dd`, `DROP TABLE`, `find -delete`, `docker system prune -a`, writes to `shield.json` | same text |
| Force push by branch | `sh -c "git push --force origin main"` is weighed as a force push onto `main` | `gitCalls` strips the quotes round each word |

## Missed: the words are in the text but a pattern does not fire

These are gaps in the patterns, not limits of the approach. They can be fixed
without changing what the shield is. Found by probing; **not fixed yet and not
covered by tests as supported.**

| Scenario | Example | Cause |
| --- | --- | --- |
| Last flag directly before a closing quote, paren or brace (bash) | `bash -c "rm fixture -rf"`, `sh -c 'rm x -r'` | the `rm` pattern wants whitespace or end of text after the flag (`(?=\s\|$)`) |
| The same, in PowerShell | `powershell -Command "Remove-Item x -Recurse"`, `pwsh -c 'Remove-Item x -Recurse'`, `$(Remove-Item x -Recurse)`, `& { Remove-Item x -Recurse}` | the PowerShell `-Recurse` pattern wants whitespace, `:` or end of text after it |
| Same, cmd | `cmd /c "rd x /s"` | `/s` followed by a quote |
| `sudo` right after a quote or backtick | `bash -c "sudo ls"`, ``echo `sudo ls` `` | `sudo` must follow whitespace, `;&\|(` |
| `rm` without recursion on one file | `rm -f x`, `shred -u x`, `unlink x`, `> file`, `: > file`, `mv x /dev/null` | not in the list on purpose or by omission; the list is of what is *hard to undo at scale*, not of every deletion |
| `rsync --delete` | `rsync -a --delete empty/ dest/` | no pattern |
| PowerShell `Invoke-Expression "…"` of a literal | `iex "Remove-Item x -Recurse"` | caught only if the trailing-quote gap above does not apply |

## Not reliably interceptable: the words are not in the text

The shield sees one string. Anything resolved after it has looked is invisible.

| Scenario | Example |
| --- | --- |
| Variables as command or flags | `X=rm; $X -rf x`, `F=-rf; rm $F x`, `G=git; $G push --force origin main` |
| Quote and escape splitting | `r""m -rf x`, `"rm" -rf x`, `` Remove`-Item `` |
| Globbing and brace expansion | `/bin/r? -rf x`, `{rm,-rf,x}` |
| Runtime-built strings | `eval "r""m -rf x"`, `` $(printf '\x72\x6d') -rf x ``, PowerShell `Invoke-Expression ("Remove-" + "Item …")` |
| Encoding | `… \| base64 -d \| sh`, `powershell -EncodedCommand …` |
| Script files and build targets | `sh ./cleanup.sh`, `make clean`, `npm run clean`, `curl -o i.sh …; sh i.sh` (a file written earlier, or by an Edit/Write, is not read when it is run) |
| Native APIs in other languages | `python3 -c "shutil.rmtree('x')"`, `[IO.Directory]::Delete('x',$true)`, `perl -e 'unlink …'` |
| Aliases and config | `git zap` after `git config alias.zap '!rm -rf x'`, shell aliases and functions |
| A shell that is not the Bash or PowerShell tool | anything run by an MCP server, a plugin, a `Monitor`/scheduled task, an IDE button or a process Claude started earlier |
| Effects of a harmless-looking command | a test suite, installer or migration that deletes things itself |

Calls made by subagents go through the same hook and are checked the same way.

## What would change this

- Fix the **missed** table: allow a closing quote, `)`, `}` or backtick after the
  last flag, and before `sudo`. Small, local, testable.
- Add a few more patterns that are plainly catastrophic and cheap to spot
  (`rsync --delete`, `shred`).
- For the **not interceptable** table, the honest answer is not a longer
  regex list. Variable and encoding tricks need a real shell parser and still
  would not see inside scripts or other programs. Containment belongs in a
  sandbox or in Claude Code's own permissions.
