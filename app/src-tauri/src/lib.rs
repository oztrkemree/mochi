use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent};

/// A chat's file older than this is one the chat left behind; the mod skips it at the same age.
const FRESH: Duration = Duration::from_secs(60);
/// How often the app says it is here; the mod takes a silence of 45 seconds as gone.
const BEAT: Duration = Duration::from_secs(15);
/// More chats than anyone runs; a bound on what one read hands the window.
const MOST: usize = 64;
/// The hook calls one read takes from the inbox; the rest wait a second.
const MOST_CALLS: usize = 500;

/// Where Mochi keeps its files, the same folder the mod writes: ~/.claude/mochi.
fn data_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").filter(|h| !h.is_empty()).or_else(|| std::env::var_os("USERPROFILE"))?;
    Some(PathBuf::from(home).join(".claude").join("mochi"))
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

fn is_fresh(path: &Path) -> bool {
    fs::metadata(path).and_then(|m| m.modified()).ok().and_then(|at| at.elapsed().ok()).is_some_and(|age| age < FRESH)
}

/// Writes a file whole: beside it first, then over it, so nobody reads half of one.
fn write_whole(path: &Path, text: &str) -> bool {
    let tmp = path.with_extension("tmp");
    path.parent().is_some_and(|dir| fs::create_dir_all(dir).is_ok()) && fs::write(&tmp, text).is_ok() && fs::rename(&tmp, path).is_ok()
}

// ---------- the chats the mod writes ----------

/// The text of every chat's file written within FRESH, as the mod left it.
fn fresh_files(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "json") && is_fresh(p))
        .filter_map(|p| fs::read_to_string(p).ok())
        .take(MOST)
        .collect()
}

#[tauri::command]
fn read_live() -> Vec<String> {
    data_dir().map(|d| fresh_files(&d.join("live"))).unwrap_or_default()
}

// ---------- the app's own beat ----------

/// What the app says of itself in app.json: when, and whether its Mochi is on screen.
fn beat_text(at_ms: u128, is_shown: bool) -> String {
    json!({ "v": 1, "at": at_ms as u64, "isShown": is_shown, "version": env!("CARGO_PKG_VERSION") }).to_string()
}

fn is_shown(app: &AppHandle) -> bool {
    app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(false)
}

fn beat_now(app: &AppHandle) {
    if let Some(dir) = data_dir() {
        write_whole(&dir.join("app.json"), &beat_text(now_ms(), is_shown(app)));
    }
}

// ---------- agents that tell the app through their hooks ----------

/// Only what the window reads of a hook call, cut short: a prompt or a file's text is not left on disk for it.
fn kept(event: &Value) -> Value {
    let short = |v: &Value, max: usize| v.as_str().map(|s| Value::from(s.chars().take(max).collect::<String>()));
    let mut out = serde_json::Map::new();
    for (key, max) in [("hook_event_name", 40), ("session_id", 120), ("cwd", 400), ("tool_name", 80), ("prompt", 200), ("notification_type", 40), ("agent_id", 80), ("agent_type", 40)] {
        if let Some(v) = short(&event[key], max) {
            out.insert(key.into(), v);
        }
    }
    if let Some(command) = short(&event["tool_input"]["command"], 300) {
        out.insert("tool_input".into(), json!({ "command": command }));
    }
    Value::Object(out)
}

/// One hook call into the inbox, named so the calls sort by time; nothing for input that is not a call.
fn drop_in(dir: &Path, source: &str, input: &str, at: u128, pid: u32) -> Option<PathBuf> {
    let event: Value = serde_json::from_str(input).ok()?;
    if !event.is_object() {
        return None;
    }
    let path = dir.join(format!("{at:015}-{pid}.json"));
    write_whole(&path, &json!({ "source": source, "at": at as u64, "event": kept(&event) }).to_string()).then_some(path)
}

/// The `hook` command. It prints nothing and never fails: an agent's hook must not stand in the agent's way.
pub fn hook(source: &str) {
    let Some(dir) = data_dir() else { return };
    // With the app not running nobody empties the inbox, so nothing goes in.
    if !is_fresh(&dir.join("app.json")) {
        return;
    }
    let mut input = String::new();
    // A hook's input is small; the read stops well past any real one.
    if std::io::stdin().take(4_000_000).read_to_string(&mut input).is_ok() {
        drop_in(&dir.join("inbox"), source, &input, now_ms(), std::process::id());
    }
}

