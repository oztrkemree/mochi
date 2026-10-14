# What the shield can and cannot see

The shield is a **safety net against accidents, not a security sandbox.** It
reads the text of each command Claude is about to run through the Bash or
PowerShell tool and matches it against a list of patterns for things that cannot
be undone (`hooks/guard.ts`). If a pattern matches, it asks before the command
runs. It does not parse a shell, expand variables, decode anything, open script
files or watch what a process does once it starts. Everything happens locally
and nothing is sent anywhere.

The consequence is simple: **a destructive command is found when its words
appear in the command text, and missed when they do not.** Nesting by itself
(a subshell, `bash -c`, `$(...)`) does not hide anything, because the inner text
is still part of the text the shield reads. Hiding the words does.

Anyone who wants to get around the shield on purpose can. It is for the model
that means well and gets it wrong, not for one that is trying to evade it. If
you need real containment, use an OS-level sandbox, a container, a throwaway
VM, least-privilege credentials or a permission policy in Claude Code itself.

Audited against `hooks/guard.ts`. Every case below was run against `dangers()`
with harmless fixture names; nothing was executed. What is claimed as caught is
pinned by `tests/shield.test.ts`.

## Caught: the words are in the text

| Scenario | Example |
| --- | --- |
| Shell `-c` strings | `bash -c "rm -rf x"`, `sh -c '…'`, `zsh -lc "…"`, `wsl bash -c "…"` |
| Subshells, groups, substitutions | `(rm -rf x)`, `{ rm -rf x; }`, `echo $(rm -rf x)`, ``echo `rm -rf x` ``, `cat <(rm -rf x)` |
| Prefix wrappers | `env`, `nohup`, `nice`, `time`, `timeout`, `command`, `\rm`, `/bin/rm`, `sudo -u u` |
| Commands fed commands | `… \| xargs rm -rf`, `find . -exec rm -rf {} +`, `find . -exec shred {} +` |
| Literal `eval`, heredocs, newlines | `eval "rm -rf x"`, `sh <<EOF … EOF` |
| Other interpreters, when the shell command is spelled out in a string | `python3 -c "os.system('rm -rf x')"`, `node -e "…execSync('rm -rf x')"` |
| Remote and container hops | `ssh host "rm -rf /data"`, `docker exec c sh -c "…"`, `su -c "…"` (the text is read; the command runs elsewhere) |
| PowerShell and cmd | `pwsh -c "Remove-Item -Recurse -Force x"`, `& Remove-Item x -Recurse`, `& { … }`, `% { Remove-Item $_ -Recurse }`, `iex "Remove-Item x -Recurse"`, `cmd /c "rd x /s"`, `Start-Process cmd -ArgumentList "/c rd /s /q x"` |
| Flag order and position | `rm x -rf`, `rm -r -f x`, `rm --force --recursive x`, `rm "-rf" x`, `chmod 777 -R x`, `chmod -Rv x`; the last flag directly before a closing `"` `'` `)` `}` or backtick |
| Also deleting | `shred`, `unlink`, `rsync --delete` (and `--delete-after`, `--del`, `--remove-source-files`; not with `--dry-run` or `-n`), `wipefs -a` |
| Other kinds, wrapped | `git clean -f`, `git reset --hard`, `git checkout .`, `curl … \| sh`, `dd`, `DROP TABLE`, `delete from t`, `find -delete`, `docker system prune -a`, `shutdown`, `reboot`, `format d:`, writes to `shield.json` |
| `sudo` | `sudo ls` asks, as it always did; so do `bash -c "sudo ls"`, ``echo `sudo ls` `` and `$(sudo ls)` |
| Force push by branch | `sh -c "git push --force origin main"` is weighed as a force push onto `main` |

Calls made by subagents go through the same hook and are checked the same way.

### How false positives are kept down

- A quote counts as the start of a command only right after a shell's `-c`
  flag (`bash -c "`, `pwsh -Command '`, `cmd /c "`, `eval "`). So
  `git commit -m "reboot the router"` and `echo "shutdown now"` ask about nothing.
- `shred`, `unlink`, `rsync`, `shutdown` and `format` must be at the start of a
  command (after `;`, `&&`, `|`, `(`, a backtick, a wrapper such as `sudo`,
  `xargs` or `-exec`). `npm unlink`, `grep shred`, `dotnet format .` and
  `rsync -avn --delete` ask about nothing.
- `chmod`/`chown -R` with a capital R only; `chmod -x`, `chmod g-R` are fine.
- Bare `sudo` still asks wherever it appears after whitespace (so
  `echo sudo ls` asks). That is the older, broader rule and is kept as it was.
  `shield.json` can turn it off: `{ "off": ["sudo"] }`.

## Not caught, and not meant to be

The list is of what is hard to undo, not of every deletion.

| Scenario | Example |
| --- | --- |
| Single-file deletions and truncation | `rm -f x`, `rm x`, `mv x /dev/null`, `> file`, `: > file`, `truncate -s 0 x` |
| `find -exec rm` without `-r` | `find . -name '*.log' -exec rm {} +` |
| Dangerous words after `ssh host` that are not at a command start | `ssh host reboot` (`ssh host "rm -rf x"` and `ssh host sudo ls` are caught; a bare `reboot` after the host is not) |
| `rsync --delete` with an `-n` token anywhere | `rsync -a --delete -e 'ssh -n' a/ b/` is read as a dry run and let by |
| Text that only looks like a command | `echo rm -rf x`, `git commit -m "rm -rf docs"` ask anyway: the older rules do not know quoting |

## Not reliably interceptable: the words are not in the text

The shield sees one string. Anything resolved after it has looked is invisible.
A longer list of patterns does not change this.

| Scenario | Example |
| --- | --- |
| Variables as command or flags | `X=rm; $X -rf x`, `F=-rf; rm $F x`, `G=git; $G push --force origin main` |
| Quote and escape splitting | `r""m -rf x`, `"rm" -rf x`, `` Remove`-Item `` |
| Globbing and brace expansion | `/bin/r? -rf x`, `{rm,-rf,x}` |
| Runtime-built strings | `eval "r""m -rf x"`, ``$(printf '\x72\x6d') -rf x``, PowerShell `Invoke-Expression ("Remove-" + "Item …")` |
| Encoding | `… \| base64 -d \| sh`, `powershell -EncodedCommand …` |
| Script files and build targets | `sh ./cleanup.sh`, `make clean`, `npm run clean`, `curl -o i.sh …; sh i.sh` (a file written earlier, or by an Edit/Write, is not read when it is run) |
| Native APIs in other languages | `python3 -c "shutil.rmtree('x')"`, `[IO.Directory]::Delete('x',$true)`, `perl -e 'unlink …'` |
| Aliases and config | `git zap` after `git config alias.zap '!rm -rf x'`, shell aliases and functions |
| Anything outside the Bash and PowerShell tools | an MCP server, a plugin, a scheduled task, an IDE button, a process Claude started earlier |
| Effects of a harmless-looking command | a test suite, installer or migration that deletes things itself |

For these, rely on a sandbox, a container, backups, version control and Claude
Code's own permissions.

## Changing the shield

Add a pattern to `DANGERS` in `hooks/guard.ts`, with a positive and a negative
case in `tests/shield.test.ts`. Keep it narrow: a pattern that asks about
ordinary commands teaches people to turn the shield off.
