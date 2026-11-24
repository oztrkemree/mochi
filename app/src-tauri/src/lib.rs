mod agents;
mod stage;
mod store;
mod work;

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

use serde_json::Value;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, RunEvent};

pub use agents::{hook, statusline};
use store::{data_dir, now_ms};

/// How often the pointer is looked at, for presses to pass through everything but Mochi.
const LOOK: Duration = Duration::from_millis(60);
/// Every this many looks the files are read: about once a second.
const READ_EVERY: u64 = 16;
/// Every this many looks the app says it is here, and its chats are written again: about every 15 seconds. The mod takes a silence of 45 as gone.
const BEAT_EVERY: u64 = 250;
/// Every this many looks the window is told a minute passed, for what only time changes (a chat gone quiet).
const MINUTE_EVERY: u64 = 1000;

// ---------- the app's own beat ----------

fn is_shown(app: &AppHandle) -> bool {
    app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(false)
}

/// For how many seconds a request for permission may wait on Mochi's bubble; 0 until the person asks for that.
static APPROVE_S: AtomicU64 = AtomicU64::new(0);
/// Whether the shield is on: a shell command that might destroy something then waits a moment for its word.
static SHIELD: AtomicBool = AtomicBool::new(true);

fn beat_now(app: &AppHandle) {
    if let Some(dir) = data_dir() {
        // With Mochi off the screen nobody sees its bubble: no request waits on it.
        let shown = is_shown(app);
        store::write_whole(&dir.join("app.json"), &store::beat_text(now_ms(), shown, if shown { APPROVE_S.load(Ordering::Relaxed) } else { 0 }, shown && SHIELD.load(Ordering::Relaxed)));
    }
}

// ---------- what the window is told ----------

/// Set when the window says it listens: everything is told again, so a window that started late misses nothing.
static TELL_ALL: AtomicBool = AtomicBool::new(true);

/// What the window was last told, so it hears only of a change.
#[derive(Default)]
struct Told {
    live: Option<Vec<String>>,
    look: Option<Option<String>>,
    prefs: Option<Option<String>>,
}

/// One read of Mochi's files: hook calls waiting, the chats the mod writes, the look. The window hears only what changed.
fn read_files(app: &AppHandle, told: &mut Told) {
    let Some(dir) = data_dir() else { return };
    if TELL_ALL.swap(false, Ordering::Relaxed) {
        *told = Told::default();
    }
    // The chats the mod writes are told before the hook calls of the same read: the window must know a chat is the mod's before it counts a call of it.
    let live = store::others_files(&dir.join("live"));
    if told.live.as_ref() != Some(&live) {
        let _ = app.emit_to("main", "live", &live);
        told.live = Some(live);
    }
    let calls = agents::taken(&dir.join("inbox"));
    if !calls.is_empty() {
        let _ = app.emit_to("main", "calls", calls);
    }
    let look = store::read_look(&dir);
    if told.look.as_ref() != Some(&look) {
        let _ = app.emit_to("main", "look", &look);
        told.look = Some(look);
    }
    // What the person last chose to wear, in either Mochi. A file that cannot be read now is read again next time.
    if let Ok(prefs) = store::read_shared(&dir, "prefs.json") {
        if told.prefs.as_ref() != Some(&prefs) {
            let _ = app.emit_to("main", "prefs", &prefs);
            told.prefs = Some(prefs);
        }
    }
}

/// The one loop the app runs: the pointer, the files, the beat. The window itself runs nothing on a clock.
fn keep_watch(app: AppHandle) {
    thread::spawn(move || {
        let mut told = Told::default();
        let mut over = None;
        let mut looks: u64 = 0;
        loop {
            stage::follow_pointer(&app, &mut over);
            // A call waiting on Mochi (the shield, a request for permission) is read at once; the rest every so often.
            if looks % READ_EVERY == 0 || data_dir().is_some_and(|d| agents::has_waiting(&d.join("inbox"))) {
                read_files(&app, &mut told);
            }
            if looks % BEAT_EVERY == 0 {
                beat_now(&app);
                if let Some(dir) = data_dir() {
                    store::beat_own(&dir.join("live"), now_ms());
                    agents::sweep_answers(&dir.join("answers"));
                }
            }
            if looks % MINUTE_EVERY == MINUTE_EVERY - 1 {
                let _ = app.emit_to("main", "minute", ());
            }
            looks += 1;
            thread::sleep(LOOK);
        }
    });
}

