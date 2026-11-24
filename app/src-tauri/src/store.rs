//! Mochi's files: the folder the mod writes too (~/.claude/mochi). Every file has one writer;
//! what the app writes it writes whole, and it never writes over a chat another Mochi writes.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

/// A chat's file older than this is one the chat left behind; the mod skips it at the same age.
pub const FRESH: Duration = Duration::from_secs(60);
/// More chats than anyone runs; a bound on what one read hands the window.
const MOST: usize = 64;
/// A chat's days, years of them, stay far under this; more is not a days file.
const MOST_DAYS_BYTES: usize = 512_000;

/// The person's home folder, as the mod and Codex take it: on Windows the user profile, which a Unix shell's HOME may not be.
pub fn home_dir() -> Option<PathBuf> {
    let var = |name: &str| std::env::var_os(name).filter(|v| !v.is_empty());
    let home = if cfg!(windows) { var("USERPROFILE").or_else(|| var("HOME")) } else { var("HOME").or_else(|| var("USERPROFILE")) };
    home.map(PathBuf::from)
}

/// Where Mochi keeps its files, the same folder the mod writes: ~/.claude/mochi.
pub fn data_dir() -> Option<PathBuf> {
    Some(home_dir()?.join(".claude").join("mochi"))
}

pub fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

pub fn is_fresh(path: &Path) -> bool {
    fs::metadata(path).and_then(|m| m.modified()).ok().and_then(|at| at.elapsed().ok()).is_some_and(|age| age < FRESH)
}

/// Writes a file whole: beside it first, then over it, so nobody reads half of one.
pub fn write_whole(path: &Path, text: &str) -> bool {
    let tmp = path.with_extension("tmp");
    path.parent().is_some_and(|dir| fs::create_dir_all(dir).is_ok()) && fs::write(&tmp, text).is_ok() && fs::rename(&tmp, path).is_ok()
}

/// Writes another program's file whole, as `write_whole` does, and leaves it the file it was:
/// a link stays a link (what it points to is written), and who may read it stays as it was.
pub fn write_theirs(path: &Path, text: &str) -> bool {
    let real = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let tmp = real.with_extension("tmp");
    let kept = fs::metadata(&real).map(|m| m.permissions()).ok();
    if !(real.parent().is_some_and(|dir| fs::create_dir_all(dir).is_ok()) && fs::write(&tmp, text).is_ok()) {
        return false;
    }
    if let Some(permissions) = kept {
        let _ = fs::set_permissions(&tmp, permissions);
    }
    fs::rename(&tmp, &real).is_ok()
}

/// A chat's name as a file's: letters, digits, `-` and `_`, so it can never point out of its folder.
pub fn is_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 140 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

// ---------- the chats ----------

/// Whether a chat's file is one the app wrote: it says so in `by`. The mod's own files say nothing.
fn is_ours(text: &str) -> bool {
    serde_json::from_str::<Value>(text).is_ok_and(|v| v["by"] == "app")
}

/// The text of every chat's file another Mochi wrote within FRESH, in the order of their names.
pub fn others_files(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    let mut paths: Vec<PathBuf> = entries.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json") && is_fresh(p)).collect();
    paths.sort();
    paths.into_iter().filter_map(|p| fs::read_to_string(p).ok()).filter(|t| !is_ours(t)).take(MOST).collect()
}

/// Whether another Mochi writes this chat now: its file is fresh and not the app's own.
pub fn is_theirs(live: &Path, id: &str) -> bool {
    let path = live.join(format!("{id}.json"));
    is_id(id) && is_fresh(&path) && fs::read_to_string(&path).is_ok_and(|text| !is_ours(&text))
}

/// What became of a chat the app meant to write.
#[derive(Debug, PartialEq)]
pub enum Wrote {
    Ours,
    /// Another Mochi writes this chat itself: the app leaves the file, and the chat, to it.
    Theirs,
    Failed,
}

/// Writes a chat the app follows, as the mod writes its own, marked as the app's and stamped `at`.
pub fn write_own(dir: &Path, id: &str, peer: &Value, at: u128) -> Wrote {
    if !is_id(id) || !peer.is_object() {
        return Wrote::Failed;
    }
    let path = dir.join(format!("{id}.json"));
    if is_theirs(dir, id) {
        return Wrote::Theirs;
    }
    let mut peer = peer.clone();
    peer["by"] = json!("app");
    peer["at"] = json!(at as u64);
    if write_whole(&path, &peer.to_string()) { Wrote::Ours } else { Wrote::Failed }
}

