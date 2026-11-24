//! Agents with no Mochi inside them (Codex, or Claude Code without the mod) tell the app what they do
//! through their hooks: each hook runs `mochi-desktop hook <agent>`, which leaves the call in the inbox.

use std::fs;
use std::io::Read;
use std::thread;
use std::time::Duration;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::store::{data_dir, home_dir, is_fresh, is_id, now_ms, write_theirs, write_whole};

/// The hook calls one read takes from the inbox; the rest wait a second.
const MOST_CALLS: usize = 500;

// ---------- the hook command and the inbox ----------

/// Only what the window reads of a hook call, cut short: a prompt or a file's text is not left on disk for it.
fn kept(event: &Value, most_command: usize) -> Value {
    let short = |v: &Value, max: usize| v.as_str().map(|s| Value::from(s.chars().take(max).collect::<String>()));
    let mut out = serde_json::Map::new();
    for (key, max) in [("hook_event_name", 40), ("session_id", 120), ("cwd", 400), ("tool_name", 80), ("prompt", 200), ("notification_type", 40), ("agent_id", 80), ("agent_type", 40), ("session_title", 60)] {
        if let Some(v) = short(&event[key], max) {
            out.insert(key.into(), v);
        }
    }
    // A status line call: how full the context is, what the chat cost, and the usage limits, as numbers only.
    if event["hook_event_name"] == "StatusLine" {
        out.insert("status".into(), status_of(event));
    }
    // Of what a tool is given, only what tells a test or a commit, and what a person must see to answer for it: the command, or the file.
    let mut input = serde_json::Map::new();
    if let Some(command) = event["tool_input"]["command"].as_str() {
        input.insert("command".into(), short(&event["tool_input"]["command"], most_command).unwrap_or_default());
        // Said when the command is longer than what is kept: nobody may answer for a command they saw part of.
        if command.chars().count() > most_command {
            input.insert("cut".into(), json!(true));
        }
    }
    if let Some(path) = short(&event["tool_input"]["file_path"], 300) {
        input.insert("file_path".into(), path);
    }
    // A plan: the to-do list's counts and the step under way, never the list; a task's new state, and the words of one under way.
    match event["tool_name"].as_str() {
        Some("TodoWrite") => {
            let todos = event["tool_input"]["todos"].as_array().cloned().unwrap_or_default();
            let under_way = todos.iter().find(|t| t["status"] == "in_progress");
            let now = under_way.and_then(|t| short(&t["activeForm"], 60).or_else(|| short(&t["content"], 60))).unwrap_or_else(|| json!(""));
            input.insert("plan".into(), json!({ "total": todos.len(), "done": todos.iter().filter(|t| t["status"] == "completed").count(), "now": now }));
        }
        Some("TaskCreate" | "TaskUpdate") => {
            if let Some(status) = short(&event["tool_input"]["status"], 20) {
                input.insert("status".into(), status);
            }
            if let Some(now) = short(&event["tool_input"]["activeForm"], 60).or_else(|| short(&event["tool_input"]["subject"], 60)) {
                input.insert("now".into(), now);
            }
        }
        _ => {}
    }
    // Said when a command came with more than itself (the sandbox off, say): what is not shown cannot be answered for.
    if event["tool_input"].as_object().is_some_and(|given| given.contains_key("command") && given.keys().any(|k| !PLAIN_WITH_A_COMMAND.contains(&k.as_str()))) {
        input.insert("odd".into(), json!(true));
    }
    if !input.is_empty() {
        out.insert("tool_input".into(), Value::Object(input));
    }
    Value::Object(out)
}

/// What Claude Code tells a status line of the chat, as the mod writes it of its own chats: the context used in percent, the cost in dollars,
/// and each usage window with percent used and when it resets (epoch ms; Claude Code gives seconds).
fn status_of(event: &Value) -> Value {
    let mut status = serde_json::Map::new();
    if let Some(p) = event["context_window"]["used_percentage"].as_f64() {
        status.insert("context".into(), json!(p.clamp(0.0, 100.0).round() as u64));
    }
    if let Some(cost) = event["cost"]["total_cost_usd"].as_f64() {
        status.insert("cost".into(), json!((cost.max(0.0) * 100.0).round() / 100.0));
    }
    let windows: Vec<Value> = ["five_hour", "seven_day"]
        .into_iter()
        .filter_map(|kind| {
            let w = &event["rate_limits"][kind];
            let p = w["used_percentage"].as_f64()?;
            Some(json!({ "kind": kind, "p": p.clamp(0.0, 100.0).round() as u64, "resetsAt": (w["resets_at"].as_f64().unwrap_or(0.0).max(0.0) * 1000.0) as u64 }))
        })
        .collect();
    if !windows.is_empty() {
        status.insert("windows".into(), json!(windows));
    }
    Value::Object(status)
}

/// As much of a shell command as is kept.
const MOST_COMMAND: usize = 300;
/// What a shell command is given besides itself that changes nothing of what it does: why, for how long, and whether to wait for it.
const PLAIN_WITH_A_COMMAND: [&str; 4] = ["command", "description", "timeout", "run_in_background"];
/// For how long a request for permission may wait on Mochi's bubble at most, in seconds.
pub const MOST_WAIT_S: u64 = 120;
/// As much of a shell command as the shield reads: all of nearly any real one. The call is taken out of the inbox as it is read.
const MOST_SHIELDED: usize = 4000;
/// For how long a shell command that might destroy something waits for the shield's word, in ms; without one it goes on as always.
pub const SHIELD_WAIT_MS: u64 = 2500;