// ---------- updates ----------

/// The first look for a new version, a while after start so it never slows the start; then this often.
const FIRST_LOOK: Duration = Duration::from_secs(60);
const LOOK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

/// Whether this build can update itself: a release build with the key its updates are signed with.
fn can_update(app: &AppHandle) -> bool {
    !cfg!(debug_assertions) && is_signed(app.config().plugins.0.get("updater"))
}

/// Whether the updater's settings carry the key updates are checked against; without one nothing is fetched.
fn is_signed(updater: Option<&Value>) -> bool {
    updater.and_then(|u| u.get("pubkey")).and_then(Value::as_str).is_some_and(|key| !key.trim().is_empty())
}

/// Looks for a new version and, when there is one, puts it in and starts again on it.
/// The updater checks the new version's signature before it puts anything in.
async fn update_once(app: &AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_updater::UpdaterExt;
    let Some(update) = app.updater()?.check().await? else { return Ok(()) };
    eprintln!("mochi: updating {} -> {}", update.current_version, update.version);
    // On Windows the installer closes the app itself and opens the new one.
    update.download_and_install(|_, _| {}, || {}).await?;
    app.restart();
}

fn keep_updated(app: AppHandle) {
    if !can_update(&app) {
        // Unsigned, it cannot put a new version in: it tells of one, and the person fetches it.
        thread::spawn(move || {
            thread::sleep(FIRST_LOOK);
            loop {
                if let Some(json) = work::releases() {
                    if let Some((version, url)) = work::newer_release(&json, env!("CARGO_PKG_VERSION")) {
                        let _ = app.emit_to("main", "newer", (version, url));
                    }
                }
                thread::sleep(LOOK_EVERY);
            }
        });
        return;
    }
    thread::spawn(move || {
        thread::sleep(FIRST_LOOK);
        loop {
            // A failed look (offline, GitHub down) is tried again at the next one.
            if let Err(e) = tauri::async_runtime::block_on(update_once(&app)) {
                eprintln!("mochi: no update this time: {e}");
            }
            thread::sleep(LOOK_EVERY);
        }
    });
}

// ---------- what the windows ask for ----------

/// The window listens now: it is told everything at the next read.
#[tauri::command]
fn ready() {
    TELL_ALL.store(true, Ordering::Relaxed);
}

/// The window says its first drawing is on screen.
#[tauri::command]
fn shown(app: AppHandle) {
    // Only a window already on screen takes the spaces of an app that fills the screen: set before it shows, it stays off them.
    stage::set_shown(true);
    stage::stand(&app);
    if let Some(window) = app.get_webview_window("main") {
        stage::measure(&window.as_ref().window());
    }
    // Said at once: the mod's Mochi steps aside now, not at the next beat.
    beat_now(&app);
}

/// Over the other windows or among them, as the person set it.
#[tauri::command]
fn on_top(app: AppHandle, on: bool) {
    stage::ON_TOP.store(on, Ordering::Relaxed);
    stage::stand(&app);
}

/// Whether requests for permission wait on Mochi's bubble, and for how long: said in the app's beat at once, where the hooks read it.
#[tauri::command]
fn set_approve(app: AppHandle, seconds: u64) {
    APPROVE_S.store(seconds.min(agents::MOST_WAIT_S), Ordering::Relaxed);
    beat_now(&app);
}

#[tauri::command]
fn set_shield(app: AppHandle, on: bool) {
    SHIELD.store(on, Ordering::Relaxed);
    beat_now(&app);
}