/// Takes a chat's file away, if it is the app's own.
pub fn remove_own(dir: &Path, id: &str) {
    let path = dir.join(format!("{id}.json"));
    if is_id(id) && fs::read_to_string(&path).is_ok_and(|text| is_ours(&text)) {
        let _ = fs::remove_file(path);
    }
}

/// The chats the app writes now, by id, as the window last gave them.
static OWN: Mutex<BTreeMap<String, Value>> = Mutex::new(BTreeMap::new());

/// Takes the chats the app follows as they stand now and writes each; the ones gone since last time are taken away.
/// Says which of them another Mochi writes itself.
pub fn keep_own(dir: &Path, peers: Vec<Value>, at: u128) -> Vec<String> {
    let mut own = OWN.lock().unwrap_or_else(|e| e.into_inner());
    let mut next = BTreeMap::new();
    let mut theirs = Vec::new();
    for peer in peers {
        let Some(id) = peer["id"].as_str().map(str::to_owned) else { continue };
        match write_own(dir, &id, &peer, at) {
            Wrote::Ours => drop(next.insert(id, peer)),
            Wrote::Theirs => theirs.push(id),
            Wrote::Failed => {}
        }
    }
    for id in own.keys().filter(|id| !next.contains_key(*id)) {
        remove_own(dir, id);
    }
    *own = next;
    theirs
}

/// Writes the app's chats again with the time now, as the mod does for its own: a file not written for a while is a closed chat.
pub fn beat_own(dir: &Path, at: u128) {
    let own = OWN.lock().unwrap_or_else(|e| e.into_inner());
    for (id, peer) in own.iter() {
        write_own(dir, id, peer, at);
    }
}

/// On the way out: the app's chats are closed with it.
pub fn forget_own(dir: &Path) {
    let mut own = OWN.lock().unwrap_or_else(|e| e.into_inner());
    for id in own.keys() {
        remove_own(dir, id);
    }
    own.clear();
}

// ---------- a chat's days ----------

pub fn read_days(dir: &Path, id: &str) -> Option<String> {
    if !is_id(id) {
        return None;
    }
    fs::read_to_string(dir.join(format!("{id}.json"))).ok().filter(|t| t.len() <= MOST_DAYS_BYTES)
}

/// Keeps a chat's days as the window counted them. Only a days file is written, only under the chat's own name,
/// and never for a chat another Mochi writes (`live` is where the chats' own files are): that Mochi counts it.
pub fn write_days(dir: &Path, live: &Path, id: &str, text: &str) -> bool {
    let is_days = text.len() <= MOST_DAYS_BYTES && serde_json::from_str::<Value>(text).is_ok_and(|v| v["id"] == id && v["days"].is_object());
    is_id(id) && is_days && !is_theirs(live, id) && write_whole(&dir.join(format!("{id}.json")), text)
}

/// Every chat's days, as the text of their files: what every Mochi adds into the one history. More files than this is years of chats.
pub fn all_days(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .take(20_000)
        .filter_map(|p| fs::read_to_string(p).ok())
        .filter(|t| t.len() <= MOST_DAYS_BYTES)
        .collect()
}

// ---------- the days a sync copies ----------

/// One days file as a sync sees it: its name, when it was last written (ms since the epoch) and its size.
pub struct Entry {
    pub name: String,
    pub mtime: u64,
    pub size: u64,
}

/// A days file's name: a chat's name as a file's (up to 140 characters), then exactly `.json`. Checked here too, because the window sends the names.
pub fn is_days_file(name: &str) -> bool {
    name.strip_suffix(".json").is_some_and(is_id)
}

/// A time as milliseconds since the epoch, 0 before it.
fn epoch_ms(at: SystemTime) -> u64 {
    at.duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

/// The days files in a folder that a sync may copy; a folder that is not there has none.
pub fn list_days_in(dir: &Path) -> Vec<Entry> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().into_string().ok().filter(|n| is_days_file(n))?;
            let meta = e.metadata().ok().filter(|m| m.is_file())?;
            Some(Entry { name, mtime: meta.modified().map_or(0, epoch_ms), size: meta.len() })
        })
        .collect()
}

