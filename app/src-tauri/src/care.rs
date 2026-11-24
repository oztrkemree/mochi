//! The computer's care: what listens here, the disk, the battery, the load, the worktrees of the repositories Mochi knows,
//! and what the agents say their versions are. Each is read or run when the window asks, never on a timer; the rules live
//! in the window.

use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};

use crate::store::home_dir;
use crate::work::{git, run, Out};

/// What a program printed when it ran and exited well, else empty text.
fn printed(out: Option<Out>) -> String {
    out.filter(|o| o.code == 0).map(|o| o.stdout).unwrap_or_default()
}

/// What a program printed, whatever its exit code: lsof exits 1 when it matches nothing but still prints what it found.
fn stdout(out: Option<Out>) -> String {
    out.map(|o| o.stdout).unwrap_or_default()
}

/// lsof's listening TCP sockets as `-F pcn` text: the same command for the list and for the check before a stop.
fn listeners() -> String {
    stdout(run("lsof", &["+c", "0", "-iTCP", "-sTCP:LISTEN", "-n", "-P", "-F", "pcn"], None, Duration::from_secs(2)))
}

/// The process ids in lsof's text, each once and at most 64 of them.
pub fn pids_in(lsof: &str) -> Vec<u32> {
    let mut pids: Vec<u32> = Vec::new();
    for pid in lsof.lines().filter_map(|l| l.strip_prefix('p')) {
        if pid.is_empty() || !pid.bytes().all(|b| b.is_ascii_digit()) {
            continue;
        }
        if let Ok(pid) = pid.parse::<u32>() {
            if !pids.contains(&pid) {
                pids.push(pid);
            }
        }
        if pids.len() == 64 {
            break;
        }
    }
    pids
}

/// What listens on this computer and since when, as the programs said it: for the window to read.
pub fn ports() -> Value {
    let lsof = listeners();
    let ids = pids_in(&lsof);
    let (ps, cwd) = if ids.is_empty() {
        (String::new(), String::new())
    } else {
        let list = ids.iter().map(u32::to_string).collect::<Vec<_>>().join(",");
        (
            printed(run("ps", &["-o", "pid=,etime=", "-p", &list], None, Duration::from_secs(2))),
            stdout(run("lsof", &["-a", "-d", "cwd", "-F", "pn", "-p", &list], None, Duration::from_secs(2))),
        )
    };
    json!({ "lsof": lsof, "ps": ps, "cwd": cwd })
}

/// Whether this process listens on this port, by lsof's own word.
pub fn listens(lsof: &str, pid: u32, port: u16) -> bool {
    let mut mine = false;
    for line in lsof.lines() {
        if let Some(owner) = line.strip_prefix('p') {
            mine = owner == pid.to_string();
        } else if let (true, Some(addr)) = (mine, line.strip_prefix('n')) {
            if addr.rsplit_once(':').is_some_and(|(_, p)| p == port.to_string()) {
                return true;
            }
        }
    }
    false
}

/// Whether a process may be asked to stop: one that listens on that port right now, on a port from 1024 up, and neither this app nor the system's first process.
pub fn may_stop(lsof: &str, pid: u32, port: u16, me: u32) -> bool {
    pid > 1 && pid != me && port >= 1024 && listens(lsof, pid, port)
}

/// Asks a dev server to stop: only a process that may be stopped (see `may_stop`). True when the signal was sent.
pub fn stop_server(pid: u32, port: u16) -> bool {
    if cfg!(windows) || !may_stop(&listeners(), pid, port, std::process::id()) {
        return false;
    }
    run("kill", &["-TERM", &pid.to_string()], None, Duration::from_secs(2)).is_some_and(|o| o.code == 0)
}

/// The computer as the programs tell it: the disk under the home folder, the battery, the load and the cores.
pub fn machine() -> Value {
    let two = Duration::from_secs(2);
    let df = match home_dir() {
        Some(home) => printed(run("df", &["-k", &home.to_string_lossy()], None, two)),
        None => String::new(),
    };
    let read = |path: &str| std::fs::read_to_string(path).unwrap_or_default().trim_end().to_owned();
    let batt = if cfg!(target_os = "macos") {
        printed(run("pmset", &["-g", "batt"], None, two))
    } else if cfg!(target_os = "linux") {
        format!("{}\n{}", read("/sys/class/power_supply/BAT0/capacity"), read("/sys/class/power_supply/BAT0/status"))
    } else {
        String::new()
    };
    let load = if cfg!(target_os = "macos") {
        printed(run("sysctl", &["-n", "vm.loadavg"], None, two))
    } else if cfg!(target_os = "linux") {
        read("/proc/loadavg")
    } else {
        String::new()
    };
    let cpus = std::thread::available_parallelism().map(|n| n.get() as u64).unwrap_or(1);
    json!({ "df": df, "batt": batt, "load": load, "cpus": cpus })
}

