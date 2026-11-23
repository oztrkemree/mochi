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
fn kept(event: &Value) -> Value {
    let short = |v: &Value, max: usize| v.as_str().map(|s| Value::from(s.chars().take(max).collect::<String>()));
    let mut out = serde_json::Map::new();
    for (key, max) in [("hook_event_name", 40), ("session_id", 120), ("cwd", 400), ("tool_name", 80), ("prompt", 200), ("notification_type", 40), ("agent_id", 80), ("agent_type", 40), ("session_title", 60)] {
        if let Some(v) = short(&event[key], max) {
            out.insert(key.into(), v);
        }
    }
    // Of what a tool is given, only what tells a test or a commit, and what a person must see to answer for it: the command, or the file.
    let mut input = serde_json::Map::new();
    if let Some(command) = event["tool_input"]["command"].as_str() {
        input.insert("command".into(), short(&event["tool_input"]["command"], MOST_COMMAND).unwrap_or_default());
        // Said when the command is longer than what is kept: nobody may answer for a command they saw part of.
        if command.chars().count() > MOST_COMMAND {
            input.insert("cut".into(), json!(true));
        }
    }
    if let Some(path) = short(&event["tool_input"]["file_path"], 300) {
        input.insert("file_path".into(), path);
    }
    if !input.is_empty() {
        out.insert("tool_input".into(), Value::Object(input));
    }
    Value::Object(out)
}

/// As much of a shell command as is kept.
const MOST_COMMAND: usize = 300;

/// One hook call into the inbox, named so the calls sort by time; nothing for input that is not a call.
/// `wait_s` is for how long the call waits for an answer from Mochi's bubble (0: it does not): the call then says so, with the name to answer it by.
fn drop_in(dir: &Path, source: &str, input: &str, at: u128, pid: u32, wait_s: u64) -> Option<PathBuf> {
    let event: Value = serde_json::from_str(input).ok()?;
    if !event.is_object() {
        return None;
    }
    let name = format!("{at:015}-{pid}");
    let mut call = json!({ "source": source, "at": at as u64, "event": kept(&event) });
    if wait_s > 0 {
        call["ask"] = json!({ "id": name, "until": at as u64 + wait_s * 1000 });
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
    if is_request { beat["approve"].as_u64().unwrap_or(0).min(120) } else { 0 }
}

/// What Claude Code is told for an answer: its own words for a granted or a refused request. None for no answer, which leaves the request to Claude Code's own dialog.
fn decision(answer: &str) -> Option<String> {
    let decision = match answer {
        "allow" => json!({ "behavior": "allow" }),
        "deny" => json!({ "behavior": "deny", "message": "Denied from Mochi, on the desktop." }),
        _ => return None,
    };
    Some(json!({ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": decision } }).to_string())
}

/// Waits for the bubble's answer to one request, until `until`; the answer's file is taken away once read.
fn answer_for(answers: &Path, id: &str, until: u128) -> Option<String> {
    let path = answers.join(format!("{id}.json"));
    loop {
        if let Ok(text) = fs::read_to_string(&path) {
            let _ = fs::remove_file(&path);
            return serde_json::from_str::<Value>(&text).ok().and_then(|v| v["behavior"].as_str().map(str::to_owned));
        }
        if now_ms() >= until {
            return None;
        }
        thread::sleep(Duration::from_millis(80));
    }
}

/// The bubble's answer to a request, left for the hook that waits on it. Only a name the hook could have given, and only one of the three answers.
pub fn answer(answers: &Path, id: &str, behavior: &str) -> bool {
    is_id(id) && ["allow", "deny", "none"].contains(&behavior) && write_whole(&answers.join(format!("{id}.json")), &json!({ "behavior": behavior }).to_string())
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
    let (at, pid, wait_s) = (now_ms(), std::process::id(), waits_for(source, &event, &beat));
    if drop_in(&dir.join("inbox"), source, &input, at, pid, wait_s).is_none() || wait_s == 0 {
        return;
    }
    if let Some(text) = answer_for(&dir.join("answers"), &format!("{at:015}-{pid}"), at + u128::from(wait_s) * 1000).as_deref().and_then(decision) {
        println!("{text}");
    }
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
            let mut group = json!({ "hooks": [{ "type": "command", "command": command, "timeout": 5 }] });
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

    /// Adds or takes out Mochi's entries in the agent's file. The file as it was is kept once beside it; a file this cannot read is left alone.
    pub fn write(&self, path: &Path, exe: &Path, on: bool) -> bool {
        let Some(config) = config_at(path) else { return false };
        let Some(next) = (if on { self.connected(config, &self.command(exe)) } else { self.disconnected(config) }) else { return false };
        let backup = PathBuf::from(format!("{}.mochi-backup", path.display()));
        if path.exists() && !backup.exists() && fs::copy(path, &backup).is_err() {
            return false;
        }
        serde_json::to_string_pretty(&next).is_ok_and(|text| write_theirs(path, &(text + "\n")))
    }
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
        write_whole(&dir.join("app.json"), &beat_text(now_ms(), true, 0));
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
        let k = kept(&event);
        assert_eq!(k["prompt"].as_str().unwrap().len(), 200);
        assert_eq!(k["tool_input"]["command"].as_str().unwrap().len(), 300);
        assert!(k["tool_input"].get("content").is_none());
        assert!(k.get("transcript_path").is_none());
        assert!(k.get("last_assistant_message").is_none());
        assert_eq!(k["tool_name"], "Write");
        assert_eq!(k["session_title"], "Fix the cart");
        // A command kept short says it was cut; one kept whole does not.
        assert_eq!(k["tool_input"]["cut"], true);
        let whole = kept(&json!({ "tool_name": "Bash", "tool_input": { "command": "ls -la", "file_path": "/w/src/cart.ts" } }));
        assert!(whole["tool_input"].get("cut").is_none());
        assert_eq!(whole["tool_input"]["file_path"], "/w/src/cart.ts");
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
        drop_in(&inbox, "claude", r#"{"hook_event_name":"PermissionRequest","session_id":"s1","tool_name":"Bash"}"#, 5000, 7, 30).unwrap();
        let call: Value = serde_json::from_str(&taken(&inbox)[0]).unwrap();
        assert_eq!(call["ask"], json!({ "id": "000000000005000-7", "until": 35000 }));
        // The bubble's answer, by that name; anything else is no answer.
        assert!(answer(&answers, "000000000005000-7", "allow"));
        assert!(!answer(&answers, "../000000000005000-7", "allow"));
        assert!(!answer(&answers, "000000000005000-8", "maybe"));
        assert_eq!(answer_for(&answers, "000000000005000-7", now_ms() + 2000).as_deref(), Some("allow"));
        assert!(!answers.join("000000000005000-7.json").exists());
        // Nobody answered: the wait ends at its time with nothing.
        assert_eq!(answer_for(&answers, "000000000005000-9", now_ms()), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn claude_code_is_told_only_a_yes_or_a_no_in_its_own_words() {
        let yes: Value = serde_json::from_str(&decision("allow").unwrap()).unwrap();
        assert_eq!(yes, json!({ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": { "behavior": "allow" } } }));
        let no: Value = serde_json::from_str(&decision("deny").unwrap()).unwrap();
        assert_eq!(no["hookSpecificOutput"]["decision"]["behavior"], "deny");
        assert!(no["hookSpecificOutput"]["decision"]["message"].as_str().unwrap().contains("Mochi"));
        // "none" (the chat went on by itself) and anything odd leave the request to Claude Code's own dialog.
        assert!(decision("none").is_none());
        assert!(decision("always").is_none());
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
