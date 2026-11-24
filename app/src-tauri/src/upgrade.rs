//! The updates the person asks for in the room: what is installed (the mod, this app), what GitHub has, and the
//! one press that puts the new one in. Programs are the person's own (curl, claude, tar, rsync, hdiutil) and are
//! run with no shell between; the only addresses fetched are this repository's releases and tags.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime};

use serde_json::{Value, json};

use crate::work::{numbers, releases, run};

const DOWNLOADS: &str = "https://github.com/oztrkemree/mochi/releases/download/";
const MOD: &str = "mochi-buddy";
static BUSY: AtomicBool = AtomicBool::new(false);
const SHORT: Duration = Duration::from_secs(20);
const LONG: Duration = Duration::from_secs(300);

/// A version as a release or a tag names it: digits and dots only, so it is safe in an address and an argument.
fn is_version(v: &str) -> bool {
    !v.is_empty() && v.len() < 20 && v.starts_with(|c: char| c.is_ascii_digit()) && v.chars().all(|c| c.is_ascii_digit() || c == '.')
}

/// The newest published release whose tag is `prefix` and a version: `v` for the mod, `desktop-v` for the app.
pub fn latest(json: &str, prefix: &str) -> Option<String> {
    let releases: Vec<Value> = serde_json::from_str(json).ok()?;
    releases
        .iter()
        .filter(|r| r["draft"] != true && r["prerelease"] != true)
        .filter_map(|r| r["tag_name"].as_str()?.strip_prefix(prefix).filter(|v| is_version(v)))
        .max_by(|a, b| numbers(a).cmp(&numbers(b)))
        .map(str::to_owned)
}

/// The installer a desktop release carries for this computer: the Mac's disk image for its chip, Windows' setup.
pub fn asset_url(json: &str, version: &str, os: &str, arch: &str) -> Option<String> {
    let releases: Vec<Value> = serde_json::from_str(json).ok()?;
    let release = releases.iter().find(|r| r["tag_name"].as_str() == Some(&format!("desktop-v{version}")) && r["draft"] != true)?;
    let chip = if arch == "aarch64" { "aarch64" } else { "x64" };
    release["assets"].as_array()?.iter().find_map(|a| {
        let name = a["name"].as_str()?;
        let url = a["browser_download_url"].as_str()?;
        let fits = match os {
            "macos" => name.ends_with(".dmg") && name.contains(chip),
            "windows" => name.ends_with("-setup.exe"),
            _ => false,
        };
        (fits && url.starts_with(DOWNLOADS)).then(|| url.to_owned())
    })
}

/// How the mod is installed on this computer.
#[derive(Debug, PartialEq)]
pub enum Kind {
    /// Through a marketplace: `claude plugin update` puts a new one in.
    Plugin,
    /// From a folder Claude Code loads (`CLAUDE_CODE_PLUGIN_DIRS`): a plain copy of the repository.
    Dir(PathBuf),
}

/// Where the mod is and which version: a folder in `CLAUDE_CODE_PLUGIN_DIRS` first, since that is the one that loads,
/// then a marketplace plugin. `plugin_json_of` reads a folder's `.claude-plugin/plugin.json`.
pub fn find_mod(installed: &str, settings: &str, home: &Path, plugin_json_of: &dyn Fn(&Path) -> Option<String>) -> Option<(Kind, String)> {
    let dirs = serde_json::from_str::<Value>(settings).ok().and_then(|s| s["env"]["CLAUDE_CODE_PLUGIN_DIRS"].as_str().map(str::to_owned)).unwrap_or_default();
    for dir in std::env::split_paths(&dirs).filter(|d| !d.as_os_str().is_empty()) {
        let dir = match dir.strip_prefix("~") {
            Ok(rest) => home.join(rest),
            Err(_) => dir,
        };
        let Some(text) = plugin_json_of(&dir) else { continue };
        let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
        if v["name"] == MOD {
            if let Some(version) = v["version"].as_str() {
                return Some((Kind::Dir(dir), version.to_owned()));
            }
        }
    }
    let plugins = serde_json::from_str::<Value>(installed).ok()?;
    plugins["plugins"].as_object()?.iter().find_map(|(key, entries)| {
        key.starts_with(&format!("{MOD}@")).then(|| entries.get(0)?["version"].as_str().map(|v| (Kind::Plugin, v.to_owned()))).flatten()
    })
}

