//! The person's work outside the chats, from their own git and gh: the repositories their chats work in (for the mod's stand-up),
//! a folder's changes, and the CI of what they pushed. Each is run when the window asks, never on a timer.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::{json, Map, Value};

use crate::store::write_whole;

const DAY_MS: u128 = 86_400_000;

/// What a program said, or None when it could not be run or ran too long.
pub struct Out {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// A program by name, also where an app started from the Dock does not look: a Mac app's PATH has no Homebrew in it.
fn tool(name: &str) -> PathBuf {
    // On Windows npm installs a program as a .cmd, which Command runs through cmd.exe with its arguments escaped.
    let files = if cfg!(windows) { vec![format!("{name}.exe"), format!("{name}.cmd")] } else { vec![name.to_owned()] };
    let dirs = search_path();
    files.iter().find_map(|f| dirs.iter().map(|dir| dir.join(f)).find(|p| p.is_file())).unwrap_or_else(|| PathBuf::from(name))
}

/// The PATH, and Homebrew's folders after it.
fn search_path() -> Vec<PathBuf> {
    let path = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&path).chain(["/opt/homebrew/bin", "/usr/local/bin"].map(PathBuf::from)).collect()
}

/// Runs a program with no shell between, and gives up on it after `limit`.
pub(crate) fn run(name: &str, args: &[&str], dir: Option<&Path>, limit: Duration) -> Option<Out> {
    let mut command = Command::new(tool(name));
    command.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    // A script's `#!/usr/bin/env node` finds node in Homebrew too.
    if let Ok(path) = std::env::join_paths(search_path()) {
        command.env("PATH", path);
    }
    if let Some(dir) = dir {
        command.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // No console window flashing up for each call.
        command.creation_flags(0x0800_0000);
    }
    let mut child = command.spawn().ok()?;
    let drain = |pipe: Option<Box<dyn Read + Send>>| {
        std::thread::spawn(move || {
            let mut text = String::new();
            if let Some(pipe) = pipe {
                let _ = pipe.take(4_000_000).read_to_string(&mut text);
            }
            text
        })
    };
    let out = drain(child.stdout.take().map(|p| Box::new(p) as Box<dyn Read + Send>));
    let err = drain(child.stderr.take().map(|p| Box::new(p) as Box<dyn Read + Send>));
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < limit => std::thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    };
    Some(Out { code: status.code().unwrap_or(-1), stdout: out.join().unwrap_or_default(), stderr: err.join().unwrap_or_default() })
}

pub(crate) fn git(root: &Path, args: &[&str]) -> Option<Out> {
    let mut all = vec!["-C", root.to_str()?];
    all.extend_from_slice(args);
    run("git", &all, None, Duration::from_secs(5)).filter(|o| o.code == 0)
}

// ---------- the repositories any Mochi saw ----------

/// repos.json with a root seen now, and without those quiet for a month: the mod's own rule, so every Mochi may add to it.
pub fn with_root(text: &str, root: &str, now: u128) -> String {
    let mut seen = match serde_json::from_str::<Value>(text) {
        Ok(Value::Object(seen)) => seen,
        _ => Map::new(),
    };
    seen.insert(root.to_owned(), json!(now as u64));
    seen.retain(|_, at| at.as_f64().is_some_and(|at| (now as f64) - at < (30 * DAY_MS) as f64));
    format!("{}\n", Value::Object(seen))
}

/// Notes the repository a chat works in, for the stand-up to read its commits: its root, as git tells it.
pub fn see_repo(dir: &Path, cwd: &str, now: u128) -> bool {
    let Some(top) = git(Path::new(cwd), &["rev-parse", "--show-toplevel"]) else { return false };
    let root = top.stdout.trim();
    if root.is_empty() {
        return false;
    }
    let path = dir.join("repos.json");
    // A file there that cannot be read now (locked, caught mid-write) is left as it is: the root is noted next hour.
    let text = match std::fs::read_to_string(&path) {
        Ok(text) if serde_json::from_str::<Value>(&text).is_ok_and(|v| v.is_object()) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        _ => return false,
    };
    write_whole(&path, &with_root(&text, root, now))
}

/// How a chat's folder stands for the nudge to commit: files changed, and when the last commit was (seconds; 0 for none).
pub fn git_state(cwd: &str) -> Option<Value> {
    let root = Path::new(cwd);
    let status = git(root, &["--no-optional-locks", "status", "--porcelain=v1"])?;
    let last = git(root, &["log", "-1", "--format=%ct"]).and_then(|o| o.stdout.trim().parse::<u64>().ok()).unwrap_or(0);
    let top = git(root, &["rev-parse", "--show-toplevel"]).map(|o| o.stdout.trim().to_owned()).unwrap_or_default();
    Some(json!({ "root": top, "changed": status.stdout.lines().filter(|l| !l.is_empty()).count(), "lastCommit": last }))
}