/// The card to share, saved beside Mochi's files (share/), and shown in the file manager. Only the card's own name.
#[tauri::command]
fn save_share(app: AppHandle, name: String, svg: String) -> Option<String> {
    use tauri_plugin_opener::OpenerExt;
    if name != "mochi-card.svg" || svg.len() > 400_000 || !svg.trim_start().starts_with("<svg") {
        return None;
    }
    let path = data_dir()?.join("share").join(&name);
    if !store::write_whole(&path, &svg) {
        return None;
    }
    let _ = app.opener().reveal_item_in_dir(&path);
    Some(path.display().to_string())
}

/// The person's own shield rules, as they wrote them; read only.
#[tauri::command]
fn read_shield() -> Option<String> {
    std::fs::read_to_string(data_dir()?.join("shield.json")).ok().filter(|t| t.len() < 64_000)
}

/// The person's answer to a request for permission, from the bubble: "allow", "deny", or "none" to let the hook go.
#[tauri::command]
fn answer(id: String, behavior: String, why: Option<String>) -> bool {
    data_dir().is_some_and(|d| agents::answer(&d.join("answers"), &id, &behavior, why.as_deref().unwrap_or("")))
}

/// Whether Mochi looks about now: the window is told where the pointer is only then.
#[tauri::command]
fn gaze(on: bool) {
    stage::set_gaze(on);
}

/// Where in the window a press is Mochi's own; everywhere else it goes to what is behind.
#[tauri::command]
fn set_hot(rects: Vec<[f64; 4]>) {
    stage::set_hot(rects);
}

/// The chats the app follows itself, as they stand now. Answers with the ones the mod writes, which the app then leaves to it.
#[tauri::command]
fn own_live(peers: Vec<Value>) -> Vec<String> {
    data_dir().map(|d| store::keep_own(&d.join("live"), peers, now_ms())).unwrap_or_default()
}

#[tauri::command]
fn read_days(id: String) -> Option<String> {
    store::read_days(&data_dir()?.join("days"), &id)
}

#[tauri::command]
fn write_days(id: String, text: String) -> bool {
    data_dir().is_some_and(|d| store::write_days(&d.join("days"), &d.join("live"), &id, &text))
}

/// Whether an agent is connected: "on", "off", "broken" for a file of its own this cannot read, or "missing" when the agent's
/// own folder is not there (it was never run here).
#[tauri::command]
fn agent_state(agent: String) -> String {
    let Some(agent) = agents::agent_named(&agent) else { return "broken".into() };
    // Claude Code's folder holds Mochi's own files too: it is there when Claude Code has run, with its settings or its chats.
    let dir = agent.config_path().as_deref().and_then(std::path::Path::parent).map(std::path::Path::to_path_buf);
    let has_run = |dir: &std::path::Path| if agent.name == "claude" { dir.join("settings.json").exists() || dir.join("projects").is_dir() } else { dir.is_dir() };
    if dir.as_deref().is_some_and(|dir| !has_run(dir)) {
        return "missing".into();
    }
    match agent.config_path().as_deref().and_then(agents::config_at) {
        None => "broken".into(),
        Some(config) if agent.is_connected(&config) => "on".into(),
        Some(_) => "off".into(),
    }
}

#[tauri::command]
fn set_agent(agent: String, on: bool) -> bool {
    match (agents::agent_named(&agent), std::env::current_exe()) {
        (Some(agent), Ok(exe)) => agent.config_path().is_some_and(|path| agent.write(&path, &exe, on)),
        _ => false,
    }
}

/// Whether Mochi is Claude Code's status line, which is where the limits come from without the mod.
#[tauri::command]
fn line_state() -> String {
    agents::CLAUDE.config_path().map_or("broken", |path| agents::line_state(&path)).into()
}

#[tauri::command]
fn set_line(on: bool) -> bool {
    match (agents::CLAUDE.config_path(), data_dir(), std::env::current_exe()) {
        (Some(settings), Some(dir), Ok(exe)) => agents::set_line(&settings, &dir.join("statusline.json"), &exe, on),
        _ => false,
    }
}