/// The calls waiting in the inbox, oldest first, each taken out as it is read.
fn taken(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    let mut files: Vec<PathBuf> = entries.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json")).collect();
    files.sort();
    files.truncate(MOST_CALLS);
    files
        .into_iter()
        .filter_map(|p| {
            let text = fs::read_to_string(&p).ok();
            let _ = fs::remove_file(&p);
            text
        })
        .collect()
}

#[tauri::command]
fn take_inbox() -> Vec<String> {
    data_dir().map(|d| taken(&d.join("inbox"))).unwrap_or_default()
}

// ---------- Codex's hooks ----------

/// The Codex events Mochi listens to, and whether Codex wants a matcher with them.
const CODEX_EVENTS: [(&str, bool); 10] = [
    ("SessionStart", false),
    ("SessionEnd", false),
    ("UserPromptSubmit", false),
    ("PreToolUse", true),
    ("PostToolUse", true),
    ("PermissionRequest", true),
    ("Stop", false),
    ("Interrupt", false),
    ("SubagentStart", false),
    ("SubagentStop", false),
];

/// How Mochi's own entries are told from anyone else's: they run the app's `hook codex`.
const OURS: &str = " hook codex";

/// What Codex runs. Codex trusts a hook by its text, so this must stay the same from one version of the app to the next.
fn codex_command(exe: &Path) -> String {
    format!("\"{}\"{OURS}", exe.display())
}

fn is_ours(group: &Value) -> bool {
    group["hooks"].as_array().is_some_and(|hooks| hooks.iter().any(|h| h["command"].as_str().is_some_and(|c| c.ends_with(OURS))))
}

fn is_connected(config: &Value) -> bool {
    config["hooks"].as_object().is_some_and(|events| events.values().any(|groups| groups.as_array().is_some_and(|g| g.iter().any(is_ours))))
}

/// The config without Mochi's entries; everyone else's stay as they are. None for a config that is not what Codex writes.
fn disconnected(mut config: Value) -> Option<Value> {
    let root = config.as_object_mut()?;
    let Some(hooks) = root.get_mut("hooks") else { return Some(config) };
    let events = hooks.as_object_mut()?;
    for groups in events.values_mut() {
        groups.as_array_mut()?.retain(|g| !is_ours(g));
    }
    events.retain(|_, groups| groups.as_array().is_some_and(|g| !g.is_empty()));
    Some(config)
}

/// The config with Mochi's entries, once each, after everyone else's.
fn connected(config: Value, command: &str) -> Option<Value> {
    let mut config = disconnected(config)?;
    let root = config.as_object_mut()?;
    let events = root.entry("hooks").or_insert_with(|| json!({})).as_object_mut()?;
    for (name, has_matcher) in CODEX_EVENTS {
        let mut group = json!({ "hooks": [{ "type": "command", "command": command, "timeout": 5 }] });
        if has_matcher {
            group["matcher"] = json!("*");
        }
        events.entry(name).or_insert_with(|| json!([])).as_array_mut()?.push(group);
    }
    Some(config)
}

fn codex_hooks_path() -> Option<PathBuf> {
    let home = std::env::var_os("CODEX_HOME").filter(|h| !h.is_empty()).map(PathBuf::from).or_else(|| {
        let home = std::env::var_os("HOME").filter(|h| !h.is_empty()).or_else(|| std::env::var_os("USERPROFILE"))?;
        Some(PathBuf::from(home).join(".codex"))
    })?;
    Some(home.join("hooks.json"))
}

/// Codex's hooks file as it stands: an empty config when there is none, None when it cannot be read as one.
fn codex_config(path: &Path) -> Option<Value> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).ok().filter(Value::is_object),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Some(json!({})),
        Err(_) => None,
    }
}

/// Adds or takes out Mochi's entries in Codex's hooks file. The file as it was is kept once beside it; a file this cannot read is left alone.
fn set_codex(path: &Path, exe: &Path, on: bool) -> bool {
    let Some(config) = codex_config(path) else { return false };
    let Some(next) = (if on { connected(config, &codex_command(exe)) } else { disconnected(config) }) else { return false };
    let backup = path.with_extension("json.mochi-backup");
    if path.exists() && !backup.exists() && fs::copy(path, &backup).is_err() {
        return false;
    }
    serde_json::to_string_pretty(&next).is_ok_and(|text| write_whole(path, &(text + "\n")))
}

