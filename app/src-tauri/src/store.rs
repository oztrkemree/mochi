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

// ---------- what every Mochi remembers together ----------

/// The files any Mochi may write: what was last celebrated (so it is celebrated once), and the badges won.
const SHARED: [&str; 2] = ["level.json", "badges.json"];

pub fn read_shared(dir: &Path, name: &str) -> Option<String> {
    if !SHARED.contains(&name) {
        return None;
    }
    fs::read_to_string(dir.join(name)).ok().filter(|t| t.len() < 64_000)
}

/// Writes one of the shared files, whole. Only those, and only what reads as JSON: a file caught half-read is never written back shorter.
pub fn write_shared(dir: &Path, name: &str, text: &str) -> bool {
    SHARED.contains(&name) && text.len() < 64_000 && serde_json::from_str::<Value>(text).is_ok() && write_whole(&dir.join(name), text)
}

// ---------- the look, and the app's own beat ----------

/// The person's look as the mod last wrote it, for this Mochi to wear the same; None before there is one.
pub fn read_look(dir: &Path) -> Option<String> {
    fs::read_to_string(dir.join("look.json")).ok().filter(|t| t.len() < 64_000)
}

/// What the app says of itself in app.json: when, whether its Mochi is on screen, and for how many seconds
/// it will take a request for permission in its bubble (0 when the person has not asked for that).
pub fn beat_text(at_ms: u128, is_shown: bool, approve_s: u64) -> String {
    json!({ "v": 1, "at": at_ms as u64, "isShown": is_shown, "version": env!("CARGO_PKG_VERSION"), "approve": approve_s }).to_string()
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
        let v: Value = serde_json::from_str(&beat_text(1_760_000_000_000, true, 30)).unwrap();
        assert_eq!(v["at"], 1_760_000_000_000u64);
        assert_eq!(v["isShown"], true);
        assert_eq!(v["v"], 1);
        assert_eq!(v["approve"], 30);
        assert!(beat_text(1, false, 0).contains("\"isShown\":false"));
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

        assert!(read_shared(&dir, "level.json").is_none());
        assert!(write_shared(&dir, "level.json", "{\"level\":3,\"items\":[]}"));
        assert_eq!(read_shared(&dir, "level.json").unwrap(), "{\"level\":3,\"items\":[]}");
        assert!(write_shared(&dir, "badges.json", "[\"owl\"]"));
        // No other file, and nothing that is not JSON.
        assert!(!write_shared(&dir, "look.json", "{}"));
        assert!(!write_shared(&dir, "../level.json", "{}"));
        assert!(!write_shared(&dir, "level.json", "{ half"));
        assert!(read_shared(&dir, "app.json").is_none());
        assert_eq!(read_shared(&dir, "level.json").unwrap(), "{\"level\":3,\"items\":[]}");
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
}