/// Every chat's days, for the one history the level is counted from.
// async: hundreds of small files are read off the window's thread.
#[tauri::command(async)]
fn read_all_days() -> Vec<String> {
    data_dir().map(|d| store::all_days(&d.join("days"))).unwrap_or_default()
}

#[tauri::command]
fn read_shared(name: String) -> Result<Option<String>, String> {
    store::read_shared(&data_dir().ok_or("no home")?, &name)
}

/// Whether this Mochi says the news `at` of `name`; the mod claims the same names. async: it waits a moment for a claim to settle.
#[tauri::command(async)]
fn claim(name: String, at: u64) -> bool {
    data_dir().is_some_and(|d| store::claim(&d, &name, at, "app", Duration::from_millis(1500)))
}

/// A chat's folder, noted for the stand-up; the window asks once an hour for each folder it sees.
#[tauri::command(async)]
fn see_repo(cwd: String) -> bool {
    data_dir().is_some_and(|d| work::see_repo(&d, &cwd, now_ms()))
}

#[tauri::command(async)]
fn git_state(cwd: String) -> Option<Value> {
    work::git_state(&cwd)
}

#[tauri::command(async)]
fn ci(cwd: String, sha: Option<String>) -> Value {
    work::ci(&cwd, sha.as_deref())
}

#[tauri::command(async)]
fn usage(app: AppHandle, kind: String, span: String) -> Result<String, String> {
    let counter = app.path().resource_dir().map_err(|_| "failed")?.join("codeburn");
    work::usage(&counter, &kind, &span)
}

#[tauri::command]
fn write_shared(name: String, text: String) -> bool {
    data_dir().is_some_and(|d| store::write_shared(&d, &name, &text))
}

/// The room's tab asked for, if it is one of its tabs.
fn room_tab(tab: Option<&str>) -> Option<&str> {
    tab.filter(|t| ["wardrobe", "feats", "work", "usage", "settings"].contains(t))
}

