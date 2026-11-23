//! The person's work outside the chats, from their own git and gh: the commits for a stand-up, what is not yet safe on a
//! remote, the pull requests waiting on them, and the CI of what they pushed. Each is run when the window asks, never on a timer.

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
    let path = std::env::var_os("PATH").unwrap_or_default();
    let extra = ["/opt/homebrew/bin", "/usr/local/bin"].map(PathBuf::from);
    let file = if cfg!(windows) { format!("{name}.exe") } else { name.to_owned() };
    std::env::split_paths(&path).chain(extra).map(|dir| dir.join(&file)).find(|p| p.is_file()).unwrap_or_else(|| PathBuf::from(name))
}

/// Runs a program with no shell between, and gives up on it after `limit`.
fn run(name: &str, args: &[&str], dir: Option<&Path>, limit: Duration) -> Option<Out> {
    let mut command = Command::new(tool(name));
    command.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
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

fn git(root: &Path, args: &[&str]) -> Option<Out> {
    let mut all = vec!["-C", root.to_str()?];
    all.extend_from_slice(args);
    run("git", &all, None, Duration::from_secs(5)).filter(|o| o.code == 0)
}

fn base_name(root: &str) -> String {
    root.trim_end_matches(['/', '\\']).rsplit(['/', '\\']).next().unwrap_or(root).to_owned()
}

// ---------- the repositories any Mochi saw ----------

/// The repositories seen in the last two weeks, from repos.json (`{"<root>": lastSeenMs}`), as the mod reads it.
pub fn recent_roots(text: &str, now: u128) -> Vec<String> {
    let Ok(Value::Object(seen)) = serde_json::from_str::<Value>(text) else { return Vec::new() };
    seen.into_iter().filter(|(_, at)| at.as_f64().is_some_and(|at| (now as f64) - at < (14 * DAY_MS) as f64)).map(|(root, _)| root).collect()
}

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

pub fn roots(dir: &Path, now: u128) -> Vec<String> {
    recent_roots(&std::fs::read_to_string(dir.join("repos.json")).unwrap_or_default(), now)
}

// ---------- the stand-up and the desk ----------

/// The person's own commits since `since` (seconds), on any branch and without merges, in each root: `repo\tat\tsubject`.
pub fn commits(roots: &[String], since: i64) -> Vec<String> {
    let mut lines = Vec::new();
    for root in roots {
        let root_path = Path::new(root);
        let email = git(root_path, &["config", "user.email"]).map(|o| o.stdout.trim().to_owned()).unwrap_or_default();
        let since_arg = format!("--since=@{since}");
        let author = format!("--author={email}");
        let mut args = vec!["log", "--all", "--no-merges", since_arg.as_str(), "--format=%H%x09%ct%x09%s"];
        if !email.is_empty() {
            args.push(author.as_str());
        }
        let Some(log) = git(root_path, &args) else { continue };
        let mut seen = std::collections::HashSet::new();
        for line in log.stdout.lines() {
            let mut parts = line.splitn(3, '\t');
            let (Some(hash), Some(at), Some(subject)) = (parts.next(), parts.next(), parts.next()) else { continue };
            if seen.insert(hash.to_owned()) {
                lines.push(format!("{}\t{at}\t{subject}", base_name(root)));
            }
        }
    }
    lines
}

/// What is not yet safe on a remote in each root, as `/mochi desk` reads it: the status as git prints it, and the branches with
/// commits no remote has. A branch whose upstream is gone was merged and deleted there, so it is left out.
pub fn desks(roots: &[String]) -> Vec<Value> {
    let mut out = Vec::new();
    for root in roots {
        let root_path = Path::new(root);
        let Some(status) = git(root_path, &["--no-optional-locks", "status", "--porcelain=v1", "-b"]) else { continue };
        let has_remote = git(root_path, &["remote"]).is_some_and(|o| !o.stdout.trim().is_empty());
        let mut branches = Vec::new();
        if has_remote {
            let refs = git(root_path, &["for-each-ref", "--format=%(refname:short)%09%(upstream:short)%09%(upstream:track)", "refs/heads"]).map(|o| o.stdout).unwrap_or_default();
            for line in refs.lines().filter(|l| !l.is_empty()).take(30) {
                let mut parts = line.split('\t');
                let (name, upstream, track) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""), parts.next().unwrap_or(""));
                if track.contains("gone") {
                    continue;
                }
                if !upstream.is_empty() {
                    let ahead = track.split("ahead ").nth(1).and_then(|r| r.split(|c: char| !c.is_ascii_digit()).next()).and_then(|n| n.parse::<u64>().ok()).unwrap_or(0);
                    branches.push(json!({ "name": name, "ahead": ahead, "hasUpstream": true }));
                    continue;
                }
                let ahead = git(root_path, &["rev-list", "--count", name, "--not", "--remotes"]).and_then(|o| o.stdout.trim().parse::<u64>().ok()).unwrap_or(0);
                branches.push(json!({ "name": name, "ahead": ahead, "hasUpstream": false }));
            }
        }
        out.push(json!({ "repo": base_name(root), "status": status.stdout, "branches": branches }));
    }
    out
}