/// One hook call into the inbox, named so the calls sort by time; nothing for input that is not a call.
/// `wait_ms` is for how long the call waits for an answer from Mochi (0: it does not): the call then says so, with the name to answer it by,
/// and its name ends in `-ask`, so the app reads it at once.
fn drop_in(dir: &Path, source: &str, input: &str, at: u128, pid: u32, wait_ms: u64) -> Option<PathBuf> {
    let event: Value = serde_json::from_str(input).ok()?;
    if !event.is_object() {
        return None;
    }
    let name = if wait_ms > 0 { ask_name(at, pid) } else { format!("{at:015}-{pid}") };
    let shielded = wait_ms > 0 && event["hook_event_name"] == "PreToolUse";
    let mut call = json!({ "source": source, "at": at as u64, "event": kept(&event, if shielded { MOST_SHIELDED } else { MOST_COMMAND }) });
    if wait_ms > 0 {
        call["ask"] = json!({ "id": name, "until": at as u64 + wait_ms });
    }
    let path = dir.join(format!("{name}.json"));
    write_whole(&path, &call.to_string()).then_some(path)
}

// ---------- a request for permission, answered from Mochi's bubble ----------

/// For how long a request for permission waits on Mochi's bubble: only Claude Code's (its answer is the one this knows how to give),
/// only while the person asked for it (the app says so in its beat), and never a question or a plan, which are answered in words.
fn waits_for(source: &str, event: &Value, beat: &Value) -> u64 {
    let tool = event["tool_name"].as_str().unwrap_or("");
    let is_request = source == "claude" && event["hook_event_name"] == "PermissionRequest" && tool != "AskUserQuestion" && tool != "ExitPlanMode";
    if is_request { beat["approve"].as_u64().unwrap_or(0).min(MOST_WAIT_S) } else { 0 }
}

fn ask_name(at: u128, pid: u32) -> String {
    format!("{at:015}-{pid}-ask")
}

// ---------- the shield ----------

/// Words one of which is in every command the shield names (the mod's `hooks/guard.ts`), in lower case: `whole` ones as a whole word,
/// `anywhere` ones anywhere. A command with none of them cannot be one, and goes on without a wait; one with them waits a moment for the
/// shield to read it whole. `app/src/shield.spec.ts` checks every dangerous command in the mod's tests has one.
fn words() -> &'static (Vec<String>, Vec<String>) {
    static WORDS: std::sync::OnceLock<(Vec<String>, Vec<String>)> = std::sync::OnceLock::new();
    WORDS.get_or_init(|| {
        let v: Value = serde_json::from_str(include_str!("../shield-words.json")).unwrap_or(Value::Null);
        let list = |key: &str| v[key].as_array().map(|a| a.iter().filter_map(|w| w.as_str().map(str::to_owned)).collect()).unwrap_or_default();
        (list("whole"), list("anywhere"))
    })
}

pub fn might_destroy(command: &str) -> bool {
    let command = command.to_lowercase();
    let (whole, anywhere) = words();
    // Split as a shell reads words and flags: `-destroy` holds `destroy`.
    command.split(|c: char| !(c.is_alphanumeric() || c == '_')).any(|word| whole.iter().any(|w| w == word))
        || anywhere.iter().any(|word| command.contains(word.as_str()))
}

/// Whether the person wrote rules of their own into shield.json: any command may match those, so every one is read.
fn has_own_rules(dir: &Path) -> bool {
    fs::read_to_string(dir.join("shield.json")).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()).is_some_and(|v| v["add"].as_array().is_some_and(|a| !a.is_empty()))
}

/// For how long, in ms, a shell command in a chat waits for the shield's word: a Claude Code chat the app follows (the mod shields its
/// own), while the person keeps the shield on (the app says so in its beat), for a command that might destroy something.
fn shield_wait(source: &str, event: &Value, beat: &Value, dir: &Path) -> u64 {
    let tool = event["tool_name"].as_str().unwrap_or("");
    let command = event["tool_input"]["command"].as_str().unwrap_or("");
    let session = event["session_id"].as_str().unwrap_or("");
    let is_shell = source == "claude" && event["hook_event_name"] == "PreToolUse" && (tool == "Bash" || tool == "PowerShell") && !command.is_empty();
    if !is_shell || beat["shield"] != true || crate::store::is_theirs(&dir.join("live"), session) || !(might_destroy(command) || has_own_rules(dir)) {
        return 0;
    }
    SHIELD_WAIT_MS
}