/// Mochi's room: the wardrobe, the achievements and the settings, in a window of its own, opened or brought to the
/// front; on a tab when one is asked for (the tray's Settings), else on the one last open.
fn open_room_window(app: &AppHandle, tab: Option<&str>) {
    let tab = room_tab(tab);
    if let Some(window) = app.get_webview_window("room") {
        if let Some(tab) = tab {
            let _ = app.emit_to("room", "tab", tab);
        }
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let page = tab.map_or_else(|| "room.html".to_owned(), |tab| format!("room.html?tab={tab}"));
    let built = tauri::WebviewWindowBuilder::new(app, "room", tauri::WebviewUrl::App(page.into()))
        .title("Mochi")
        .inner_size(1180.0, 800.0)
        .min_inner_size(860.0, 600.0)
        .center()
        .build();
    if let Ok(window) = built {
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn open_room(app: AppHandle, tab: Option<String>) {
    open_room_window(&app, tab.as_deref());
}

/// What the mod writes of the person's look (look.json), for the room to dress Mochi by.
#[tauri::command]
fn read_look() -> Option<String> {
    store::read_look(&data_dir()?)
}

/// What went wrong in the window, said where a person who starts the app from a terminal can read it.
#[tauri::command]
fn note(text: String) {
    eprintln!("mochi: {}", text.chars().take(400).collect::<String>());
    if let Some(dir) = data_dir() {
        store::log(&dir, &format!("window: {text}"));
    }
}

fn show_or_hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if is_shown(app) {
            let _ = window.hide();
            stage::set_shown(false);
        } else {
            let _ = window.show();
            stage::set_shown(true);
            stage::stand(app);
            stage::measure(&window.as_ref().window());
        }
    }
    // Said at once, so the mod's Mochi comes back or leaves without waiting for the next beat.
    beat_now(app);
}

pub fn run() {
    // A crash leaves a line in app.log (where, and what), for the person to send if they want; then it goes on as Rust would.
    let before = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(dir) = data_dir() {
            store::log(&dir, &format!("crash {}: {info}", env!("CARGO_PKG_VERSION")));
        }
        before(info);
    }));
    tauri::Builder::default()
        // Opened a second time, the Mochi already out comes to the front: two would each take the other's hook calls.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if !is_shown(app) {
                show_or_hide(app);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        // Where the window stands is read when it changes, not at every look at the pointer.
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }) {
                stage::measure(window);
            }
        })
        .invoke_handler(tauri::generate_handler![ready, shown, on_top, set_approve, set_shield, read_shield, save_share, open_room, read_look, answer, gaze, set_hot, own_live, read_days, write_days, read_all_days, read_shared, write_shared, usage, claim, see_repo, git_state, ci, agent_state, set_agent, line_state, set_line, note])
        .setup(|app| {
            // A companion, not a window to switch to: no icon in the Dock.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let toggle = MenuItemBuilder::with_id("toggle", "Show or hide Mochi").build(app)?;
            let room = MenuItemBuilder::with_id("room", "Mochi’s room…").build(app)?;
            let settings = MenuItemBuilder::with_id("settings", "Settings…").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Mochi").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&toggle, &room, &settings]).separator().item(&quit).build()?;
            let mut tray = TrayIconBuilder::new().menu(&menu).tooltip("Mochi Buddy").on_menu_event(move |app, event| match event.id().as_ref() {
                "quit" => app.exit(0),
                "room" => open_room_window(app, None),
                "settings" => open_room_window(app, Some("settings")),
                "toggle" => show_or_hide(app),
                _ => {}
            });
            // On macOS a template image, which the menu bar tints for itself, light or dark; elsewhere the app's own icon.
            #[cfg(target_os = "macos")]
            {
                tray = tray.icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?).icon_as_template(true);
            }
            #[cfg(not(target_os = "macos"))]
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            // Mochi's entries in an agent's file, where the person put them, are kept in the form this version writes.
            if let Ok(exe) = std::env::current_exe() {
                for agent in [&agents::CLAUDE, &agents::CODEX] {
                    if let Some(path) = agent.config_path() {
                        agent.refresh(&path, &exe);
                    }
                }
            }

            keep_updated(app.handle().clone());
            keep_watch(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Mochi could not start")
        .run(|app, event| match event {
            // Mochi's window is made here, once the app is up as a companion, and not from the config at start:
            // macOS never lets a window made while the app still counted as an ordinary one onto a screen another app fills.
            RunEvent::Ready => {
                let made = app.config().app.windows.iter().find(|w| w.label == "main").map(|config| tauri::WebviewWindowBuilder::from_config(app, config).and_then(|b| b.build()));
                if !matches!(made, Some(Ok(_))) {
                    eprintln!("mochi: the window could not be made");
                    app.exit(1);
                }
            }
            // Gone at once, not after the mod's 45 seconds of silence; and the chats the app wrote are closed with it.
            RunEvent::Exit => {
                if let Some(dir) = data_dir() {
                    let _ = std::fs::remove_file(dir.join("app.json"));
                    store::forget_own(&dir.join("live"));
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_room_opens_on_any_of_its_tabs_and_on_nothing_else() {
        for tab in ["wardrobe", "feats", "work", "usage", "settings"] {
            assert_eq!(room_tab(Some(tab)), Some(tab));
        }
        assert_eq!(room_tab(Some("../index")), None);
        assert_eq!(room_tab(None), None);
    }

    #[test]
    fn the_version_is_the_same_everywhere_it_is_written() {
        // The app tells its version from Cargo.toml (app.json, a newer release); the installers are named from tauri.conf.json.
        let conf: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let package: Value = serde_json::from_str(include_str!("../../package.json")).unwrap();
        assert_eq!(conf["version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(package["version"], env!("CARGO_PKG_VERSION"));
    }
    use serde_json::json;

    #[test]
    fn updates_are_looked_for_only_with_the_key_they_are_signed_with() {
        assert!(!is_signed(None));
        assert!(!is_signed(Some(&json!({}))));
        assert!(!is_signed(Some(&json!({ "pubkey": "  " }))));
        assert!(is_signed(Some(&json!({ "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6" }))));
    }
}