/// Copies one file whole, its modified time with it: beside the target first, then over it, so nobody reads half of one.
fn copy_file(src: &Path, dst: &Path, tmp: &Path, at: SystemTime) -> bool {
    let copy = || -> std::io::Result<()> {
        let mut from = fs::File::open(src)?;
        let mut to = fs::File::create(tmp)?;
        std::io::copy(&mut from, &mut to)?;
        to.set_modified(at)?;
        drop(to);
        fs::rename(tmp, dst)
    };
    let done = copy().is_ok();
    if !done {
        let _ = fs::remove_file(tmp);
    }
    done
}

/// Copies the named days files that are non-empty regular files in `from` into `to`, creating `to`; a file already there
/// with the same size and time is left alone, and a file already there that is NEWER than the source is never written over.
/// Nothing is removed but the copy's own temporary file. Says how many it copied.
pub fn copy_days_between(from: &Path, to: &Path, names: &[String]) -> u32 {
    if fs::create_dir_all(to).is_err() {
        return 0;
    }
    let mut copied = 0;
    for name in names.iter().filter(|n| is_days_file(n.as_str())) {
        let src = from.join(name);
        let Some(meta) = fs::symlink_metadata(&src).ok().filter(|m| m.is_file() && m.len() > 0) else { continue };
        let Ok(at) = meta.modified() else { continue };
        let dst = to.join(name);
        let dst_meta = fs::metadata(&dst).ok();
        let dst_ms = dst_meta.as_ref().map_or(0, |d| d.modified().map_or(0, epoch_ms));
        if dst_ms > epoch_ms(at) || dst_meta.is_some_and(|d| d.len() == meta.len() && dst_ms == epoch_ms(at)) {
            continue;
        }
        if copy_file(&src, &dst, &to.join(format!(".{name}.tmp")), at) {
            copied += 1;
        }
    }
    copied
}

// ---------- what every Mochi remembers together ----------

/// The files any Mochi may write: what was last celebrated (so it is celebrated once), the badges won, and what the person
/// last chose to wear, in whichever Mochi they chose it.
const SHARED: [&str; 3] = ["level.json", "badges.json", "prefs.json"];

/// The news every Mochi may see at once, said by one: a level or a wardrobe that grew, badges won.
const CLAIMS: [&str; 2] = ["said-level", "said-badges"];

/// Who holds a claim for `at`, as the mod reads it: the same `at` with this id is mine, with another is theirs, anything else is free.
fn claim_of(text: Option<&str>, at: u64, id: &str) -> &'static str {
    let Some(v) = text.and_then(|t| serde_json::from_str::<Value>(t).ok()) else { return "free" };
    match (v["at"].as_u64(), v["id"].as_str()) {
        (Some(held), Some(holder)) if held == at => if holder == id { "mine" } else { "theirs" },
        _ => "free",
    }
}

/// Whether this Mochi says the news `at` (a number naming it): a claim already there stands; Mochis that find none all write
/// theirs, and the one read back a moment later wins. The mod claims the same way, under the same names.
pub fn claim(dir: &Path, name: &str, at: u64, id: &str, settle: Duration) -> bool {
    if !CLAIMS.contains(&name) {
        return false;
    }
    let path = dir.join(format!("{name}.json"));
    let holder = || claim_of(fs::read_to_string(&path).ok().as_deref(), at, id);
    match holder() {
        "free" => {}
        found => return found == "mine",
    }
    let _ = write_whole(&path, &json!({ "at": at, "id": id }).to_string());
    std::thread::sleep(settle);
    holder() == "mine"
}