/// A folder of this call's own in the system's temp folder: no two calls, in this process or another, share one.
fn scratch(what: &str) -> Result<PathBuf, String> {
    let nanos = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map_or(0, |d| d.as_nanos());
    let dir = std::env::temp_dir().join(format!("mochi-{what}-{}-{nanos}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// One install at a time: a second press while one runs is refused, not run beside it.
struct OneAtATime;
impl OneAtATime {
    fn take() -> Result<Self, String> {
        BUSY.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).map(|_| Self).map_err(|_| "already working".to_owned())
    }
}
impl Drop for OneAtATime {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::SeqCst);
    }
}

fn read(path: &Path) -> String {
    std::fs::read_to_string(path).unwrap_or_default()
}

fn mod_found(home: &Path) -> Option<(Kind, String)> {
    find_mod(&read(&home.join(".claude/plugins/installed_plugins.json")), &read(&home.join(".claude/settings.json")), home, &|d| {
        std::fs::read_to_string(d.join(".claude-plugin/plugin.json")).ok()
    })
}

/// What is installed and what GitHub has, for the room's two rows. `latest` is null when GitHub cannot be asked.
pub fn state(home: &Path) -> Value {
    let json = releases();
    let of = |prefix: &str| json.as_deref().and_then(|j| latest(j, prefix));
    let found = mod_found(home);
    json!({
        "online": json.is_some(),
        "mod": { "have": found.as_ref().map(|f| f.1.clone()), "latest": of("v") },
        "app": { "have": env!("CARGO_PKG_VERSION"), "latest": of("desktop-v") },
    })
}

fn said(what: &str, out: Option<crate::work::Out>) -> Result<(), String> {
    match out {
        Some(o) if o.code == 0 => Ok(()),
        Some(o) => Err(format!("{what}: {}", o.stderr.trim().chars().take(200).collect::<String>())),
        None => Err(format!("{what}: could not run")),
    }
}

/// Puts the mod's newest version in, the way it was installed, or installs it when it is not there.
pub fn install_mod(home: &Path, version: &str) -> Result<(), String> {
    if !is_version(version) {
        return Err("no version".into());
    }
    let _one = OneAtATime::take()?;
    match mod_found(home) {
        Some((Kind::Plugin, _)) => {
            said("marketplace update", run("claude", &["plugin", "marketplace", "update", "mochi"], None, LONG))?;
            said("plugin update", run("claude", &["plugin", "update", &format!("{MOD}@mochi")], None, LONG))
        }
        Some((Kind::Dir(dir), _)) => replace_dir(&dir, version),
        None => {
            // A marketplace added before says so and is no failure.
            let _ = run("claude", &["plugin", "marketplace", "add", "oztrkemree/mochi"], None, LONG);
            said("plugin install", run("claude", &["plugin", "install", &format!("{MOD}@mochi"), "--scope", "user"], None, LONG))
        }
    }
}

/// Whether a folder is a plain copy of the mod that may be laid over: the mod's own, a real folder (no link), absolute, and
/// neither a git checkout nor holding the app's sources, which the tag's files would wipe.
fn may_replace(dir: &Path) -> Result<(), String> {
    let meta = std::fs::symlink_metadata(dir).map_err(|e| e.to_string())?;
    if !dir.is_absolute() || !meta.is_dir() {
        return Err("not a plain folder".into());
    }
    if dir.join(".git").exists() || dir.join("app").exists() {
        return Err("a checkout of the repository, not a copy".into());
    }
    let named = serde_json::from_str::<Value>(&read(&dir.join(".claude-plugin/plugin.json"))).ok();
    if named.is_none_or(|v| v["name"] != MOD) {
        return Err("not the mod's folder".into());
    }
    Ok(())
}

