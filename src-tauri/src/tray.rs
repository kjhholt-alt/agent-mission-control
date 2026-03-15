use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::daemon::{self, SharedDaemon};

pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state: tauri::State<SharedDaemon> = app.state();
    let status = daemon::get_status(&state);
    let status_text = format!("Daemon: {:?}", status.status);

    // Build menu items
    let show = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let daemon_status = MenuItem::with_id(app, "daemon_status", &status_text, false, None::<&str>)?;
    let start = MenuItem::with_id(app, "start_daemon", "Start Daemon", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop_daemon", "Stop Daemon", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart_daemon", "Restart Daemon", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let browser = MenuItem::with_id(app, "open_browser", "Open in Browser", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Nexus", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &sep1,
            &daemon_status,
            &start,
            &stop,
            &restart,
            &sep2,
            &browser,
            &quit,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("NEXUS — Agent Command Center")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| {
            let state: tauri::State<SharedDaemon> = app.state();
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "start_daemon" => {
                    let _ = daemon::spawn_daemon(&state, app);
                }
                "stop_daemon" => {
                    let _ = daemon::stop_daemon(&state, app);
                }
                "restart_daemon" => {
                    let _ = daemon::restart_daemon(&state, app);
                }
                "open_browser" => {
                    #[cfg(target_os = "windows")]
                    let _ = std::process::Command::new("cmd")
                        .args(["/c", "start", "https://nexus.buildkit.store"])
                        .spawn();
                }
                "quit" => {
                    let _ = daemon::stop_daemon(&state, app);
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