/// What Claude Code is told for an answer: its own words for a granted or a refused request, or, for a command the shield named,
/// to ask the person first and why. None for no answer, which leaves the call to Claude Code as always.
fn decision(answer: &str, why: &str) -> Option<String> {
    if answer == "ask" {
        let reason = format!("Mochi: {why}");
        return Some(json!({ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": reason } }).to_string());
    }
    let decision = match answer {
        "allow" => json!({ "behavior": "allow" }),
        "deny" => json!({ "behavior": "deny", "message": "Denied from Mochi, on the desktop." }),
        _ => return None,
    };
    Some(json!({ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": decision } }).to_string())
}

/// Waits for Mochi's answer to one call, until `until`: what it is, and why; the answer's file is taken away once read.
fn answer_for(answers: &Path, id: &str, until: u128) -> Option<(String, String)> {
    let path = answers.join(format!("{id}.json"));
    loop {
        if let Ok(text) = fs::read_to_string(&path) {
            let _ = fs::remove_file(&path);
            let v = serde_json::from_str::<Value>(&text).ok()?;
            return Some((v["behavior"].as_str()?.to_owned(), v["why"].as_str().unwrap_or("").to_owned()));
        }
        if now_ms() >= until {
            return None;
        }
        thread::sleep(Duration::from_millis(40));
    }
}

/// Mochi's answer to a call, left for the hook that waits on it. Only a name the hook could have given, and only one of the four answers;
/// `why` is said with "ask", in a line.
pub fn answer(answers: &Path, id: &str, behavior: &str, why: &str) -> bool {
    let why: String = why.chars().filter(|c| !c.is_control()).take(200).collect();
    is_id(id) && ["allow", "deny", "none", "ask"].contains(&behavior) && write_whole(&answers.join(format!("{id}.json")), &json!({ "behavior": behavior, "why": why }).to_string())
}

/// Answers nobody waited for (the hook gave up first) are swept away after a while.
pub fn sweep_answers(answers: &Path) {
    let Ok(entries) = fs::read_dir(answers) else { return };
    for path in entries.flatten().map(|e| e.path()).filter(|p| !is_fresh(p)) {
        let _ = fs::remove_file(path);
    }
}

/// Whether the app is running, by its beat: with it gone nobody empties the inbox, so the hook puts nothing in.
fn is_running(dir: &Path) -> bool {
    is_fresh(&dir.join("app.json"))
}

/// The `hook` command. It never fails, and prints nothing but the person's own answer to a request for permission,
/// given in Mochi's bubble: an agent's hook must not stand in the agent's way.
pub fn hook(source: &str) {
    let Some(dir) = data_dir() else { return };
    if !is_running(&dir) {
        return;
    }
    let mut input = String::new();
    // A hook's input is small; the read stops well past any real one.
    if std::io::stdin().take(4_000_000).read_to_string(&mut input).is_err() {
        return;
    }
    let event: Value = serde_json::from_str(&input).unwrap_or(Value::Null);
    let beat: Value = fs::read_to_string(dir.join("app.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(Value::Null);
    let wait_ms = (waits_for(source, &event, &beat) * 1000).max(shield_wait(source, &event, &beat, &dir));
    let (at, pid) = (now_ms(), std::process::id());
    if drop_in(&dir.join("inbox"), source, &input, at, pid, wait_ms).is_none() || wait_ms == 0 {
        return;
    }
    if let Some(text) = answer_for(&dir.join("answers"), &ask_name(at, pid), at + u128::from(wait_ms)).and_then(|(a, why)| decision(&a, &why)) {
        println!("{text}");
    }
}

/// Whether a call in the inbox waits on Mochi's answer (its name says so): looked at often, so it is cheap, a listing of the folder.
pub fn has_waiting(dir: &Path) -> bool {
    fs::read_dir(dir).is_ok_and(|entries| entries.flatten().any(|e| e.file_name().to_str().is_some_and(|n| n.ends_with("-ask.json"))))
}

/// The calls waiting in the inbox, oldest first, each taken out as it is read.
pub fn taken(dir: &Path) -> Vec<String> {
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

// ---------- Claude Code's status line, for the limits without the mod ----------

/// How Mochi's own status line is told from the person's: it runs the app's `statusline`.
const OUR_LINE: &str = " statusline";

fn line_command(exe: &Path) -> String {
    format!("\"{}\"{OUR_LINE}", exe.display())
}

/// Whether a status line command is Mochi's: the app's own path in quotes, then `statusline`. A person's line that only ends
/// in the word (`bun x ccusage statusline`) is theirs. The app may have moved since, so any Mochi binary counts.
fn is_ours(command: &str) -> bool {
    command
        .strip_suffix(OUR_LINE)
        .and_then(|c| c.strip_prefix('"')?.strip_suffix('"'))
        .and_then(|path| Path::new(path).file_stem()?.to_str().map(str::to_lowercase))
        .is_some_and(|name| name.contains("mochi"))
}

fn is_our_line(config: &Value) -> bool {
    config["statusLine"]["command"].as_str().is_some_and(is_ours)
}

/// Claude Code's settings with Mochi as the status line, and the status line the person had, to keep and to go on showing.
fn line_connected(mut config: Value, command: &str) -> Option<(Value, Option<Value>)> {
    let root = config.as_object_mut()?;
    let theirs = root.get("statusLine").filter(|line| !line["command"].as_str().is_some_and(is_ours)).cloned();
    let mut ours = json!({ "type": "command", "command": command });
    // The room the person gave their own line is the room it still gets.
    if let Some(padding) = theirs.as_ref().and_then(|line| line.get("padding")) {
        ours["padding"] = padding.clone();
    }
    root.insert("statusLine".into(), ours);
    Some((config, theirs))
}

/// Claude Code's settings with the person's own status line back, or none if they had none.
fn line_disconnected(mut config: Value, theirs: Option<Value>) -> Option<Value> {
    let root = config.as_object_mut()?;
    if root.get("statusLine").is_some_and(|line| line["command"].as_str().is_some_and(is_ours)) {
        match theirs {
            Some(line) => drop(root.insert("statusLine".into(), line)),
            None => drop(root.shift_remove("statusLine")),
        }
    }
    Some(config)
}

/// Whether Mochi is Claude Code's status line: "on", "off", or "broken" for settings this cannot read.
pub fn line_state(settings: &Path) -> &'static str {
    match config_at(settings) {
        None => "broken",
        Some(config) if is_our_line(&config) => "on",
        Some(_) => "off",
    }
}

/// Makes Mochi Claude Code's status line, or gives the person's own back. Their line is kept beside Mochi's files (`statusline.json`)
/// and goes on being shown: Mochi's runs it and prints what it prints. The settings as they were are kept once, as for the hooks.
pub fn set_line(settings: &Path, kept: &Path, exe: &Path, on: bool) -> bool {
    let Some(config) = config_at(settings) else { return false };
    let next = if on {
        if is_our_line(&config) {
            return true;
        }
        let Some((next, theirs)) = line_connected(config, &line_command(exe)) else { return false };
        match theirs {
            Some(line) if !write_whole(kept, &line.to_string()) => return false,
            Some(_) => {}
            None => drop(fs::remove_file(kept)),
        }
        next
    } else {
        // No file: they had no line of their own. A file that cannot be read is their line all the same, never thrown away.
        let theirs = match fs::read_to_string(kept) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(_) => return false,
            Ok(text) => match serde_json::from_str::<Value>(&text) {
                Ok(line) if line.is_object() => Some(line),
                _ => return false,
            },
        };
        let Some(next) = line_disconnected(config, theirs) else { return false };
        next
    };
    let written = write_config(settings, &next);
    if written && !on {
        let _ = fs::remove_file(kept);
    }
    written
}

/// The `statusline` command, which Claude Code runs after each turn with what it knows of the chat. It tells the app (the limits,
/// the context, the cost), then shows the person's own status line if they had one. Without one it prints nothing: the row stays empty.
pub fn statusline() {
    let mut input = String::new();
    if std::io::stdin().take(4_000_000).read_to_string(&mut input).is_err() {
        return;
    }
    let Some(dir) = data_dir() else { return };
    if is_running(&dir) {
        if let Ok(mut event) = serde_json::from_str::<Value>(&input) {
            if event.is_object() {
                event["hook_event_name"] = json!("StatusLine");
                // The chat's name, under the name the hooks give it.
                if let Some(name) = event["session_name"].as_str().map(str::to_owned) {
                    event["session_title"] = json!(name);
                }
                drop_in(&dir.join("inbox"), "claude", &event.to_string(), now_ms(), std::process::id(), 0);
            }
        }
    }
    let theirs = fs::read_to_string(dir.join("statusline.json")).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok());
    if let Some(command) = theirs.as_ref().and_then(|line| line["command"].as_str()).filter(|c| !is_ours(c)) {
        show_their_line(command, &input);
    }
}

/// Runs the person's own status line as Claude Code would, with the same input, and lets it print for itself.
fn show_their_line(command: &str, input: &str) {
    use std::io::Write;
    use std::process::{Command, Stdio};
    #[cfg(windows)]
    let mut shell = {
        use std::os::windows::process::CommandExt;
        // cmd reads its line as it is: Rust's quoting of an argument would break a quoted path in it.
        let mut shell = Command::new("cmd");
        shell.arg("/C").raw_arg(command);
        shell
    };
    #[cfg(not(windows))]
    let mut shell = {
        let mut shell = Command::new("sh");
        shell.arg("-c").arg(command);
        shell
    };
    shell.stdin(Stdio::piped());
    let Ok(mut child) = shell.spawn() else { return };
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(input.as_bytes());
    }
    let _ = child.wait();
}

// ---------- an agent's own hooks file ----------

/// An agent the app can listen to: its name in the hook command, and the events it tells, each with whether it wants a matcher.
pub struct Agent {
    pub name: &'static str,
    events: &'static [(&'static str, bool)],
}

pub const CODEX: Agent = Agent {
    name: "codex",
    events: &[
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
    ],
};

pub const CLAUDE: Agent = Agent {
    name: "claude",
    events: &[
        ("SessionStart", false),
        ("SessionEnd", false),
        ("UserPromptSubmit", false),
        ("PreToolUse", true),
        ("PostToolUse", true),
        ("PostToolUseFailure", true),
        ("PermissionRequest", true),
        ("Notification", false),
        ("Stop", false),
        ("StopFailure", false),
        ("SubagentStart", false),
        ("SubagentStop", false),
    ],
};

pub fn agent_named(name: &str) -> Option<&'static Agent> {
    [&CODEX, &CLAUDE].into_iter().find(|a| a.name == name)
}

impl Agent {
    /// How Mochi's own entries are told from anyone else's: they run the app's `hook <agent>`.
    fn ours(&self) -> String {
        format!(" hook {}", self.name)
    }

    /// What the agent runs. Codex trusts a hook by its text, so this must stay the same from one version of the app to the next.
    fn command(&self, exe: &Path) -> String {
        format!("\"{}\"{}", exe.display(), self.ours())
    }

    fn is_ours(&self, group: &Value) -> bool {
        group["hooks"].as_array().is_some_and(|hooks| hooks.iter().any(|h| h["command"].as_str().is_some_and(|c| c.ends_with(&self.ours()))))
    }

    pub fn is_connected(&self, config: &Value) -> bool {
        config["hooks"].as_object().is_some_and(|events| events.values().any(|groups| groups.as_array().is_some_and(|g| g.iter().any(|x| self.is_ours(x)))))
    }

    /// The config without Mochi's entries; everyone else's, and every other setting, stay as they are. None for a config that is not what the agent writes.
    fn disconnected(&self, mut config: Value) -> Option<Value> {
        let root = config.as_object_mut()?;
        let Some(hooks) = root.get_mut("hooks") else { return Some(config) };
        let events = hooks.as_object_mut()?;
        for groups in events.values_mut() {
            groups.as_array_mut()?.retain(|g| !self.is_ours(g));
        }
        events.retain(|_, groups| groups.as_array().is_some_and(|g| !g.is_empty()));
        Some(config)
    }

    /// The config with Mochi's entries, once each, after everyone else's.
    fn connected(&self, config: Value, command: &str) -> Option<Value> {
        let mut config = self.disconnected(config)?;
        let root = config.as_object_mut()?;
        let events = root.entry("hooks").or_insert_with(|| json!({})).as_object_mut()?;
        for (name, has_matcher) in self.events {
            // A hook is gone in a moment, and the agent need never wait on one longer than this. The one that may wait on
            // Mochi's bubble is given the time to: an agent that ends it sooner would leave the bubble's answers going nowhere.
            let timeout = if *name == "PermissionRequest" { MOST_WAIT_S + 10 } else { 5 };
            let mut group = json!({ "hooks": [{ "type": "command", "command": command, "timeout": timeout }] });
            if *has_matcher {
                group["matcher"] = json!("*");
            }
            events.entry(*name).or_insert_with(|| json!([])).as_array_mut()?.push(group);
        }
        Some(config)
    }

    /// The file the agent reads its hooks from: Codex's own hooks file, Claude Code's settings.
    pub fn config_path(&self) -> Option<PathBuf> {
        let folder = |var: &str, name: &str| std::env::var_os(var).filter(|h| !h.is_empty()).map(PathBuf::from).or_else(|| Some(home_dir()?.join(name)));
        match self.name {
            "codex" => Some(folder("CODEX_HOME", ".codex")?.join("hooks.json")),
            _ => Some(folder("CLAUDE_CONFIG_DIR", ".claude")?.join("settings.json")),
        }
    }

    /// Writes Mochi's entries again if the agent's file has them in an older form (a new event, another timeout). A file without them is left without.
    pub fn refresh(&self, path: &Path, exe: &Path) {
        let Some(config) = config_at(path) else { return };
        if self.is_connected(&config) && self.connected(config.clone(), &self.command(exe)).is_some_and(|next| next != config) {
            self.write(path, exe, true);
        }
    }

    /// Adds or takes out Mochi's entries in the agent's file. The file as it was is kept once beside it; a file this cannot read is left alone.
    pub fn write(&self, path: &Path, exe: &Path, on: bool) -> bool {
        let Some(config) = config_at(path) else { return false };
        let Some(next) = (if on { self.connected(config, &self.command(exe)) } else { self.disconnected(config) }) else { return false };
        write_config(path, &next)
    }
}

/// Writes an agent's file with Mochi's change in it. The file as it was before Mochi first touched it is kept once beside it.
fn write_config(path: &Path, next: &Value) -> bool {
    let backup = PathBuf::from(format!("{}.mochi-backup", path.display()));
    if path.exists() && !backup.exists() && fs::copy(path, &backup).is_err() {
        return false;
    }
    serde_json::to_string_pretty(next).is_ok_and(|text| write_theirs(path, &(text + "\n")))
}

/// An agent's file as it stands: an empty config when there is none, None when it cannot be read as one.
pub fn config_at(path: &Path) -> Option<Value> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).ok().filter(Value::is_object),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Some(json!({})),
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::beat_text;
    use crate::store::tests::scratch;

    #[test]
    fn the_hook_counts_the_app_as_running_only_while_its_beat_is_on_disk() {
        let dir = scratch("running");
        assert!(!is_running(&dir));
        write_whole(&dir.join("app.json"), &beat_text(now_ms(), true, 0, false, false));
        assert!(is_running(&dir));
        fs::remove_file(dir.join("app.json")).unwrap();
        assert!(!is_running(&dir));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn hook_calls_wait_in_the_inbox_in_the_order_they_came_and_are_taken_once() {
        let dir = scratch("inbox");
        drop_in(&dir, "codex", r#"{"hook_event_name":"Stop","session_id":"s1"}"#, 2000, 7, 0).unwrap();
        drop_in(&dir, "claude", r#"{"hook_event_name":"UserPromptSubmit","session_id":"s1","prompt":"hi"}"#, 1000, 9, 0).unwrap();
        assert!(drop_in(&dir, "codex", "not a call", 3000, 1, 0).is_none());
        assert!(drop_in(&dir, "codex", "[1]", 3000, 1, 0).is_none());
        let calls: Vec<Value> = taken(&dir).iter().map(|t| serde_json::from_str(t).unwrap()).collect();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0]["event"]["hook_event_name"], "UserPromptSubmit");
        assert_eq!(calls[0]["source"], "claude");
        assert_eq!(calls[0]["at"], 1000);
        assert_eq!(calls[1]["event"]["hook_event_name"], "Stop");
        assert!(taken(&dir).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_call_keeps_only_what_the_window_reads_and_cuts_it_short() {
        let long = "x".repeat(5000);
        let event = json!({ "hook_event_name": "PreToolUse", "session_id": "s1", "cwd": "/w", "tool_name": "Write", "prompt": long, "transcript_path": "/secret", "last_assistant_message": "the answer", "session_title": "Fix the cart", "tool_input": { "command": long, "content": "the whole file" } });
        let k = kept(&event, MOST_COMMAND);
        assert_eq!(k["prompt"].as_str().unwrap().len(), 200);
        assert_eq!(k["tool_input"]["command"].as_str().unwrap().len(), 300);
        assert!(k["tool_input"].get("content").is_none());
        assert!(k.get("transcript_path").is_none());
        assert!(k.get("last_assistant_message").is_none());
        assert_eq!(k["tool_name"], "Write");
        assert_eq!(k["session_title"], "Fix the cart");
        // A command kept short says it was cut; one kept whole does not.
        assert_eq!(k["tool_input"]["cut"], true);
        let whole = kept_short(&json!({ "tool_name": "Bash", "tool_input": { "command": "ls -la", "file_path": "/w/src/cart.ts" } }));
        assert!(whole["tool_input"].get("cut").is_none());
        // A command given with more than itself says so; with only why and for how long, it does not.
        assert_eq!(whole["tool_input"]["odd"], true);
        assert_eq!(kept_short(&json!({ "tool_input": { "command": "ls", "dangerouslyDisableSandbox": true } }))["tool_input"]["odd"], true);
        assert!(kept_short(&json!({ "tool_input": { "command": "ls", "description": "list", "timeout": 5000, "run_in_background": false } }))["tool_input"].get("odd").is_none());
        assert!(kept_short(&json!({ "tool_input": { "file_path": "/w/a.ts", "content": "x" } }))["tool_input"].get("odd").is_none());
        assert_eq!(whole["tool_input"]["file_path"], "/w/src/cart.ts");
    }

    fn kept_short(event: &Value) -> Value {
        kept(event, MOST_COMMAND)
    }

    #[test]
    fn a_plan_is_kept_as_its_counts_and_the_step_under_way() {
        let todos = json!({ "tool_name": "TodoWrite", "tool_input": { "todos": [
            { "content": "Read the cart", "status": "completed", "activeForm": "Reading the cart" },
            { "content": "Fix the total", "status": "in_progress", "activeForm": "Fixing the total" },
            { "content": "Ship it", "status": "pending", "activeForm": "Shipping" },
        ] } });
        assert_eq!(kept_short(&todos)["tool_input"], json!({ "plan": { "total": 3, "done": 1, "now": "Fixing the total" } }));
        let task = json!({ "tool_name": "TaskUpdate", "tool_input": { "taskId": "7", "status": "in_progress", "activeForm": "Fixing the total", "description": "the long story" } });
        assert_eq!(kept_short(&task)["tool_input"], json!({ "status": "in_progress", "now": "Fixing the total" }));
    }

    #[test]
    fn only_claude_codes_requests_for_permission_wait_on_the_bubble_and_only_when_asked_for() {
        let asked = json!({ "approve": 30 });
        let request = json!({ "hook_event_name": "PermissionRequest", "tool_name": "Bash" });
        assert_eq!(waits_for("claude", &request, &asked), 30);
        assert_eq!(waits_for("claude", &request, &json!({ "approve": 0 })), 0);
        assert_eq!(waits_for("claude", &request, &json!({})), 0);
        assert_eq!(waits_for("codex", &request, &asked), 0);
        assert_eq!(waits_for("claude", &json!({ "hook_event_name": "PreToolUse", "tool_name": "Bash" }), &asked), 0);
        // A question and a plan are answered in words, not with a yes.
        assert_eq!(waits_for("claude", &json!({ "hook_event_name": "PermissionRequest", "tool_name": "AskUserQuestion" }), &asked), 0);
        assert_eq!(waits_for("claude", &json!({ "hook_event_name": "PermissionRequest", "tool_name": "ExitPlanMode" }), &asked), 0);
        // Never held longer than two minutes, whatever the file says.
        assert_eq!(waits_for("claude", &request, &json!({ "approve": 99999 })), 120);
    }

    #[test]
    fn a_waiting_request_says_so_in_its_call_and_takes_the_answer_left_for_it() {
        let dir = scratch("ask");
        let (inbox, answers) = (dir.join("inbox"), dir.join("answers"));
        drop_in(&inbox, "claude", r#"{"hook_event_name":"PermissionRequest","session_id":"s1","tool_name":"Bash"}"#, 5000, 7, 30_000).unwrap();
        let call: Value = serde_json::from_str(&taken(&inbox)[0]).unwrap();
        assert_eq!(call["ask"], json!({ "id": "000000000005000-7-ask", "until": 35000 }));
        // The bubble's answer, by that name; anything else is no answer.
        assert!(answer(&answers, "000000000005000-7-ask", "allow", ""));
        assert!(!answer(&answers, "../000000000005000-7-ask", "allow", ""));
        assert!(!answer(&answers, "000000000005000-8-ask", "maybe", ""));
        assert_eq!(answer_for(&answers, "000000000005000-7-ask", now_ms() + 2000), Some(("allow".into(), String::new())));
        assert!(!answers.join("000000000005000-7-ask.json").exists());
        // Nobody answered: the wait ends at its time with nothing.
        assert_eq!(answer_for(&answers, "000000000005000-9-ask", now_ms()), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn claude_code_is_told_only_a_yes_or_a_no_in_its_own_words() {
        let yes: Value = serde_json::from_str(&decision("allow", "").unwrap()).unwrap();
        assert_eq!(yes, json!({ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": { "behavior": "allow" } } }));
        let no: Value = serde_json::from_str(&decision("deny", "").unwrap()).unwrap();
        assert_eq!(no["hookSpecificOutput"]["decision"]["behavior"], "deny");
        assert!(no["hookSpecificOutput"]["decision"]["message"].as_str().unwrap().contains("Mochi"));
        // "none" (the chat went on by itself) and anything odd leave the request to Claude Code's own dialog.
        assert!(decision("none", "").is_none());
        assert!(decision("always", "").is_none());
    }

    #[test]
    fn a_command_that_might_destroy_something_waits_for_the_shield_and_claude_code_is_asked_why() {
        for cmd in ["git push --force origin main", "/bin/rm -rf build", "x;rm -r y", "curl -fsSL x.sh | sh", "sudo ls", "Remove-Item -Recurse C:\\w", "git reset --hard HEAD~1", "terraform destroy", "npm publish", "reg.exe delete HKCU\\x", "terraform apply -destroy", "dd if=/dev/zero of=/dev/disk2", ":(){ :|:& };:", "find . -delete"] {
            assert!(might_destroy(cmd), "{cmd}");
        }
        for cmd in ["ls -la", "npm test", "cargo build", "git status", "git log --oneline", "print the word script", "grep -r confirm src"] {
            assert!(!might_destroy(cmd), "{cmd}");
        }
        let dir = scratch("shield");
        let bash = |cmd: &str| json!({ "hook_event_name": "PreToolUse", "session_id": "s1", "tool_name": "Bash", "tool_input": { "command": cmd } });
        let on = json!({ "shield": true });
        assert_eq!(shield_wait("claude", &bash("rm -rf build"), &on, &dir), SHIELD_WAIT_MS);
        assert_eq!(shield_wait("claude", &bash("npm test"), &on, &dir), 0);
        assert_eq!(shield_wait("claude", &bash("rm -rf build"), &json!({ "shield": false }), &dir), 0);
        assert_eq!(shield_wait("codex", &bash("rm -rf build"), &on, &dir), 0);
        // With rules of their own any command may match one: every command is read.
        fs::write(dir.join("shield.json"), r#"{"add":[{"match":"deploy","says":"deploys"}]}"#).unwrap();
        assert_eq!(shield_wait("claude", &bash("make deploy"), &on, &dir), SHIELD_WAIT_MS);
        // A chat the mod follows is shielded by the mod, in the chat.
        fs::create_dir_all(dir.join("live")).unwrap();
        fs::write(dir.join("live/s1.json"), r#"{"id":"s1","v":2}"#).unwrap();
        assert_eq!(shield_wait("claude", &bash("rm -rf build"), &on, &dir), 0);
        // The shield reads the command whole, not the first 300 characters.
        let long = format!("echo {} && rm -rf /", "x".repeat(400));
        drop_in(&dir.join("inbox"), "claude", &bash(&long).to_string(), 1000, 3, SHIELD_WAIT_MS).unwrap();
        let call: Value = serde_json::from_str(&taken(&dir.join("inbox"))[0]).unwrap();
        assert!(call["event"]["tool_input"]["command"].as_str().unwrap().ends_with("rm -rf /"));
        let ask: Value = serde_json::from_str(&decision("ask", "deletes files for good").unwrap()).unwrap();
        assert_eq!(ask, json!({ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": "Mochi: deletes files for good" } }));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn connecting_an_agent_adds_mochi_once_and_leaves_everything_else_alone() {
        let theirs = json!({ "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }] }, "model": "opus", "permissions": { "allow": ["Bash(ls:*)"] } });
        let once = CLAUDE.connected(theirs.clone(), "\"/Apps/Mochi\" hook claude").unwrap();
        let twice = CLAUDE.connected(once.clone(), "\"/Apps/Mochi\" hook claude").unwrap();
        assert_eq!(once, twice);
        assert!(CLAUDE.is_connected(&once));
        assert!(!CLAUDE.is_connected(&theirs));
        // Codex's entries in a file are not Claude Code's, and the other way round.
        assert!(!CODEX.is_connected(&once));
        assert_eq!(once["model"], "opus");
        assert_eq!(once["permissions"], theirs["permissions"]);
        assert_eq!(once["hooks"]["Stop"].as_array().unwrap().len(), 2);
        assert_eq!(once["hooks"]["Stop"][0]["hooks"][0]["command"], "say done");
        assert_eq!(once["hooks"]["PreToolUse"][0]["matcher"], "*");
        // Every hook is gone in a moment but the one that may wait on the bubble, which is given longer than it ever waits.
        assert_eq!(once["hooks"]["PreToolUse"][0]["hooks"][0]["timeout"], 5);
        assert_eq!(once["hooks"]["PermissionRequest"][0]["hooks"][0]["timeout"], 130);
        assert!(once["hooks"]["PermissionRequest"][0]["hooks"][0]["timeout"].as_u64().unwrap() > MOST_WAIT_S);
        assert!(once["hooks"]["Stop"][1].get("matcher").is_none());
        assert_eq!(once["hooks"].as_object().unwrap().len(), 12);
        assert_eq!(CODEX.connected(json!({}), "x hook codex").unwrap()["hooks"].as_object().unwrap().len(), 10);
        // Taking Mochi out again leaves exactly what was there.
        assert_eq!(CLAUDE.disconnected(once).unwrap(), theirs);
        // A config that is not what the agent writes is not touched.
        assert!(CLAUDE.connected(json!([]), "x hook claude").is_none());
        assert!(CLAUDE.connected(json!({ "hooks": [] }), "x hook claude").is_none());
    }

    #[test]
    fn an_agents_file_is_kept_once_beside_itself_and_a_broken_one_is_left_alone() {
        let dir = scratch("agentfile");
        let path = dir.join("settings.json");
        // No file yet: one is made, and there is nothing to keep.
        assert!(CLAUDE.write(&path, Path::new("/Apps/Mochi Buddy"), true));
        assert!(CLAUDE.is_connected(&config_at(&path).unwrap()));
        assert!(fs::read_to_string(&path).unwrap().contains("\\\"/Apps/Mochi Buddy\\\" hook claude"));
        assert!(!dir.join("settings.json.mochi-backup").exists());
        assert!(CLAUDE.write(&path, Path::new("/Apps/Mochi Buddy"), false));
        assert!(!CLAUDE.is_connected(&config_at(&path).unwrap()));
        assert!(dir.join("settings.json.mochi-backup").exists());
        // Kept once: the file as it was before Mochi first touched it, not as it was before the last change.
        let first = fs::read_to_string(dir.join("settings.json.mochi-backup")).unwrap();
        assert!(first.contains("hook claude"));
        assert!(CLAUDE.write(&path, Path::new("/Apps/Mochi Buddy"), true));
        assert_eq!(fs::read_to_string(dir.join("settings.json.mochi-backup")).unwrap(), first);
        fs::write(&path, "{ broken").unwrap();
        assert!(!CLAUDE.write(&path, Path::new("/Apps/Mochi Buddy"), true));
        assert_eq!(fs::read_to_string(&path).unwrap(), "{ broken");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_settings_file_keeps_its_keys_in_the_order_the_person_had_them() {
        let dir = scratch("order");
        let path = dir.join("settings.json");
        fs::write(&path, "{\n  \"model\": \"opus\",\n  \"env\": { \"ZED\": \"1\", \"ABC\": \"2\" },\n  \"alwaysThinkingEnabled\": true\n}\n").unwrap();
        assert!(CLAUDE.write(&path, Path::new("/Apps/Mochi"), true));
        let text = fs::read_to_string(&path).unwrap();
        let at = |key: &str| text.find(key).unwrap();
        assert!(at("\"model\"") < at("\"env\"") && at("\"env\"") < at("\"alwaysThinkingEnabled\"") && at("\"alwaysThinkingEnabled\"") < at("\"hooks\""));
        assert!(at("\"ZED\"") < at("\"ABC\""));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn entries_in_an_older_form_are_written_again_and_a_file_without_mochi_is_left_alone() {
        let dir = scratch("refresh");
        let path = dir.join("settings.json");
        // As an earlier version left it: the hook that waits given only five seconds.
        let old = json!({ "model": "opus", "hooks": { "PermissionRequest": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "\"/Apps/Mochi\" hook claude", "timeout": 5 }] }] } });
        fs::write(&path, old.to_string()).unwrap();
        CLAUDE.refresh(&path, Path::new("/Apps/Mochi"));
        let now = config_at(&path).unwrap();
        assert_eq!(now["hooks"]["PermissionRequest"][0]["hooks"][0]["timeout"], 130);
        assert_eq!(now["hooks"].as_object().unwrap().len(), 12);
        assert_eq!(now["model"], "opus");
        // Already as it should be: not written again.
        let text = fs::read_to_string(&path).unwrap();
        CLAUDE.refresh(&path, Path::new("/Apps/Mochi"));
        assert_eq!(fs::read_to_string(&path).unwrap(), text);
        // Never connected: never touched.
        let other = dir.join("other.json");
        fs::write(&other, "{\"model\":\"opus\"}").unwrap();
        CLAUDE.refresh(&other, Path::new("/Apps/Mochi"));
        assert_eq!(fs::read_to_string(&other).unwrap(), "{\"model\":\"opus\"}");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_status_line_call_keeps_the_numbers_of_the_chat_and_nothing_else() {
        let call = json!({
            "hook_event_name": "StatusLine", "session_id": "s1", "session_name": "Fix the cart", "transcript_path": "/secret",
            "context_window": { "used_percentage": 41.6 }, "cost": { "total_cost_usd": 1.2345 },
            "rate_limits": { "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 }, "seven_day": { "used_percentage": 141.2, "resets_at": 1738857600 } },
        });
        let k = kept(&call, MOST_COMMAND);
        assert_eq!(k["status"], json!({ "context": 42, "cost": 1.23, "windows": [
            { "kind": "five_hour", "p": 24, "resetsAt": 1_738_425_600_000u64 },
            { "kind": "seven_day", "p": 100, "resetsAt": 1_738_857_600_000u64 },
        ] }));
        assert!(k.get("transcript_path").is_none());
        // Before the first answer Claude Code knows no limits: none are made up.
        assert_eq!(kept_short(&json!({ "hook_event_name": "StatusLine", "session_id": "s1" }))["status"], json!({}));
        assert!(kept_short(&json!({ "hook_event_name": "Stop", "rate_limits": {} })).get("status").is_none());
    }

    #[test]
    fn mochi_takes_the_status_line_and_gives_the_persons_own_back_as_it_was() {
        let dir = scratch("line");
        let (settings, kept_line, exe) = (dir.join("settings.json"), dir.join("statusline.json"), Path::new("/Apps/Mochi Buddy"));
        let theirs = json!({ "model": "opus", "statusLine": { "type": "command", "command": "~/.claude/line.sh", "padding": 2 }, "hooks": {} });
        fs::write(&settings, serde_json::to_string_pretty(&theirs).unwrap()).unwrap();
        assert_eq!(line_state(&settings), "off");
        assert!(set_line(&settings, &kept_line, exe, true));
        assert_eq!(line_state(&settings), "on");
        let now = config_at(&settings).unwrap();
        assert_eq!(now["statusLine"], json!({ "type": "command", "command": "\"/Apps/Mochi Buddy\" statusline", "padding": 2 }));
        assert_eq!(now["model"], "opus");
        // Their line is kept to go on being shown, and connecting twice keeps it, not Mochi's own.
        assert!(set_line(&settings, &kept_line, exe, true));
        assert_eq!(serde_json::from_str::<Value>(&fs::read_to_string(&kept_line).unwrap()).unwrap(), theirs["statusLine"]);
        assert!(set_line(&settings, &kept_line, exe, false));
        assert_eq!(config_at(&settings).unwrap(), theirs);
        assert!(!kept_line.exists());
        assert!(dir.join("settings.json.mochi-backup").exists());

        // Someone with no status line of their own has none again afterwards.
        fs::write(&settings, "{\"model\":\"opus\"}").unwrap();
        assert!(set_line(&settings, &kept_line, exe, true));
        assert!(!kept_line.exists());
        assert!(set_line(&settings, &kept_line, exe, false));
        assert_eq!(config_at(&settings).unwrap(), json!({ "model": "opus" }));
        // Settings that cannot be read are left alone.
        fs::write(&settings, "{ broken").unwrap();
        assert_eq!(line_state(&settings), "broken");
        assert!(!set_line(&settings, &kept_line, exe, true));
        assert_eq!(fs::read_to_string(&settings).unwrap(), "{ broken");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_line_of_their_own_that_ends_in_statusline_is_still_theirs() {
        let dir = scratch("theirline");
        let (settings, kept_line, exe) = (dir.join("settings.json"), dir.join("statusline.json"), Path::new("/Apps/Mochi Buddy"));
        let theirs = json!({ "statusLine": { "type": "command", "command": "bun x ccusage statusline" } });
        fs::write(&settings, theirs.to_string()).unwrap();
        assert_eq!(line_state(&settings), "off");
        assert!(set_line(&settings, &kept_line, exe, true));
        assert_eq!(serde_json::from_str::<Value>(&fs::read_to_string(&kept_line).unwrap()).unwrap(), theirs["statusLine"]);
        assert!(set_line(&settings, &kept_line, exe, false));
        assert_eq!(config_at(&settings).unwrap(), theirs);
        // Mochi's own line from where the app was before is still Mochi's.
        assert!(is_ours("\"/Old/mochi-desktop\" statusline"));
        assert!(!is_ours("\"/usr/local/bin/ccusage\" statusline"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn their_line_kept_but_unreadable_is_never_taken_away() {
        let dir = scratch("keptbroken");
        let (settings, kept_line, exe) = (dir.join("settings.json"), dir.join("statusline.json"), Path::new("/Apps/Mochi Buddy"));
        fs::write(&settings, json!({ "statusLine": { "type": "command", "command": "~/line.sh" } }).to_string()).unwrap();
        assert!(set_line(&settings, &kept_line, exe, true));
        fs::write(&kept_line, "{ half").unwrap();
        let before = fs::read_to_string(&settings).unwrap();
        assert!(!set_line(&settings, &kept_line, exe, false));
        assert_eq!(fs::read_to_string(&settings).unwrap(), before);
        assert!(kept_line.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn codex_keeps_the_backup_name_it_had() {
        // The first version kept Codex's file as hooks.json.mochi-backup; a second backup under another name would hide it.
        let dir = scratch("codexfile");
        let path = dir.join("hooks.json");
        fs::write(&path, "{}").unwrap();
        assert!(CODEX.write(&path, Path::new("/Apps/Mochi"), true));
        assert!(dir.join("hooks.json.mochi-backup").exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}