/// A folder the mod loads from is a copy of the repository without the app: the tag's files come over it, the app's left out.
fn replace_dir(dir: &Path, version: &str) -> Result<(), String> {
    if !cfg!(unix) {
        return Err("not on this system".into());
    }
    may_replace(dir)?;
    let tmp = scratch("mod")?;
    let result = (|| {
        let tarball = tmp.join("mod.tar.gz");
        let url = format!("https://github.com/oztrkemree/mochi/archive/refs/tags/v{version}.tar.gz");
        said("download", run("curl", &["-fsSL", "--max-time", "120", "-o", tarball.to_str().ok_or("path")?, &url], None, LONG))?;
        said("unpack", run("tar", &["-xzf", tarball.to_str().ok_or("path")?, "-C", tmp.to_str().ok_or("path")?], None, SHORT))?;
        let src = tmp.join(format!("mochi-{version}"));
        // What came is the mod of that version.
        let new = serde_json::from_str::<Value>(&read(&src.join(".claude-plugin/plugin.json"))).map_err(|_| "the download is not the mod")?;
        if new["name"] != MOD || new["version"].as_str() != Some(version) {
            return Err("the download is not the mod".into());
        }
        // Looked at again at the last moment: a folder that became a checkout in the meantime is left alone.
        may_replace(dir)?;
        let from = format!("{}/", src.display());
        said("copy", run("rsync", &["-a", "--delete", "--exclude=/app", "--", &from, &format!("{}/", dir.display())], None, SHORT))
    })();
    let _ = std::fs::remove_dir_all(&tmp);
    result
}

/// The app inside a disk image, copied beside the one it will replace: the image is opened, its app checked to be Mochi, copied, and closed.
fn stage_mac(dmg: &Path, mount: &Path, staged: &Path) -> Result<(), String> {
    let path = |p: &Path| p.to_str().map(str::to_owned).ok_or_else(|| "path".to_owned());
    let attached = said("open the disk image", run("hdiutil", &["attach", "-nobrowse", "-readonly", "-noverify", "-mountpoint", &path(mount)?, &path(dmg)?], None, SHORT));
    let copied = attached.and_then(|()| {
        let fresh = std::fs::read_dir(mount).map_err(|e| e.to_string())?.flatten().map(|e| e.path()).find(|p| p.extension().is_some_and(|e| e == "app")).ok_or("no app in the disk image")?;
        if !fresh.join("Contents/MacOS/mochi-desktop").is_file() {
            return Err("not Mochi".to_owned());
        }
        let _ = std::fs::remove_dir_all(staged);
        said("copy", run("ditto", &[&path(&fresh)?, &path(staged)?], None, SHORT))
    });
    // Closed whether or not it opened in time; a copy that did not finish is not kept.
    let _ = run("hdiutil", &["detach", "-force", &path(mount)?], None, SHORT);
    if copied.is_err() {
        let _ = std::fs::remove_dir_all(staged);
    }
    copied
}

/// What runs after this app quits, once the old one is gone ($3 is its process): the old app is set aside, the new one put in its
/// place and opened, and the old one dropped; if putting the new one in fails the old one comes back and is opened. $4 opens an app.
const SWAP: &str = r#"n=0; while kill -0 "$3" 2>/dev/null && [ "$n" -lt 50 ]; do sleep 0.2; n=$((n+1)); done
if mv "$1" "$1.old" && mv "$2" "$1"; then "$4" "$1"; rm -rf "$1.old"
else [ -e "$1.old" ] && [ ! -e "$1" ] && mv "$1.old" "$1"; "$4" "$1"; fi"#;

fn swap_command(bundle: &Path, staged: &Path, waits_for: u32, opener: &str) -> std::process::Command {
    let mut command = std::process::Command::new("sh");
    command.args(["-c", SWAP, "sh"]).arg(bundle).arg(staged).arg(waits_for.to_string()).arg(opener).stdin(std::process::Stdio::null());
    command
}

