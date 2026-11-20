use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent};

/// A chat's file older than this is one the chat left behind; the mod skips it at the same age.
const FRESH: Duration = Duration::from_secs(60);
/// How often the app says it is here; the mod takes a silence of 45 seconds as gone.
const BEAT: Duration = Duration::from_secs(15);
/// More chats than anyone runs; a bound on what one read hands the window.
const MOST: usize = 64;

/// Where Mochi keeps its files, the same folder the mod writes: ~/.claude/mochi.
fn data_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").filter(|h| !h.is_empty()).or_else(|| std::env::var_os("USERPROFILE"))?;
    Some(PathBuf::from(home).join(".claude").join("mochi"))
}

/// The text of every chat's file written within FRESH, as the mod left it.
fn fresh_files(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .filter(|e| e.metadata().and_then(|m| m.modified()).ok().and_then(|at| at.elapsed().ok()).is_some_and(|age| age < FRESH))
        .filter_map(|e| fs::read_to_string(e.path()).ok())
        .take(MOST)
        .collect()
}

/// What the app says of itself in app.json: when, and whether its Mochi is on screen.
fn beat_text(at_ms: u128, is_shown: bool) -> String {
    serde_json::json!({ "v": 1, "at": at_ms as u64, "isShown": is_shown, "version": env!("CARGO_PKG_VERSION") }).to_string()
}

/// Writes app.json whole: to a file beside it first, then over it, so the mod never reads half of one.
fn write_beat(dir: &Path, is_shown: bool) {
    let at = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let tmp = dir.join("app.json.tmp");
    if fs::create_dir_all(dir).is_ok() && fs::write(&tmp, beat_text(at, is_shown)).is_ok() {
        let _ = fs::rename(&tmp, dir.join("app.json"));
    }
}

fn is_shown(app: &AppHandle) -> bool {
    app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(false)
}

fn beat_now(app: &AppHandle) {
    if let Some(dir) = data_dir() {
        write_beat(&dir, is_shown(app));
    }
}

/// What went wrong in the window, said where a person who starts the app from a terminal can read it.
#[tauri::command]
fn note(text: String) {
    eprintln!("mochi: {}", text.chars().take(400).collect::<String>());
}

#[tauri::command]
fn read_live() -> Vec<String> {
    data_dir().map(|d| fresh_files(&d.join("live"))).unwrap_or_default()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_live, note])
        .setup(|app| {
            // A companion, not a window to switch to: no icon in the Dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let toggle = MenuItemBuilder::with_id("toggle", "Show or hide Mochi").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Mochi").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&toggle, &quit]).build()?;
            let mut tray = TrayIconBuilder::new().menu(&menu).tooltip("Mochi Buddy").on_menu_event(|app, event| match event.id().as_ref() {
                "quit" => app.exit(0),
                "toggle" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = if is_shown(app) { window.hide() } else { window.show() };
                    }
                    // Said at once, so the mod's Mochi comes back or leaves without waiting for the next beat.
                    beat_now(app);
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

    #[test]
    fn only_json_files_are_read() {
        let dir = std::env::temp_dir().join(format!("mochi-live-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("a.json"), "{\"id\":\"a\"}").unwrap();
        fs::write(dir.join("a.json.tmp"), "half").unwrap();
        fs::write(dir.join("notes.txt"), "no").unwrap();
        assert_eq!(fresh_files(&dir), vec!["{\"id\":\"a\"}".to_string()]);
        assert!(fresh_files(&dir.join("missing")).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_beat_says_when_and_whether_mochi_is_on_screen() {
        let v: serde_json::Value = serde_json::from_str(&beat_text(1_760_000_000_000, true)).unwrap();
        assert_eq!(v["at"], 1_760_000_000_000u64);
        assert_eq!(v["isShown"], true);
        assert_eq!(v["v"], 1);
        assert_eq!(beat_text(1, false).contains("\"isShown\":false"), true);
    }

    #[test]
    fn the_beat_is_written_whole_and_leaves_no_half_file() {
        let dir = std::env::temp_dir().join(format!("mochi-beat-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        write_beat(&dir, true);
        let v: serde_json::Value = serde_json::from_str(&fs::read_to_string(dir.join("app.json")).unwrap()).unwrap();
        assert_eq!(v["isShown"], true);
        assert!(!dir.join("app.json.tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}