/// One of the shared files: Ok(None) when there is none yet, Err when it is there but cannot be read now (locked, too big),
/// so that nothing is written over it as if it were new.
pub fn read_shared(dir: &Path, name: &str) -> Result<Option<String>, String> {
    // repos.json is read too (the Work tab ties worktrees to their repository), never written here: it has its own writer.
    if !SHARED.contains(&name) && name != "repos.json" {
        return Err(format!("{name} is not shared"));
    }
    match fs::read_to_string(dir.join(name)) {
        Ok(text) if text.len() < 64_000 => Ok(Some(text)),
        Ok(_) => Err(format!("{name} is too big")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes one of the shared files, whole. Only those, and only what reads as JSON: a file caught half-read is never written back shorter.
/// The badges are only added to: one won by the mod since the app read the list stays, ahead of the app's new ones.
pub fn write_shared(dir: &Path, name: &str, text: &str) -> bool {
    let Some(mut next) = (SHARED.contains(&name) && text.len() < 64_000).then(|| serde_json::from_str::<Value>(text).ok()).flatten() else { return false };
    if name == "badges.json" {
        let on_disk = fs::read_to_string(dir.join(name)).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok());
        if let (Some(Value::Array(mut had)), Value::Array(won)) = (on_disk, &next) {
            for badge in won {
                if !had.contains(badge) {
                    had.push(badge.clone());
                }
            }
            next = Value::Array(had);
        }
    }
    write_whole(&dir.join(name), &next.to_string())
}

// ---------- what went wrong ----------

/// Adds a line to the app's own log (app.log): a crash, or an error in the window. Kept to its last 64 KB, so it never grows.
pub fn log(dir: &Path, text: &str) {
    let path = dir.join("app.log");
    let was = fs::read_to_string(&path).unwrap_or_default();
    let line = format!("{} {}\n", now_ms(), text.replace('\n', " ").chars().take(2000).collect::<String>());
    let mut all = was + &line;
    if all.len() > 64_000 {
        // From the first whole line in the last 48 KB: a line break is one byte, never inside a letter.
        let cut = all.len() - 48_000;
        let from = all.as_bytes()[cut..].iter().position(|&b| b == b'\n').map_or(all.len(), |i| cut + i + 1);
        all = all[from..].to_owned();
    }
    let _ = write_whole(&path, &all);
}

// ---------- the look, and the app's own beat ----------

/// The person's look as the mod last wrote it, for this Mochi to wear the same; None before there is one.
pub fn read_look(dir: &Path) -> Option<String> {
    fs::read_to_string(dir.join("look.json")).ok().filter(|t| t.len() < 64_000)
}

/// What the app says of itself in app.json: when, whether its Mochi is on screen, and for how many seconds
/// it will take a request for permission in its bubble (0 when the person has not asked for that).
pub fn beat_text(at_ms: u128, is_shown: bool, approve_s: u64, shield: bool) -> String {
    json!({ "v": 1, "at": at_ms as u64, "isShown": is_shown, "version": env!("CARGO_PKG_VERSION"), "approve": approve_s, "shield": shield }).to_string()
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mochi-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn only_another_mochis_json_files_are_read() {
        let dir = scratch("live");
        fs::write(dir.join("b.json"), "{\"id\":\"b\"}").unwrap();
        fs::write(dir.join("a.json"), "{\"id\":\"a\"}").unwrap();
        fs::write(dir.join("mine.json"), "{\"id\":\"mine\",\"by\":\"app\"}").unwrap();
        fs::write(dir.join("a.tmp"), "half").unwrap();
        fs::write(dir.join("notes.txt"), "no").unwrap();
        assert_eq!(others_files(&dir), vec!["{\"id\":\"a\"}".to_string(), "{\"id\":\"b\"}".to_string()]);
        assert!(others_files(&dir.join("missing")).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_file_is_written_whole_and_leaves_no_half_beside_it() {
        let dir = scratch("whole");
        assert!(write_whole(&dir.join("deep").join("app.json"), "{}"));
        assert_eq!(fs::read_to_string(dir.join("deep").join("app.json")).unwrap(), "{}");
        assert!(!dir.join("deep").join("app.tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_beat_says_when_and_whether_mochi_is_on_screen() {
        let v: Value = serde_json::from_str(&beat_text(1_760_000_000_000, true, 30, true)).unwrap();
        assert_eq!(v["at"], 1_760_000_000_000u64);
        assert_eq!(v["isShown"], true);
        assert_eq!(v["v"], 1);
        assert_eq!(v["approve"], 30);
        assert!(beat_text(1, false, 0, false).contains("\"isShown\":false"));
    }

    #[test]
    fn a_chat_the_app_follows_is_written_as_its_own_and_stamped() {
        let dir = scratch("own");
        assert_eq!(write_own(&dir, "codex-s1", &json!({ "id": "codex-s1", "state": "busy", "at": 1 }), 5000), Wrote::Ours);
        let v: Value = serde_json::from_str(&fs::read_to_string(dir.join("codex-s1.json")).unwrap()).unwrap();
        assert_eq!(v["by"], "app");
        assert_eq!(v["at"], 5000);
        assert_eq!(v["state"], "busy");
        // Written again over its own file, as every beat does.
        assert_eq!(write_own(&dir, "codex-s1", &json!({ "id": "codex-s1", "state": "idle" }), 6000), Wrote::Ours);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_chat_the_mod_writes_is_never_written_over_or_taken_away() {
        let dir = scratch("theirs");
        let mods = "{\"id\":\"s1\",\"state\":\"busy\",\"v\":2}";
        fs::write(dir.join("s1.json"), mods).unwrap();
        assert_eq!(write_own(&dir, "s1", &json!({ "id": "s1", "state": "idle" }), 5000), Wrote::Theirs);
        remove_own(&dir, "s1");
        assert_eq!(fs::read_to_string(dir.join("s1.json")).unwrap(), mods);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_name_that_could_leave_the_folder_is_no_chat() {
        let dir = scratch("names");
        for bad in ["", "../x", "a/b", "a\\b", "a.b", "a:b", &"x".repeat(141)] {
            assert!(!is_id(bad), "{bad}");
            assert_eq!(write_own(&dir, bad, &json!({ "id": bad }), 1), Wrote::Failed);
            assert!(!write_days(&dir, &dir.join("live"), bad, &json!({ "id": bad, "days": {} }).to_string()));
        }
        assert!(is_id("codex-019a_B"));
        assert!(fs::read_dir(&dir).unwrap().next().is_none());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_apps_chats_are_kept_while_followed_and_taken_away_after() {
        let dir = scratch("keep");
        fs::write(dir.join("s9.json"), "{\"id\":\"s9\"}").unwrap();
        let theirs = keep_own(&dir, vec![json!({ "id": "codex-a" }), json!({ "id": "codex-b" }), json!({ "id": "s9" }), json!({ "no": "id" })], 1000);
        assert_eq!(theirs, vec!["s9".to_string()]);
        assert!(dir.join("codex-a.json").exists() && dir.join("codex-b.json").exists());
        beat_own(&dir, 2000);
        assert!(fs::read_to_string(dir.join("codex-a.json")).unwrap().contains("\"at\":2000"));
        // One chat ended: its file goes, the other's and the mod's stay.
        keep_own(&dir, vec![json!({ "id": "codex-b" })], 3000);
        assert!(!dir.join("codex-a.json").exists());
        assert!(dir.join("codex-b.json").exists() && dir.join("s9.json").exists());
        forget_own(&dir);
        assert!(!dir.join("codex-b.json").exists() && dir.join("s9.json").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_chats_days_are_kept_under_its_own_name_only() {
        let dir = scratch("days");
        let text = json!({ "id": "codex-a", "label": "shop", "days": { "2026-11-23": { "turns": 2 } } }).to_string();
        let live = dir.join("live");
        assert!(read_days(&dir, "codex-a").is_none());
        assert!(write_days(&dir, &live, "codex-a", &text));
        assert_eq!(read_days(&dir, "codex-a").unwrap(), text);
        // Another chat's days, or something that is not days, is not written.
        assert!(!write_days(&dir, &live, "codex-b", &text));
        assert!(!write_days(&dir, &live, "codex-a", "{\"id\":\"codex-a\"}"));
        assert!(!write_days(&dir, &live, "codex-a", "not json"));
        assert_eq!(read_days(&dir, "codex-a").unwrap(), text);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn every_chats_days_are_read_and_only_the_shared_files_are_written() {
        let dir = scratch("shared");
        let days = dir.join("days");
        fs::create_dir_all(&days).unwrap();
        fs::write(days.join("a.json"), "{\"id\":\"a\",\"days\":{}}").unwrap();
        fs::write(days.join("b.json"), "{\"id\":\"b\",\"days\":{}}").unwrap();
        fs::write(days.join("b.tmp"), "half").unwrap();
        assert_eq!(all_days(&days).len(), 2);
        assert!(all_days(&dir.join("missing")).is_empty());

        assert_eq!(read_shared(&dir, "level.json"), Ok(None));
        assert!(write_shared(&dir, "level.json", "{\"level\":3,\"items\":[]}"));
        assert_eq!(read_shared(&dir, "level.json"), Ok(Some("{\"level\":3,\"items\":[]}".into())));
        assert!(write_shared(&dir, "badges.json", "[\"owl\"]"));
        // No other file, and nothing that is not JSON.
        assert!(!write_shared(&dir, "look.json", "{}"));
        assert!(!write_shared(&dir, "../level.json", "{}"));
        assert!(!write_shared(&dir, "level.json", "{ half"));
        assert!(read_shared(&dir, "app.json").is_err());
        assert_eq!(read_shared(&dir, "level.json"), Ok(Some("{\"level\":3,\"items\":[]}".into())));
        // The repositories Mochi saw are read for the Work tab, never written from here: they have their own writer.
        fs::write(dir.join("repos.json"), "{\"/w/shop\":1}").unwrap();
        assert_eq!(read_shared(&dir, "repos.json"), Ok(Some("{\"/w/shop\":1}".into())));
        assert!(!write_shared(&dir, "repos.json", "{}"));
        // A badge won elsewhere since the list was read is kept: the list is only added to.
        fs::write(dir.join("badges.json"), "[\"owl\",\"rocket\"]").unwrap();
        assert!(write_shared(&dir, "badges.json", "[\"owl\",\"green\"]"));
        assert_eq!(fs::read_to_string(dir.join("badges.json")).unwrap(), "[\"owl\",\"rocket\",\"green\"]");
        // A file that is there but cannot be read is not the same as none: the caller must not write over it.
        fs::write(dir.join("level.json"), "x".repeat(70_000)).unwrap();
        assert!(read_shared(&dir, "level.json").is_err());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_log_keeps_its_last_lines_only() {
        let dir = scratch("log");
        log(&dir, "first\nline");
        assert!(fs::read_to_string(dir.join("app.log")).unwrap().ends_with(" first line\n"));
        for _ in 0..100 {
            log(&dir, &"x".repeat(1500));
        }
        let text = fs::read_to_string(dir.join("app.log")).unwrap();
        assert!(text.len() <= 64_000 && !text.contains("first"));
        assert!(text.lines().all(|l| l.ends_with('x')));
        // Letters of more than one byte, wherever the cut falls: never cut inside one.
        for n in 0..60 {
            log(&dir, &format!("{}{}", "ş".repeat(997 + n), "ğ"));
        }
        let text = fs::read_to_string(dir.join("app.log")).unwrap();
        assert!(text.len() <= 64_000 && text.lines().all(|l| l.ends_with('ğ') || l.ends_with('x')));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn news_every_mochi_sees_is_said_by_one() {
        let dir = scratch("claims");
        let zero = Duration::ZERO;
        assert!(claim(&dir, "said-level", 5003, "app", zero));
        // The mod's chat that comes later finds the app's claim for the same news, and lets it be.
        assert!(!claim(&dir, "said-level", 5003, "s1", zero));
        assert!(claim(&dir, "said-level", 5003, "app", zero));
        // Newer news is free again.
        assert!(claim(&dir, "said-level", 6003, "s1", zero));
        assert_eq!(fs::read_to_string(dir.join("said-level.json")).unwrap(), "{\"at\":6003,\"id\":\"s1\"}");
        assert!(!claim(&dir, "level", 1, "app", zero));
        assert!(!claim(&dir, "../said-level", 1, "app", zero));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_chat_the_mod_writes_is_the_mods_to_count() {
        let dir = scratch("counted");
        let live = dir.join("live");
        fs::create_dir_all(&live).unwrap();
        let days = |id: &str| json!({ "id": id, "label": "api", "days": { "2026-11-23": { "turns": 1 } } }).to_string();
        // The mod's own file of the chat is there: what the app counted of it is not written.
        fs::write(live.join("s1.json"), "{\"id\":\"s1\",\"v\":2}").unwrap();
        assert!(!write_days(&dir, &live, "s1", &days("s1")));
        assert!(read_days(&dir, "s1").is_none());
        // A chat the app itself writes is the app's to count.
        fs::write(live.join("s2.json"), "{\"id\":\"s2\",\"by\":\"app\"}").unwrap();
        assert!(write_days(&dir, &live, "s2", &days("s2")));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn another_programs_file_stays_the_file_it_was() {
        let dir = scratch("theirfile");
        let path = dir.join("settings.json");
        assert!(write_theirs(&path, "{}"));
        assert_eq!(fs::read_to_string(&path).unwrap(), "{}");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            // Private to the person stays private.
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
            assert!(write_theirs(&path, "{\"a\":1}"));
            assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
            // A link to a file kept elsewhere stays a link, and the file it points to is the one written.
            let kept = dir.join("dotfiles");
            fs::create_dir_all(&kept).unwrap();
            fs::write(kept.join("real.json"), "{}").unwrap();
            let link = dir.join("linked.json");
            std::os::unix::fs::symlink(kept.join("real.json"), &link).unwrap();
            assert!(write_theirs(&link, "{\"b\":2}"));
            assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
            assert_eq!(fs::read_to_string(kept.join("real.json")).unwrap(), "{\"b\":2}");
        }
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_days_file_name_is_letters_digits_dash_and_underscore_then_json() {
        assert!(is_days_file("codex-019a_B.json"));
        assert!(is_days_file(&format!("{}.json", "x".repeat(140))));
        for bad in ["", ".json", "../x.json", "a/b.json", "a\\b.json", "a.b.json", "a.txt", "x.json.exe", &format!("{}.json", "x".repeat(141))] {
            assert!(!is_days_file(bad), "{bad}");
        }
    }

    #[test]
    fn the_days_listed_are_the_days_files_and_nothing_else() {
        let dir = scratch("list-days");
        fs::write(dir.join("a.json"), "{}").unwrap();
        fs::write(dir.join("b.txt"), "no").unwrap();
        fs::write(dir.join("c.d.json"), "no").unwrap();
        fs::create_dir(dir.join("e.json")).unwrap();
        let listed = list_days_in(&dir);
        assert_eq!(listed.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), ["a.json"]);
        assert_eq!(listed[0].size, 2);
        assert!(list_days_in(&dir.join("missing")).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_copy_keeps_content_and_time_and_removes_nothing() {
        let root = scratch("copy-days");
        let (from, to) = (root.join("from"), root.join("to"));
        fs::create_dir_all(&from).unwrap();
        fs::write(from.join("a.json"), "{\"id\":\"a\"}").unwrap();
        fs::write(from.join("empty.json"), "").unwrap();
        fs::write(from.join("keep.txt"), "no").unwrap();
        let at = UNIX_EPOCH + Duration::from_secs(1_700_000_000);
        fs::File::options().write(true).open(from.join("a.json")).unwrap().set_modified(at).unwrap();
        let names: Vec<String> = vec!["a.json".into(), "empty.json".into(), "keep.txt".into(), "../from/a.json".into(), "missing.json".into()];
        // Only a.json: the empty file, the other extension, the path that leaves the folder and the missing one are refused.
        assert_eq!(copy_days_between(&from, &to, &names), 1);
        let stamp = |dir: &Path| list_days_in(dir).into_iter().find(|e| e.name == "a.json").map(|e| (e.mtime, e.size));
        assert_eq!(fs::read_to_string(to.join("a.json")).unwrap(), "{\"id\":\"a\"}");
        assert_eq!(stamp(&to), stamp(&from));
        assert_eq!(stamp(&to), Some((1_700_000_000_000, 10)));
        assert_eq!(list_days_in(&to).iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), ["a.json"]);
        // Identical again: nothing is copied.
        assert_eq!(copy_days_between(&from, &to, &names), 0);
        assert!(from.join("a.json").exists() && from.join("empty.json").exists() && from.join("keep.txt").exists());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn a_newer_file_already_there_is_never_written_over() {
        let root = scratch("copy-newer");
        let (from, to) = (root.join("from"), root.join("to"));
        fs::create_dir_all(&from).unwrap();
        fs::create_dir_all(&to).unwrap();
        fs::write(from.join("a.json"), "old").unwrap();
        fs::write(to.join("a.json"), "new").unwrap();
        let at = UNIX_EPOCH + Duration::from_secs(1_700_000_000);
        fs::File::options().write(true).open(from.join("a.json")).unwrap().set_modified(at).unwrap();
        fs::File::options().write(true).open(to.join("a.json")).unwrap().set_modified(at + Duration::from_secs(60)).unwrap();
        assert_eq!(copy_days_between(&from, &to, &["a.json".into()]), 0);
        assert_eq!(fs::read_to_string(to.join("a.json")).unwrap(), "new");
        fs::remove_dir_all(&root).unwrap();
    }
}