/// Puts the app's newest version in and starts it again: the disk image's app takes the place of this one after this one quits.
pub fn install_app(version: &str) -> Result<(), String> {
    if !is_version(version) {
        return Err("no version".into());
    }
    let _one = OneAtATime::take()?;
    let json = releases().ok_or("GitHub cannot be reached")?;
    let url = asset_url(&json, version, std::env::consts::OS, std::env::consts::ARCH).ok_or("this release has no installer for this computer")?;
    let tmp = scratch("app")?;
    let path = |p: &Path| p.to_str().map(str::to_owned).ok_or_else(|| "path".to_owned());
    if cfg!(target_os = "macos") {
        let mut staged = None;
        let result = (|| {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let bundle = exe.ancestors().nth(3).filter(|b| b.extension().is_some_and(|e| e == "app")).ok_or("not an installed app")?.to_owned();
            let dmg = tmp.join("app.dmg");
            said("download", run("curl", &["-fsSL", "--max-time", "280", "-o", &path(&dmg)?, &url], None, LONG))?;
            let beside = bundle.with_file_name(".Mochi Buddy.update.app");
            staged = Some(beside.clone());
            stage_mac(&dmg, &tmp.join("mnt"), &beside)?;
            swap_command(&bundle, &beside, std::process::id(), "open").spawn().map(|_| ()).map_err(|e| e.to_string())
        })();
        // A copy that did not come to be swapped in is not left beside the app.
        if result.is_err() {
            if let Some(beside) = staged {
                let _ = std::fs::remove_dir_all(beside);
            }
        }
        let _ = std::fs::remove_dir_all(&tmp);
        result
    } else if cfg!(windows) {
        // The setup closes this app itself; the person goes through it. Its folder stays until the system clears it.
        let setup = tmp.join("Mochi-Buddy-setup.exe");
        let result = said("download", run("curl", &["-fsSL", "--max-time", "280", "-o", &path(&setup)?, &url], None, LONG)).and_then(|()| std::process::Command::new(&setup).spawn().map(|_| ()).map_err(|e| e.to_string()));
        if result.is_err() {
            let _ = std::fs::remove_dir_all(&tmp);
        }
        result
    } else {
        let _ = std::fs::remove_dir_all(&tmp);
        Err("not on this system".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RELEASES: &str = r#"[
      {"tag_name":"v0.10.0","draft":true},
      {"tag_name":"v0.9.0","draft":false,"prerelease":false},
      {"tag_name":"v0.8.0","draft":false},
      {"tag_name":"desktop-v1.1.0","draft":false,"prerelease":false,"assets":[
        {"name":"Mochi.Buddy_1.1.0_aarch64.dmg","browser_download_url":"https://github.com/oztrkemree/mochi/releases/download/desktop-v1.1.0/Mochi.Buddy_1.1.0_aarch64.dmg"},
        {"name":"Mochi.Buddy_1.1.0_x64.dmg","browser_download_url":"https://github.com/oztrkemree/mochi/releases/download/desktop-v1.1.0/Mochi.Buddy_1.1.0_x64.dmg"},
        {"name":"Mochi.Buddy_1.1.0_x64-setup.exe","browser_download_url":"https://github.com/oztrkemree/mochi/releases/download/desktop-v1.1.0/Mochi.Buddy_1.1.0_x64-setup.exe"},
        {"name":"evil_aarch64.dmg","browser_download_url":"https://example.com/evil_aarch64.dmg"}]},
      {"tag_name":"desktop-v1.0.0","draft":false},
      {"tag_name":"demo-videos","draft":false},
      {"tag_name":"v1.x-evil","draft":false}
    ]"#;

    #[test]
    fn the_newest_published_release_of_each_kind_is_found_and_a_draft_or_odd_tag_is_not() {
        assert_eq!(latest(RELEASES, "v").as_deref(), Some("0.9.0"));
        assert_eq!(latest(RELEASES, "desktop-v").as_deref(), Some("1.1.0"));
        assert_eq!(latest("[]", "v"), None);
        assert_eq!(latest("not json", "v"), None);
    }

    #[test]
    fn a_ten_is_newer_than_a_nine() {
        let json = r#"[{"tag_name":"v0.9.0"},{"tag_name":"v0.10.0"}]"#;
        assert_eq!(latest(json, "v").as_deref(), Some("0.10.0"));
    }

    #[test]
    fn the_installer_is_this_computers_and_from_this_repository() {
        let base = "https://github.com/oztrkemree/mochi/releases/download/desktop-v1.1.0/";
        assert_eq!(asset_url(RELEASES, "1.1.0", "macos", "aarch64"), Some(format!("{base}Mochi.Buddy_1.1.0_aarch64.dmg")));
        assert_eq!(asset_url(RELEASES, "1.1.0", "macos", "x86_64"), Some(format!("{base}Mochi.Buddy_1.1.0_x64.dmg")));
        assert_eq!(asset_url(RELEASES, "1.1.0", "windows", "x86_64"), Some(format!("{base}Mochi.Buddy_1.1.0_x64-setup.exe")));
        assert_eq!(asset_url(RELEASES, "1.1.0", "linux", "x86_64"), None);
        assert_eq!(asset_url(RELEASES, "9.9.9", "macos", "aarch64"), None);
    }

    #[test]
    fn only_digits_and_dots_pass_as_a_version() {
        for good in ["0.10.0", "1", "12.3"] {
            assert!(is_version(good), "{good}");
        }
        for bad in ["", ".1", "1.0; rm -rf", "1.0/../x", "v1.0", "1.0 "] {
            assert!(!is_version(bad), "{bad}");
        }
    }

    fn plugin(version: &str) -> String {
        format!(r#"{{"name":"mochi-buddy","version":"{version}"}}"#)
    }

    #[test]
    fn the_mod_is_found_in_the_folder_claude_loads_before_a_marketplace_plugin() {
        let home = Path::new("/home/me");
        let settings = r#"{"env":{"CLAUDE_CODE_PLUGIN_DIRS":"~/.claude/mods/other:~/.claude/mods/mochi"}}"#;
        let installed = r#"{"plugins":{"mochi-buddy@mochi":[{"version":"0.5.0"}]}}"#;
        let read = |d: &Path| match d.to_str().unwrap() {
            "/home/me/.claude/mods/mochi" => Some(plugin("0.9.0")),
            "/home/me/.claude/mods/other" => Some(r#"{"name":"another","version":"3.0.0"}"#.to_owned()),
            _ => None,
        };
        assert_eq!(find_mod(installed, settings, home, &read), Some((Kind::Dir(PathBuf::from("/home/me/.claude/mods/mochi")), "0.9.0".to_owned())));
        // Without the folder, the plugin the marketplace put in; with neither, nothing.
        assert_eq!(find_mod(installed, "{}", home, &read), Some((Kind::Plugin, "0.5.0".to_owned())));
        assert_eq!(find_mod("{}", "{}", home, &read), None);
        assert_eq!(find_mod("junk", "junk", home, &read), None);
    }

    #[cfg(unix)]
    fn tree(root: &Path, name: &str, files: &[(&str, &str)]) -> PathBuf {
        let dir = root.join(name);
        for (file, text) in files {
            std::fs::create_dir_all(dir.join(file).parent().unwrap()).unwrap();
            std::fs::write(dir.join(file), text).unwrap();
        }
        dir
    }

    #[cfg(unix)]
    #[test]
    fn the_swap_puts_the_new_app_in_the_olds_place_in_a_path_with_spaces_and_drops_the_old() {
        let root = scratch("test-swap").unwrap();
        let bundle = tree(&root, "My Apps/Mochi Buddy.app", &[("v", "old")]);
        let staged = tree(&root, "My Apps/.Mochi Buddy.update.app", &[("v", "new")]);
        // A process that is already gone is waited for no longer; `true` stands for `open`.
        assert!(swap_command(&bundle, &staged, 2_000_000_000, "true").status().unwrap().success());
        assert_eq!(read(&bundle.join("v")), "new");
        assert!(!staged.exists());
        assert!(!root.join("My Apps/Mochi Buddy.app.old").exists());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn a_swap_that_cannot_put_the_new_app_in_gives_the_old_one_back() {
        let root = scratch("test-swap-fail").unwrap();
        let bundle = tree(&root, "Mochi Buddy.app", &[("v", "old")]);
        // The staged copy is gone: the second move fails after the first set the old app aside.
        let missing = root.join("not there.app");
        assert!(swap_command(&bundle, &missing, 2_000_000_000, "true").status().unwrap().success());
        assert_eq!(read(&bundle.join("v")), "old");
        assert!(!root.join("Mochi Buddy.app.old").exists());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn a_folder_is_laid_over_only_when_it_is_the_mods_plain_copy() {
        let root = scratch("test-guard").unwrap();
        let plugin = (".claude-plugin/plugin.json", r#"{"name":"mochi-buddy","version":"0.9.0"}"#);
        let copy = tree(&root, "copy", &[plugin]);
        assert!(may_replace(&copy).is_ok());
        // A checkout of the repository has .git, or the app's sources: the tag's files would wipe them.
        let checkout = tree(&root, "checkout", &[plugin, (".git/HEAD", "ref")]);
        assert!(may_replace(&checkout).is_err());
        let with_app = tree(&root, "with-app", &[plugin, ("app/package.json", "{}")]);
        assert!(may_replace(&with_app).is_err());
        let other = tree(&root, "other", &[(".claude-plugin/plugin.json", r#"{"name":"another"}"#)]);
        assert!(may_replace(&other).is_err());
        assert!(may_replace(&root.join("nothing")).is_err());
        assert!(may_replace(Path::new("relative/folder")).is_err());
        // A link to a copy is not a copy.
        std::os::unix::fs::symlink(&copy, root.join("link")).unwrap();
        assert!(may_replace(&root.join("link")).is_err());
        // And nothing is fetched or written for one of those: the checkout stays as it was.
        assert!(replace_dir(&checkout, "0.9.0").is_err());
        assert_eq!(read(&checkout.join(".git/HEAD")), "ref");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn a_second_install_while_one_runs_is_refused_and_one_is_allowed_again_after() {
        let first = OneAtATime::take().unwrap();
        assert!(OneAtATime::take().is_err());
        drop(first);
        assert!(OneAtATime::take().is_ok());
    }

    #[test]
    fn two_scratch_folders_are_never_the_same() {
        let (a, b) = (scratch("test-a").unwrap(), scratch("test-a").unwrap());
        assert_ne!(a, b);
        let _ = std::fs::remove_dir_all(a);
        let _ = std::fs::remove_dir_all(b);
    }

    /// By hand (`cargo test -- --ignored`): the real v0.9.0 tag over a folder that holds an older copy and a stale file.
    #[test]
    #[ignore = "uses the network"]
    fn a_mod_folder_takes_the_tags_files_and_loses_what_is_stale() {
        let dir = std::env::temp_dir().join(format!("mochi-test-mod-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".claude-plugin")).unwrap();
        std::fs::write(dir.join(".claude-plugin/plugin.json"), plugin("0.0.1")).unwrap();
        std::fs::write(dir.join("stale.txt"), "x").unwrap();
        replace_dir(&dir, "0.9.0").unwrap();
        assert!(read(&dir.join(".claude-plugin/plugin.json")).contains("\"0.9.0\""));
        assert!(!dir.join("stale.txt").exists());
        assert!(!dir.join("app").exists());
        assert!(dir.join("hooks/register.tsx").is_file());
        // A folder that is not the mod's is never touched.
        let other = std::env::temp_dir().join(format!("mochi-test-other-{}", std::process::id()));
        std::fs::create_dir_all(other.join(".claude-plugin")).unwrap();
        std::fs::write(other.join(".claude-plugin/plugin.json"), r#"{"name":"another","version":"1.0.0"}"#).unwrap();
        std::fs::write(other.join("keep.txt"), "x").unwrap();
        assert!(replace_dir(&other, "0.9.0").is_err());
        assert!(other.join("keep.txt").is_file());
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&other);
    }

    /// By hand: a disk image with a Mochi app in it is staged; one without the app's program is refused.
    #[test]
    #[ignore = "uses hdiutil"]
    #[cfg(target_os = "macos")]
    fn a_disk_image_with_mochi_in_it_is_staged_and_one_without_is_refused() {
        let root = std::env::temp_dir().join(format!("mochi-test-dmg-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let make = |name: &str, with_program: bool| {
            let src = root.join(format!("src-{name}"));
            std::fs::create_dir_all(src.join("Mochi Buddy.app/Contents/MacOS")).unwrap();
            if with_program {
                std::fs::write(src.join("Mochi Buddy.app/Contents/MacOS/mochi-desktop"), "program").unwrap();
            } else {
                std::fs::write(src.join("Mochi Buddy.app/Contents/MacOS/other"), "program").unwrap();
            }
            let dmg = root.join(format!("{name}.dmg"));
            assert!(run("hdiutil", &["create", "-quiet", "-srcfolder", src.to_str().unwrap(), dmg.to_str().unwrap()], None, SHORT).unwrap().code == 0);
            dmg
        };
        let good = make("good", true);
        let staged = root.join("staged.app");
        stage_mac(&good, &root.join("mnt-good"), &staged).unwrap();
        assert!(staged.join("Contents/MacOS/mochi-desktop").is_file());
        let bad = make("bad", false);
        assert!(stage_mac(&bad, &root.join("mnt-bad"), &root.join("staged-bad.app")).is_err());
        assert!(!root.join("staged-bad.app").exists());
        let _ = std::fs::remove_dir_all(&root);
    }
}