fn codex_label(path: Option<&Path>) -> &'static str {
    match path.and_then(codex_config) {
        None => "Codex: its hooks file cannot be read",
        Some(config) if is_connected(&config) => "Disconnect Codex (in Codex, run /hooks once to approve)",
        Some(_) => "Connect Codex",
    }
}

// ---------- the window ----------

/// macOS keeps a window off the screen an app fills unless the window says it belongs there too.
#[cfg(target_os = "macos")]
fn stand_over_full_screen(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
    let Ok(pointer) = window.ns_window() else { return };
    // SAFETY: the pointer is Tauri's own live NSWindow, and this runs on the main thread.
    let ns_window: &NSWindow = unsafe { &*(pointer as *const NSWindow) };
    #[allow(unused_unsafe)]
    unsafe {
        ns_window.setCollectionBehavior(NSWindowCollectionBehavior::CanJoinAllSpaces | NSWindowCollectionBehavior::FullScreenAuxiliary | NSWindowCollectionBehavior::Stationary);
        // The status level (25), over the windows of an app that fills the screen.
        ns_window.setLevel(25);
        // A window keeps the spaces it had when it came to the screen: it comes again to take the new ones.
        ns_window.orderOut(None);
        ns_window.orderFrontRegardless();
    }
}

/// The window says its first drawing is on screen.
#[tauri::command]
fn shown(app: AppHandle) {
    #[cfg(target_os = "macos")]
    if let Some(window) = app.get_webview_window("main") {
        let same = window.clone();
        let _ = window.run_on_main_thread(move || stand_over_full_screen(&same));
    }
    // Said at once: the mod's Mochi steps aside now, not at the next beat.
    beat_now(&app);
}

