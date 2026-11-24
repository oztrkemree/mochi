// No console window behind the app on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `mochi-desktop hook <source>` is what an agent's hooks run: it takes the call and is gone, no window.
    let mut args = std::env::args().skip(1);
    match args.next().as_deref() {
        Some("hook") => return mochi_desktop_lib::hook(&args.next().unwrap_or_default()),
        // `mochi-desktop statusline` is what Claude Code runs for its status line, when the person made Mochi's theirs.
        Some("statusline") => return mochi_desktop_lib::statusline(),
        _ => {}
    }
    mochi_desktop_lib::run()
}