// ---------- the CI of a push ----------

fn told(out: Option<Out>) -> Value {
    match out {
        Some(o) => json!({ "code": o.code, "stdout": o.stdout, "stderr": o.stderr.chars().take(2000).collect::<String>() }),
        None => Value::Null,
    }
}

fn is_sha(text: &str) -> bool {
    (40..=64).contains(&text.len()) && text.bytes().all(|b| b.is_ascii_hexdigit())
}

/// The runs of a pushed commit, for the CI after a push: `sha` once known, else the commit the chat's folder stands on now.
pub fn ci(cwd: &str, sha: Option<&str>) -> Value {
    let sha = match sha {
        Some(sha) if is_sha(sha) => sha.to_owned(),
        Some(_) => return Value::Null,
        None => match git(Path::new(cwd), &["rev-parse", "HEAD"]) {
            Some(head) if is_sha(head.stdout.trim()) => head.stdout.trim().to_owned(),
            _ => return Value::Null,
        },
    };
    let out = run("gh", &["run", "list", "--commit", &sha, "--json", "status,conclusion,name,workflowName,event,createdAt,updatedAt"], Some(Path::new(cwd)), Duration::from_secs(15));
    json!({ "sha": sha, "out": told(out) })
}

// ---------- a newer version ----------

/// A version's numbers, for comparing: "1.2.10" is after "1.2.9".
fn numbers(version: &str) -> Vec<u64> {
    version.trim_start_matches('v').split('.').map(|n| n.parse().unwrap_or(0)).collect()
}

/// The newest desktop release GitHub lists (tags `desktop-v…`, not drafts or previews) when it is newer than `current`: its version and page.
pub fn newer_release(json: &str, current: &str) -> Option<(String, String)> {
    let releases: Vec<Value> = serde_json::from_str(json).ok()?;
    releases
        .iter()
        .filter(|r| r["draft"] != true && r["prerelease"] != true)
        .filter_map(|r| Some((r["tag_name"].as_str()?.strip_prefix("desktop-v")?.to_owned(), r["html_url"].as_str()?.to_owned())))
        .filter(|(v, url)| url.starts_with("https://github.com/") && numbers(v) > numbers(current))
        .max_by(|a, b| numbers(&a.0).cmp(&numbers(&b.0)))
}

/// Asks GitHub, with the person's own curl and nothing about them, which desktop releases there are.
pub fn releases() -> Option<String> {
    let out = run("curl", &["-fsSL", "--max-time", "10", "-H", "Accept: application/vnd.github+json", "https://api.github.com/repos/oztrkemree/mochi/releases?per_page=20"], None, Duration::from_secs(15))?;
    (out.code == 0).then_some(out.stdout)
}

// ---------- what the agents used and cost ----------

/// CodeBurn's arguments for a report: a status report of a span, or the providers' limits. Nothing else is run.
fn usage_args<'a>(kind: &str, span: &'a str) -> Option<Vec<&'a str>> {
    match kind {
        "status" if ["today", "week", "30days", "month"].contains(&span) => Some(vec!["status", "--format", "menubar-json", "--period", span]),
        "quota" => Some(vec!["quota", "--format", "json"]),
        _ => None,
    }
}

