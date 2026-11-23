//! Mochi's window: over the other windows, and out of the way of every press that is not on Mochi.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, WebviewWindow};

/// macOS keeps a window off the screen an app fills unless the window says it belongs there too; and only the status level stands over it.
#[cfg(target_os = "macos")]
fn stand_over_full_screen(window: &WebviewWindow, on: bool, is_shown: bool) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
    let Ok(pointer) = window.ns_window() else { return };
    // SAFETY: the pointer is Tauri's own live NSWindow, and this runs on the main thread.
    let ns_window: &NSWindow = unsafe { &*(pointer as *const NSWindow) };
    #[allow(unused_unsafe)]
    unsafe {
        ns_window.setCollectionBehavior(NSWindowCollectionBehavior::CanJoinAllSpaces | NSWindowCollectionBehavior::FullScreenAuxiliary | NSWindowCollectionBehavior::Stationary);
        // 25 is the status level, over the windows of an app that fills the screen; 0 is an ordinary window's.
        ns_window.setLevel(if on { 25 } else { 0 });
        // A window keeps the spaces it had when it came to the screen: it comes again to take the new ones.
        // Whether it is on screen is asked of the app, not of the window: a window just told to show may not be up yet,
        // and the system's own way of bringing it up leaves it off a screen another app fills.
        if is_shown {
            ns_window.orderOut(None);
            ns_window.orderFrontRegardless();
        }
    }
}

/// Whether Mochi stays over the other windows, as the person last set it; on until the window says otherwise.
pub static ON_TOP: AtomicBool = AtomicBool::new(true);

pub fn stand(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    let on = ON_TOP.load(Ordering::Relaxed);
    let _ = window.set_always_on_top(on);
    #[cfg(target_os = "macos")]
    {
        let same = window.clone();
        let is_shown = SHOWN.load(Ordering::Relaxed);
        let _ = window.run_on_main_thread(move || stand_over_full_screen(&same, on, is_shown));
    }
}

// ---------- presses pass through all of the window but Mochi ----------

/// Where a press is the window's own: Mochi, and what it says. Each is x, y, width, height in the window's own points.
static HOT: Mutex<Vec<[f64; 4]>> = Mutex::new(Vec::new());

pub fn set_hot(rects: Vec<[f64; 4]>) {
    *HOT.lock().unwrap_or_else(|e| e.into_inner()) = rects.into_iter().take(16).collect();
}

/// Whether a point of the window, in its own points, is on Mochi or on what it says.
fn is_over(rects: &[[f64; 4]], x: f64, y: f64) -> bool {
    rects.iter().any(|[rx, ry, w, h]| x >= *rx && x < rx + w && y >= *ry && y < ry + h)
}

/// Where the window stands, as the system last said: its top left corner in pixels, its screen's scale, and the main screen's.
#[derive(Clone, Copy)]
struct Frame {
    x: f64,
    y: f64,
    scale: f64,
    main_scale: f64,
}

/// Kept from when the window last moved, so a look at the pointer asks the system for the pointer alone.
static FRAME: Mutex<Option<Frame>> = Mutex::new(None);
/// Whether Mochi is on screen; hidden, nobody looks at the pointer.
static SHOWN: AtomicBool = AtomicBool::new(false);

pub fn set_shown(on: bool) {
    SHOWN.store(on, Ordering::Relaxed);
}

/// Reads where the window stands: when it shows, and whenever it moves or its screen changes.
pub fn measure(window: &tauri::Window) {
    let frame = match (window.outer_position(), window.scale_factor()) {
        (Ok(at), Ok(scale)) => {
            let main_scale = window.primary_monitor().ok().flatten().map(|m| m.scale_factor()).unwrap_or(scale);
            Some(Frame { x: at.x as f64, y: at.y as f64, scale, main_scale })
        }
        _ => None,
    };
    *FRAME.lock().unwrap_or_else(|e| e.into_inner()) = frame;
}