/// The paths of the worktrees in `git worktree list --porcelain`, the main checkout first.
pub fn tree_paths(list: &str) -> Vec<String> {
    list.lines().filter_map(|l| l.strip_prefix("worktree ")).filter(|p| !p.is_empty()).map(str::to_owned).collect()
}

/// The first number a program printed (du's size), 0 when there is none.
fn first_number(text: &str) -> u64 {
    text.split_whitespace().next().and_then(|n| n.parse().ok()).unwrap_or(0)
}

/// The worktrees of one repository, as git tells them, with for each but the first whether it has uncommitted changes and how big it is.
pub fn worktrees_of(root: &Path) -> Value {
    let list = stdout(git(root, &["worktree", "list", "--porcelain"]));
    let default = git(root, &["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).map(|o| o.stdout.trim().to_owned()).filter(|b| !b.is_empty()).unwrap_or_else(|| "main".into());
    let merged = stdout(git(root, &["branch", "--merged", &default, "--format=%(refname:short)"]));
    let trees: Vec<Value> = tree_paths(&list)
        .iter()
        .skip(1)
        .take(40)
        .map(|path| {
            let dirty = git(Path::new(path), &["status", "--porcelain"]).is_none_or(|o| !o.stdout.is_empty());
            let kb = run("du", &["-sk", path], None, Duration::from_secs(20)).filter(|o| o.code == 0).map_or(0, |o| first_number(&o.stdout));
            let ignored = ignored_in(&stdout(git(Path::new(path), &["status", "--porcelain", "--ignored"])));
            json!({ "path": path, "isDirty": dirty, "kb": kb, "ignored": ignored })
        })
        .collect();
    json!({ "repo": root.to_string_lossy(), "list": list, "merged": merged, "trees": trees })
}

/// The paths git ignores, from status's --ignored text: the lines marked `!!`, sixty at most.
pub fn ignored_in(status: &str) -> String {
    status.lines().filter_map(|l| l.strip_prefix("!! ")).take(60).collect::<Vec<_>>().join("\n")
}

/// The roots in repos.json, the most lately seen first.
pub fn roots_by_time(text: &str) -> Vec<String> {
    let Ok(Value::Object(seen)) = serde_json::from_str::<Value>(text) else {
        return Vec::new();
    };
    let mut roots: Vec<(f64, String)> = seen.into_iter().filter(|(root, _)| !root.is_empty()).filter_map(|(root, at)| at.as_f64().map(|at| (at, root))).collect();
    roots.sort_by(|a, b| b.0.total_cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    roots.into_iter().map(|(_, root)| root).collect()
}

/// The main checkout of the repository a folder belongs to, as git tells it: the first path of its worktree list.
pub fn main_of(root: &Path) -> Option<String> {
    let out = git(root, &["worktree", "list", "--porcelain"])?;
    tree_paths(&out.stdout).into_iter().next()
}

/// The repositories the Mochis know, each once, by its main checkout: the most lately seen first, twelve at most.
pub fn known_repos(dir: &Path) -> Vec<String> {
    let text = std::fs::read_to_string(dir.join("repos.json")).unwrap_or_default();
    let mut mains: Vec<String> = Vec::new();
    for root in roots_by_time(&text).iter().take(80).filter(|root| Path::new(root).is_dir()) {
        if let Some(main) = main_of(Path::new(root)).filter(|main| !mains.contains(main)) {
            mains.push(main);
        }
        if mains.len() == 12 {
            break;
        }
    }
    mains
}

/// Every repository the Mochis know (repos.json), each with its worktrees; a repository with only its main checkout is left out.
pub fn worktrees(dir: &Path) -> Vec<Value> {
    known_repos(dir)
        .iter()
        .map(|repo| worktrees_of(Path::new(repo)))
        .filter(|repo| repo["trees"].as_array().is_some_and(|trees| !trees.is_empty()))
        .collect()
}

/// Whether git lists the worktree at `path` as locked.
fn is_locked(list: &str, path: &str) -> bool {
    list.split("\n\n").any(|block| block.lines().any(|l| l.strip_prefix("worktree ") == Some(path)) && block.lines().any(|l| l == "locked" || l.starts_with("locked ")))
}

/// Whether a chat's folder is this worktree or inside it, whatever the letter case or the slashes: when in doubt a chat is in it.
fn inside(folder: &str, path: &str) -> bool {
    let norm = |s: &str| s.replace('\\', "/").trim_end_matches('/').to_lowercase();
    let (f, p) = (norm(folder), norm(path));
    !p.is_empty() && (f == p || f.starts_with(&format!("{p}/")))
}

/// Removes one worktree: only one that git lists for a repository Mochi knows, never its main checkout, never a locked one and
/// never one a chat works in. With git's own care unless `force` is true, which is the person's word over a worktree git calls
/// unclean (changes, new files): its folder goes with them, its branch stays.
/// Git is given three minutes: a worktree full of build output is slow to delete, and must not be cut off half way.
pub fn remove_worktree(dir: &Path, repo: &str, path: &str, force: bool) -> Result<(), String> {
    if !known_repos(dir).iter().any(|known| known == repo) {
        return Err("not a repository Mochi knows".into());
    }
    let list = stdout(git(Path::new(repo), &["worktree", "list", "--porcelain"]));
    let paths = tree_paths(&list);
    if paths.first().is_some_and(|main| main == path) || !paths.iter().skip(1).any(|p| p == path) {
        return Err("not a worktree of that repository".into());
    }
    // Not the window's word to give, forced or not: git's own lock, and a chat that works in the folder (checked again here, at the last moment).
    if is_locked(&list, path) {
        return Err("locked".into());
    }
    if chat_folders(dir).iter().any(|f| inside(f, path)) {
        return Err("a chat is open in it".into());
    }
    let mut args = vec!["-C", repo, "worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(path);
    match run("git", &args, None, Duration::from_secs(180)) {
        None => Err("git could not be run".into()),
        Some(o) if o.code == 0 => Ok(()),
        Some(o) => {
            let why: String = o.stderr.trim().chars().take(300).collect();
            Err(if why.is_empty() { "git could not remove it".into() } else { why })
        }
    }
}

/// What each agent says its version is; empty text for one that is not installed.
pub fn agent_versions() -> Value {
    let five = Duration::from_secs(5);
    json!({
        "claude": printed(run("claude", &["--version"], None, five)),
        "codex": printed(run("codex", &["--version"], None, five)),
    })
}

/// The folders the chats open now work in, from every chat's file in `live`: for the window to keep their worktrees.
pub fn chat_folders(dir: &Path) -> Vec<String> {
    let Ok(files) = std::fs::read_dir(dir.join("live")) else {
        return Vec::new();
    };
    let mut folders: Vec<String> = Vec::new();
    let jsons = files.flatten().filter(|f| f.file_name().to_string_lossy().ends_with(".json") && f.file_type().is_ok_and(|t| t.is_file())).take(200);
    for file in jsons {
        let text = std::fs::read_to_string(file.path()).unwrap_or_default();
        let folder = serde_json::from_str::<Value>(&text).ok().and_then(|v| v["folder"].as_str().filter(|f| !f.is_empty()).map(str::to_owned));
        if let Some(folder) = folder.filter(|f| !folders.contains(f)) {
            folders.push(folder);
        }
    }
    folders
}

/// Whether a version is digits and dots only, 1 to 20 characters, starting and ending with a digit.
pub fn is_version(v: &str) -> bool {
    (1..=20).contains(&v.len())
        && v.bytes().all(|b| b.is_ascii_digit() || b == b'.')
        && v.as_bytes()[0].is_ascii_digit()
        && v.as_bytes()[v.len() - 1].is_ascii_digit()
}

/// Where the text that says what changed in an agent's version is: Claude Code's changelog, or Codex's release of that version.
pub fn changes_url(agent: &str, version: &str) -> Option<String> {
    if !is_version(version) {
        return None;
    }
    match agent {
        "claude" => Some("https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md".into()),
        "codex" => Some(format!("https://api.github.com/repos/openai/codex/releases/tags/rust-v{version}")),
        _ => None,
    }
}

/// The most a changelog may weigh; Claude Code's own is well over a megabyte.
const CHANGES_MOST: usize = 10_000_000;

/// The text that says what changed in an agent's version, fetched with the person's own curl and nothing about them: Claude Code's changelog, or Codex's release of that version.
pub fn changes(agent: &str, version: &str) -> Option<String> {
    let url = changes_url(agent, version)?;
    let out = run("curl", &["-fsSL", "--max-time", "10", "-H", "Accept: application/vnd.github+json", &url], None, Duration::from_secs(10))?;
    (out.code == 0 && out.stdout.len() <= CHANGES_MOST).then_some(out.stdout)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::work::with_root;

    const LSOF: &str = "p666\ncControlCenter\nf9\nn*:7000\np4242\ncnode\nn*:5173\np4242\n";

    #[test]
    fn the_processes_that_listen_are_read_from_lsof() {
        assert_eq!(pids_in(LSOF), vec![666, 4242]);
        assert_eq!(pids_in("pabc\n"), Vec::<u32>::new());
    }

    #[test]
    fn a_port_is_checked_for_the_process_that_listens_on_it() {
        let lsof = [LSOF, "p4242\ncnode\nf1\nn127.0.0.1:5173\nf2\nn[::1]:5173\np5000\ncpython\nn*:8000\n"].concat();
        assert!(listens(&lsof, 4242, 5173));
        assert!(!listens(&lsof, 4242, 8000));
        assert!(!listens(&lsof, 5000, 5173));
        assert!(!listens(&lsof, 4242, 517));
        assert!(listens(&lsof, 5000, 8000));
    }

    #[test]
    fn a_process_is_stopped_only_when_it_listens_on_a_dev_port_and_is_not_us() {
        let text = "p666\ncControlCenter\nn*:80\np4242\ncnode\nn127.0.0.1:5173\n";
        assert!(may_stop(text, 4242, 5173, 9));
        assert!(!may_stop(text, 4242, 5173, 4242));
        assert!(!may_stop(text, 666, 80, 9));
        assert!(!may_stop(text, 1, 5173, 9));
        assert!(!may_stop(text, 4242, 8000, 9));
        let claunchd = "p1\nclaunchd\nn*:5173\n";
        assert!(listens(claunchd, 1, 5173));
        assert!(!may_stop(claunchd, 1, 5173, 9));
    }

    #[test]
    fn the_folders_the_open_chats_work_in_are_read_from_their_live_files() {
        let base = crate::store::tests::scratch("care-live");
        let live = base.join("live");
        std::fs::create_dir_all(&live).unwrap();
        std::fs::write(live.join("a.json"), r#"{"id":"a","folder":"/w/shop"}"#).unwrap();
        std::fs::write(live.join("b.json"), r#"{"id":"b"}"#).unwrap();
        std::fs::write(live.join("c.json"), "not json").unwrap();
        std::fs::write(live.join("d.json"), r#"{"id":"d","folder":"/w/shop"}"#).unwrap();
        std::fs::write(live.join("e.txt"), r#"{"folder":"/w/no"}"#).unwrap();
        assert_eq!(chat_folders(&base), vec!["/w/shop"]);
        assert!(chat_folders(&base.join("nothing")).is_empty());
        std::fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn worktree_paths_are_read_and_a_bare_worktree_line_is_skipped() {
        let list = "worktree /a/main\nHEAD 1\nbranch refs/heads/main\n\nworktree\n\nworktree /a/feat\nHEAD 2\nbranch refs/heads/feat\n";
        assert_eq!(tree_paths(list), vec!["/a/main", "/a/feat"]);
    }

    #[test]
    fn the_repositories_are_read_newest_first_as_repos_json_is_written() {
        // Written a moment apart, api the later: two readings of the clock can differ by a millisecond, so the times are given.
        let now = crate::store::now_ms();
        let text = with_root(&with_root("", "/w/web", now - 5), "/w/api", now);
        assert_eq!(roots_by_time(&text), vec!["/w/api", "/w/web"]);
        assert_eq!(roots_by_time(r#"{"/a": 5, "/b": 9, "/c": "x", "": 3, "/d": 7}"#), vec!["/b", "/d", "/a"]);
        assert!(roots_by_time("not json").is_empty());
        assert!(roots_by_time("[\"/w/a\"]").is_empty());
        assert!(roots_by_time("").is_empty());
    }

    #[test]
    fn the_ignored_paths_are_read_from_status_as_git_marks_them() {
        assert_eq!(ignored_in(" M a.ts\n?? new.ts\n!! node_modules/\n!! .env\n"), "node_modules/\n.env");
        assert_eq!(ignored_in(" M a.ts\n"), "");
    }

    #[test]
    fn a_version_is_digits_and_dots_only() {
        assert!(is_version("2.1.312"));
        assert!(is_version("0.172.0"));
        assert!(!is_version(""));
        assert!(!is_version("1.2."));
        assert!(!is_version("1.2;rm"));
        assert!(!is_version("v1.2"));
        assert!(!is_version(&"1.".repeat(11)));
    }

    #[test]
    fn the_changes_are_fetched_only_for_a_known_agent_and_a_version() {
        assert_eq!(changes_url("claude", "2.1.312").as_deref(), Some("https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md"));
        assert_eq!(changes_url("codex", "0.172.0").as_deref(), Some("https://api.github.com/repos/openai/codex/releases/tags/rust-v0.172.0"));
        assert_eq!(changes_url("codex", "1.2;rm"), None);
        assert_eq!(changes_url("cursor", "1.0"), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_worktree_is_removed_only_when_git_lets_it_go() {
        let base = crate::store::tests::scratch("care-remove");
        let (repo, data) = (base.join("repo"), base.join("data"));
        std::fs::create_dir_all(&repo).unwrap();
        std::fs::create_dir_all(&data).unwrap();
        let sh = |dir: &Path, cmd: &str| assert_eq!(run("sh", &["-c", cmd], Some(dir), Duration::from_secs(10)).unwrap().code, 0, "{cmd}");
        sh(&repo, "git init -q && git config user.email a@b.c && git config user.name A && echo x > f && git add f && git commit -qm First && git worktree add -q ../clean -b clean && git worktree add -q ../dirty -b dirty");
        std::fs::write(base.join("dirty").join("new.txt"), "z").unwrap();
        let repo_text = repo.to_str().unwrap().to_owned();
        let list = git(&repo, &["worktree", "list", "--porcelain"]).unwrap().stdout;
        let paths = tree_paths(&list);
        assert_eq!(paths.len(), 3);
        // A chat that works in the clean worktree notes that folder too: the repository is still known once.
        let seen = with_root(&with_root("", &repo_text, crate::store::now_ms()), &paths[1], crate::store::now_ms());
        std::fs::write(data.join("repos.json"), seen).unwrap();

        let known = known_repos(&data);
        assert_eq!(known.len(), 1);
        assert_eq!(Path::new(&known[0]).canonicalize().unwrap(), repo.canonicalize().unwrap());
        let groups = worktrees(&data);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0]["trees"].as_array().unwrap().len(), 2);
        let main = known[0].clone();

        assert!(remove_worktree(&data, &main, "/nowhere", false).is_err());
        assert!(remove_worktree(&data, &main, &paths[0], false).is_err());
        assert!(remove_worktree(&data, "/nowhere-repo", &paths[1], false).is_err());
        assert!(remove_worktree(&data, &paths[1], &paths[1], false).is_err());
        let refused = remove_worktree(&data, &main, &paths[2], false).unwrap_err();
        assert!(!refused.is_empty());
        assert!(Path::new(&paths[2]).exists());
        // Never the main checkout, not even by the person's word.
        assert!(remove_worktree(&data, &main, &paths[0], true).is_err());
        assert!(Path::new(&paths[0]).exists());
        assert_eq!(remove_worktree(&data, &main, &paths[1], false), Ok(()));
        assert!(!Path::new(&paths[1]).exists());
        // A chat that works in the folder (or below it) stops it, forced or not; a locked one too.
        std::fs::create_dir_all(data.join("live")).unwrap();
        std::fs::write(data.join("live").join("chat.json"), format!(r#"{{"folder":"{}/sub"}}"#, paths[2].to_uppercase())).unwrap();
        assert_eq!(remove_worktree(&data, &main, &paths[2], true), Err("a chat is open in it".into()));
        assert!(Path::new(&paths[2]).exists());
        std::fs::remove_file(data.join("live").join("chat.json")).unwrap();
        sh(&repo, "git worktree lock ../dirty");
        assert_eq!(remove_worktree(&data, &main, &paths[2], true), Err("locked".into()));
        assert!(Path::new(&paths[2]).exists());
        sh(&repo, "git worktree unlock ../dirty");
        // The unclean one goes when the person says so, and its branch stays.
        assert_eq!(remove_worktree(&data, &main, &paths[2], true), Ok(()));
        assert!(!Path::new(&paths[2]).exists());
        assert_eq!(stdout(git(&repo, &["branch", "--list", "dirty"])).trim(), "dirty");
        std::fs::remove_dir_all(&base).unwrap();
    }
}