/// What went wrong in the window, said where a person who starts the app from a terminal can read it.
#[tauri::command]
fn note(text: String) {
    eprintln!("mochi: {}", text.chars().take(400).collect::<String>());
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_live, take_inbox, note, shown])
        .setup(|app| {
            // A companion, not a window to switch to: no icon in the Dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let codex_path = codex_hooks_path();
            let toggle = MenuItemBuilder::with_id("toggle", "Show or hide Mochi").build(app)?;
            let codex = MenuItemBuilder::with_id("codex", codex_label(codex_path.as_deref())).build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Mochi").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&toggle, &codex]).separator().item(&quit).build()?;
            let mut tray = TrayIconBuilder::new().menu(&menu).tooltip("Mochi Buddy").on_menu_event(move |app, event| match event.id().as_ref() {
                "quit" => app.exit(0),
                "toggle" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = if is_shown(app) { window.hide() } else { window.show() };
                    }
                    // Said at once, so the mod's Mochi comes back or leaves without waiting for the next beat.
                    beat_now(app);
                }
                "codex" => {
                    if let (Some(path), Ok(exe)) = (codex_path.as_deref(), std::env::current_exe()) {
                        let on = !codex_config(path).is_some_and(|c| is_connected(&c));
                        set_codex(path, &exe, on);
                    }
                    let _ = codex.set_text(codex_label(codex_path.as_deref()));
                }
                _ => {}
            });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            let handle = app.handle().clone();
            thread::spawn(move || loop {
                beat_now(&handle);
                thread::sleep(BEAT);
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Mochi could not start")
        .run(|_app, event| {
            // Gone at once, not after the mod's 45 seconds of silence.
            if let RunEvent::Exit = event {
                if let Some(dir) = data_dir() {
                    let _ = fs::remove_file(dir.join("app.json"));
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mochi-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn only_json_files_are_read() {
        let dir = scratch("live");
        fs::write(dir.join("a.json"), "{\"id\":\"a\"}").unwrap();
        fs::write(dir.join("a.tmp"), "half").unwrap();
        fs::write(dir.join("notes.txt"), "no").unwrap();
        assert_eq!(fresh_files(&dir), vec!["{\"id\":\"a\"}".to_string()]);
        assert!(fresh_files(&dir.join("missing")).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_beat_says_when_and_whether_mochi_is_on_screen() {
        let v: Value = serde_json::from_str(&beat_text(1_760_000_000_000, true)).unwrap();
        assert_eq!(v["at"], 1_760_000_000_000u64);
        assert_eq!(v["isShown"], true);
        assert_eq!(v["v"], 1);
        assert!(beat_text(1, false).contains("\"isShown\":false"));
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
    fn hook_calls_wait_in_the_inbox_in_the_order_they_came_and_are_taken_once() {
        let dir = scratch("inbox");
        drop_in(&dir, "codex", r#"{"hook_event_name":"Stop","session_id":"s1"}"#, 2000, 7).unwrap();
        drop_in(&dir, "codex", r#"{"hook_event_name":"UserPromptSubmit","session_id":"s1","prompt":"hi"}"#, 1000, 9).unwrap();
        assert!(drop_in(&dir, "codex", "not a call", 3000, 1).is_none());
        assert!(drop_in(&dir, "codex", "[1]", 3000, 1).is_none());
        let calls: Vec<Value> = taken(&dir).iter().map(|t| serde_json::from_str(t).unwrap()).collect();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0]["event"]["hook_event_name"], "UserPromptSubmit");
        assert_eq!(calls[0]["source"], "codex");
        assert_eq!(calls[0]["at"], 1000);
        assert_eq!(calls[1]["event"]["hook_event_name"], "Stop");
        assert!(taken(&dir).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_call_keeps_only_what_the_window_reads_and_cuts_it_short() {
        let long = "x".repeat(5000);
        let event = json!({ "hook_event_name": "PreToolUse", "session_id": "s1", "cwd": "/w", "tool_name": "Write", "prompt": long, "transcript_path": "/secret", "tool_input": { "command": long, "content": "the whole file" } });
        let k = kept(&event);
        assert_eq!(k["prompt"].as_str().unwrap().len(), 200);
        assert_eq!(k["tool_input"]["command"].as_str().unwrap().len(), 300);
        assert!(k["tool_input"].get("content").is_none());
        assert!(k.get("transcript_path").is_none());
        assert_eq!(k["tool_name"], "Write");
    }

    #[test]
    fn connecting_codex_adds_mochi_once_and_leaves_other_hooks_alone() {
        let theirs = json!({ "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }] }, "other": 1 });
        let once = connected(theirs.clone(), "\"/Apps/Mochi\" hook codex").unwrap();
        let twice = connected(once.clone(), "\"/Apps/Mochi\" hook codex").unwrap();
        assert_eq!(once, twice);
        assert!(is_connected(&once));
        assert!(!is_connected(&theirs));
        assert_eq!(once["other"], 1);
        assert_eq!(once["hooks"]["Stop"].as_array().unwrap().len(), 2);
        assert_eq!(once["hooks"]["Stop"][0]["hooks"][0]["command"], "say done");
        assert_eq!(once["hooks"]["PreToolUse"][0]["matcher"], "*");
        assert!(once["hooks"]["Stop"][1].get("matcher").is_none());
        assert_eq!(once["hooks"].as_object().unwrap().len(), CODEX_EVENTS.len());
        // Taking Mochi out again leaves exactly what was there.
        assert_eq!(disconnected(once).unwrap(), theirs);
        // A config that is not what Codex writes is not touched.
        assert!(connected(json!([]), "x hook codex").is_none());
        assert!(connected(json!({ "hooks": [] }), "x hook codex").is_none());
    }

    #[test]
    fn codex_hooks_file_is_kept_once_beside_itself_and_a_broken_one_is_left_alone() {
        let dir = scratch("codex");
        let path = dir.join("hooks.json");
        // No file yet: one is made, and there is nothing to keep.
        assert!(set_codex(&path, Path::new("/Apps/Mochi Buddy"), true));
        assert!(is_connected(&codex_config(&path).unwrap()));
        assert!(fs::read_to_string(&path).unwrap().contains("\\\"/Apps/Mochi Buddy\\\" hook codex"));
        assert!(!dir.join("hooks.json.mochi-backup").exists());
        assert!(set_codex(&path, Path::new("/Apps/Mochi Buddy"), false));
        assert!(!is_connected(&codex_config(&path).unwrap()));
        assert!(dir.join("hooks.json.mochi-backup").exists());
        fs::write(&path, "{ broken").unwrap();
        assert!(!set_codex(&path, Path::new("/Apps/Mochi Buddy"), true));
        assert_eq!(fs::read_to_string(&path).unwrap(), "{ broken");
        fs::remove_dir_all(&dir).unwrap();
    }
}