/// The pointer as a point of the window, in the window's own points.
/// On macOS every screen shares one layout in points: the system gives the pointer in pixels at the main screen's scale
/// and the window in pixels at its own, so each goes back to points before they are compared. Elsewhere every screen shares pixels.
fn within(cursor: (f64, f64), f: &Frame, is_mac: bool) -> (f64, f64) {
    let k = |scale: f64| if scale > 0.0 { scale } else { 1.0 };
    if is_mac {
        (cursor.0 / k(f.main_scale) - f.x / k(f.scale), cursor.1 / k(f.main_scale) - f.y / k(f.scale))
    } else {
        ((cursor.0 - f.x) / k(f.scale), (cursor.1 - f.y) / k(f.scale))
    }
}

/// Whether the pointer is on Mochi now. When the system will not say where things are, it is: a Mochi that cannot be pressed is worse than one in the way.
fn is_pointed_at(app: &AppHandle) -> bool {
    let frame = *FRAME.lock().unwrap_or_else(|e| e.into_inner());
    let (Some(frame), Ok(cursor)) = (frame, app.cursor_position()) else { return true };
    let (x, y) = within((cursor.x, cursor.y), &frame, cfg!(target_os = "macos"));
    is_over(&HOT.lock().unwrap_or_else(|e| e.into_inner()), x, y)
}

/// One look at the pointer: the window takes presses while it is on Mochi and lets them through to what is behind the rest of the time.
/// `was` is what the window was last told, so it is told only of a change.
pub fn follow_pointer(app: &AppHandle, was: &mut Option<bool>) {
    if !SHOWN.load(Ordering::Relaxed) {
        return;
    }
    let over = is_pointed_at(app);
    if *was == Some(over) {
        return;
    }
    if app.get_webview_window("main").is_some_and(|w| w.set_ignore_cursor_events(!over).is_ok()) {
        *was = Some(over);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_press_is_mochis_only_on_mochi_or_its_bubble() {
        let rects = [[200.0, 150.0, 100.0, 100.0], [60.0, 20.0, 240.0, 60.0]];
        assert!(is_over(&rects, 250.0, 200.0));
        assert!(is_over(&rects, 60.0, 20.0));
        assert!(!is_over(&rects, 300.0, 200.0));
        assert!(!is_over(&rects, 10.0, 10.0));
        assert!(!is_over(&rects, 100.0, 120.0));
        assert!(!is_over(&[], 250.0, 200.0));
    }

    #[test]
    fn the_pointer_is_placed_in_the_windows_own_points() {
        // Windows: a window at (2000, 1000) pixels on a 2x screen, the pointer 300 pixels in is 150 points in.
        let f = Frame { x: 2000.0, y: 1000.0, scale: 2.0, main_scale: 1.0 };
        assert_eq!(within((2300.0, 1100.0), &f, false), (150.0, 50.0));
        // macOS, one 2x screen: both come in pixels at 2x.
        let f = Frame { x: 2000.0, y: 1000.0, scale: 2.0, main_scale: 2.0 };
        assert_eq!(within((2300.0, 1100.0), &f, true), (150.0, 50.0));
        // macOS, the window on a 1x screen beside a 2x main one: the window at point 3000 comes as 3000 pixels, the pointer at point 3100 as 6200.
        let f = Frame { x: 3000.0, y: 400.0, scale: 1.0, main_scale: 2.0 };
        assert_eq!(within((6200.0, 900.0), &f, true), (100.0, 50.0));
        // A scale the system got wrong is taken as 1, not divided by.
        let f = Frame { x: 0.0, y: 0.0, scale: 0.0, main_scale: 0.0 };
        assert_eq!(within((10.0, 10.0), &f, true), (10.0, 10.0));
        assert_eq!(within((10.0, 10.0), &f, false), (10.0, 10.0));
    }
}
