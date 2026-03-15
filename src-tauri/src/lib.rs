mod daemon;
mod tray;

use daemon::{DaemonInfo, SharedDaemon};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

// ── Tauri Commands ──────────────────────────────────────────────────

#[tauri::command]
fn start_daemon(state: tauri::State<SharedDaemon>, app: tauri::AppHandle) -> Result<(), String> {
    daemon::spawn_daemon(&state, &app)
}

#[tauri::command]
fn stop_daemon(state: tauri::State<SharedDaemon>, app: tauri::AppHandle) -> Result<(), String> {
    daemon::stop_daemon(&state, &app)
}

#[tauri::command]
fn restart_daemon(state: tauri::State<SharedDaemon>, app: tauri::AppHandle) -> Result<(), String> {
    daemon::restart_daemon(&state, &app)
}

#[tauri::command]
fn daemon_status(state: tauri::State<SharedDaemon>) -> DaemonInfo {
    daemon::get_status(&state)
}

#[tauri::command]
fn set_always_on_top(window: tauri::WebviewWindow, value: bool) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

// ── App Setup ───────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env.local from project root
    let env_path = "C:/Users/Kruz/Desktop/Projects/nexus/.env.local";
    if let Ok(content) = std::fs::read_to_string(env_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim();
                let val = val.trim().trim_matches('"').trim_matches('\'');
                if std::env::var(key).is_err() {
                    std::env::set_var(key, val);
                }
            }
        }
    }

    let daemon_state: SharedDaemon = Arc::new(Mutex::new(daemon::DaemonState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(daemon_state.clone())
        .invoke_handler(tauri::generate_handler![
            start_daemon,
            stop_daemon,
            restart_daemon,
            daemon_status,
            set_always_on_top,
        ])
        .setup(move |app| {
            // Setup system tray
            if let Err(e) = tray::setup(app.handle()) {
                eprintln!("Failed to setup tray: {}", e);
            }

            // Auto-start daemon
            let state = app.state::<SharedDaemon>().inner().clone();
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                if let Err(e) = daemon::spawn_daemon(&state, &handle) {
                    eprintln!("Failed to auto-start daemon: {}", e);
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Nexus");
}