/// What the counter shipped in Mochi (CodeBurn, in `counter`, see `codeburn/README.md`) reports, as JSON text, run by the
/// person's own Node. Err("missing") when there is no Node 22.13 or later, Err("failed") when it said no JSON or took too
/// long (a month of logs can take half a minute).
pub fn usage(counter: &Path, kind: &str, span: &str) -> Result<String, String> {
    let args = usage_args(kind, span).ok_or("failed")?;
    let cli = counter.join("dist").join("cli.js");
    if !cli.is_file() {
        return Err("failed".into());
    }
    if !tool("node").is_absolute() {
        return Err("missing".into());
    }
    let out = run("node", &[&[cli.to_str().ok_or("failed")?][..], &args].concat(), None, Duration::from_secs(120)).ok_or("failed")?;
    if out.stderr.contains("requires Node.js") {
        return Err("missing".into());
    }
    (out.code == 0 && serde_json::from_str::<Value>(&out.stdout).is_ok()).then_some(out.stdout).ok_or_else(|| "failed".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codeburn_is_asked_only_for_a_known_report() {
        assert_eq!(usage_args("status", "week"), Some(vec!["status", "--format", "menubar-json", "--period", "week"]));
        assert_eq!(usage_args("quota", ""), Some(vec!["quota", "--format", "json"]));
        assert_eq!(usage_args("status", "--output=/etc/x"), None);
        assert_eq!(usage_args("export", "week"), None);
    }

    #[test]
    fn the_counter_ships_whole() {
        // The bundle reads ../package.json for its version and starts its parse workers from beside main.js.
        let counter = Path::new(env!("CARGO_MANIFEST_DIR")).join("codeburn");
        for file in ["package.json", "LICENSE", "dist/cli.js", "dist/main.js", "dist/parse-worker.js"] {
            assert!(counter.join(file).is_file(), "{file}");
        }
        assert_eq!(usage(Path::new("/nowhere"), "status", "week"), Err("failed".into()));
        // With Node 22.13 or later on this computer the shipped counter answers; with an older one or none, it says so.
        match usage(&counter, "quota", "") {
            Ok(json) => assert!(json.contains("\"providers\"")),
            Err(e) => assert_eq!(e, "missing"),
        }
    }

    #[test]
    fn a_newer_desktop_release_is_found_and_nothing_else() {
        let json = json!([
            { "tag_name": "v0.10.0", "html_url": "https://github.com/o/m/releases/tag/v0.10.0" },
            { "tag_name": "desktop-v1.2.0", "html_url": "https://github.com/o/m/releases/tag/desktop-v1.2.0", "prerelease": true },
            { "tag_name": "desktop-v1.0.10", "html_url": "https://github.com/o/m/releases/tag/desktop-v1.0.10" },
            { "tag_name": "desktop-v1.0.9", "html_url": "https://github.com/o/m/releases/tag/desktop-v1.0.9" },
            { "tag_name": "desktop-v9.0.0", "html_url": "https://evil.example/x" },
        ]).to_string();
        assert_eq!(newer_release(&json, "1.0.0"), Some(("1.0.10".into(), "https://github.com/o/m/releases/tag/desktop-v1.0.10".into())));
        assert_eq!(newer_release(&json, "1.0.10"), None);
        assert_eq!(newer_release("not json", "1.0.0"), None);
    }

    #[test]
    fn the_repositories_are_kept_by_the_mods_rules() {
        let now = 100 * DAY_MS;
        let text = json!({ "/w/api": (now - DAY_MS) as u64, "/w/old": (now - 20 * DAY_MS) as u64, "/w/gone": (now - 40 * DAY_MS) as u64 }).to_string();
        let next: Value = serde_json::from_str(&with_root(&text, "/w/web", now)).unwrap();
        // Kept a month, as the mod keeps it (its stand-up reads the last two weeks).
        assert_eq!(next.as_object().unwrap().keys().cloned().collect::<Vec<_>>(), vec!["/w/api", "/w/old", "/w/web"]);
        assert_eq!(next["/w/web"], json!(now as u64));
        assert_eq!(with_root("not json", "/w/a", now), format!("{{\"/w/a\":{}}}\n", now as u64));
    }

    #[test]
    fn the_ci_is_read_for_the_commit_that_was_pushed() {
        assert!(is_sha("0123456789abcdef0123456789abcdef01234567"));
        assert!(!is_sha("HEAD"));
        assert!(!is_sha("--output=x"));
        assert!(ci("/nowhere", Some("--output=x")).is_null());
    }

    #[cfg(unix)]
    #[test]
    fn repos_json_that_cannot_be_read_is_not_written_over() {
        let dir = std::env::temp_dir().join(format!("mochi-repos-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("repos.json"), "{\"/w/a\": 1, \"/w/b").unwrap();
        let cwd = std::env::current_dir().unwrap();
        assert!(!see_repo(&dir, cwd.to_str().unwrap(), 2));
        assert_eq!(std::fs::read_to_string(dir.join("repos.json")).unwrap(), "{\"/w/a\": 1, \"/w/b");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_program_that_runs_too_long_is_stopped() {
        let started = Instant::now();
        assert!(run("sh", &["-c", "sleep 5"], None, Duration::from_millis(200)).is_none());
        assert!(started.elapsed() < Duration::from_secs(2));
        let out = run("sh", &["-c", "echo hi; echo no >&2; exit 3"], None, Duration::from_secs(2)).unwrap();
        assert_eq!((out.code, out.stdout.as_str(), out.stderr.as_str()), (3, "hi\n", "no\n"));
    }

    #[cfg(unix)]
    #[test]
    fn a_folder_is_read_for_the_nudge_to_commit() {
        let dir = std::env::temp_dir().join(format!("mochi-work-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let sh = |cmd: &str| assert_eq!(run("sh", &["-c", cmd], Some(&dir), Duration::from_secs(10)).unwrap().code, 0, "{cmd}");
        sh("git init -q && git config user.email a@b.c && git config user.name A && echo x > f && git add f && git commit -qm 'First thing' && echo y > g");
        let root = dir.to_str().unwrap().to_owned();
        let state = git_state(&root).unwrap();
        assert_eq!(state["changed"], 1);
        assert!(state["lastCommit"].as_u64().unwrap() > 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