/// How a chat's folder stands for the nudge to commit: files changed, and when the last commit was (seconds; 0 for none).
pub fn git_state(cwd: &str) -> Option<Value> {
    let root = Path::new(cwd);
    let status = git(root, &["--no-optional-locks", "status", "--porcelain=v1"])?;
    let last = git(root, &["log", "-1", "--format=%ct"]).and_then(|o| o.stdout.trim().parse::<u64>().ok()).unwrap_or(0);
    let top = git(root, &["rev-parse", "--show-toplevel"]).map(|o| o.stdout.trim().to_owned()).unwrap_or_default();
    Some(json!({ "root": top, "changed": status.stdout.lines().filter(|l| !l.is_empty()).count(), "lastCommit": last }))
}

// ---------- GitHub ----------

/// Whether a GraphQL query only reads: the pull request box asks, it never changes anything on GitHub.
pub fn only_reads(query: &str) -> bool {
    let q = query.trim_start().to_ascii_lowercase();
    q.starts_with("query") && !q.contains("mutation") && !q.contains("subscription")
}

fn told(out: Option<Out>) -> Value {
    match out {
        Some(o) => json!({ "code": o.code, "stdout": o.stdout, "stderr": o.stderr.chars().take(2000).collect::<String>() }),
        None => Value::Null,
    }
}

/// The pull requests waiting on the person: one read-only GraphQL call of their own gh, with the variables it names.
pub fn prs(query: &str, vars: &[(String, String)]) -> Value {
    if !only_reads(query) || vars.iter().any(|(k, _)| !k.chars().all(|c| c.is_ascii_alphanumeric())) {
        return Value::Null;
    }
    let query_arg = format!("query={query}");
    let pairs: Vec<String> = vars.iter().map(|(k, v)| format!("{k}={v}")).collect();
    let mut args = vec!["api", "graphql", "-f", query_arg.as_str()];
    for pair in &pairs {
        args.extend_from_slice(&["-f", pair.as_str()]);
    }
    told(run("gh", &args, None, Duration::from_secs(15)))
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

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(recent_roots(&text, now), vec!["/w/api".to_owned()]);
        assert!(recent_roots("{ half", now).is_empty());
        let next: Value = serde_json::from_str(&with_root(&text, "/w/web", now)).unwrap();
        // Two weeks for the stand-up, a month before it is forgotten.
        assert_eq!(next.as_object().unwrap().keys().cloned().collect::<Vec<_>>(), vec!["/w/api", "/w/old", "/w/web"]);
        assert_eq!(next["/w/web"], json!(now as u64));
        assert_eq!(with_root("not json", "/w/a", now), format!("{{\"/w/a\":{}}}\n", now as u64));
    }

    #[test]
    fn the_pull_request_box_only_reads() {
        assert!(only_reads("query($review:String!){ search(query:$review) { issueCount } }"));
        assert!(!only_reads("mutation { addStar(input:{}) { clientMutationId } }"));
        assert!(!only_reads("query { a } mutation { b }"));
        assert!(prs("mutation { x }", &[]).is_null());
        assert!(prs("query { x }", &[("a b".into(), "c".into())]).is_null());
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

    #[test]
    fn a_name_is_the_last_part_of_a_path() {
        assert_eq!(base_name("/w/api/"), "api");
        assert_eq!(base_name("C:\\w\\web"), "web");
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
    fn the_commits_of_a_repository_are_read_for_the_stand_up() {
        let dir = std::env::temp_dir().join(format!("mochi-work-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let sh = |cmd: &str| assert_eq!(run("sh", &["-c", cmd], Some(&dir), Duration::from_secs(10)).unwrap().code, 0, "{cmd}");
        sh("git init -q && git config user.email a@b.c && git config user.name A && echo x > f && git add f && git commit -qm 'First thing' && echo y > g");
        let root = dir.to_str().unwrap().to_owned();
        let lines = commits(std::slice::from_ref(&root), 0);
        assert_eq!(lines.len(), 1);
        assert!(lines[0].ends_with("\tFirst thing"), "{}", lines[0]);
        let state = git_state(&root).unwrap();
        assert_eq!(state["changed"], 1);
        assert!(state["lastCommit"].as_u64().unwrap() > 0);
        let desk = desks(&[root]);
        assert!(desk[0]["status"].as_str().unwrap().contains("?? g"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
