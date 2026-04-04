use crate::commands::SessionsState;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

/// Set up the system tray icon with a dynamic session menu.
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_tray_menu(app)?;

    TrayIconBuilder::with_id("sessions-tray")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            if id == "settings" {
                open_settings_window(app);
            } else if id == "quit" {
                app.exit(0);
            } else if let Some(session_id) = id.strip_prefix("session-connect:") {
                let state = app.state::<SessionsState>();
                if let Err(e) = connect_or_focus_sync(app, &state, session_id) {
                    tracing::error!("Failed to connect session: {}", e);
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Build the tray menu from current session state.
fn build_tray_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<Wry>> {
    let state = app.state::<SessionsState>();
    let sessions = state.sessions.read().unwrap();
    let running = state.running.read().unwrap();

    let mut builder = MenuBuilder::new(app);

    for session in sessions.iter() {
        let is_connected = running.contains_key(&session.id);
        let prefix = if is_connected { "● " } else { "○ " };
        let label = format!("{}{}", prefix, session.name);
        let item_id = format!("session-connect:{}", session.id);

        let item = MenuItemBuilder::with_id(item_id, label)
            .enabled(true)
            .build(app)?;
        builder = builder.item(&item);
    }

    builder = builder.separator();

    let settings = MenuItemBuilder::with_id("settings", "Settings...")
        .build(app)?;
    builder = builder.item(&settings);

    let quit = MenuItemBuilder::with_id("quit", "Quit")
        .build(app)?;
    builder = builder.item(&quit);

    builder.build()
}

/// Rebuild the tray menu (call after session state changes).
pub fn rebuild_tray_menu(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id("sessions-tray") {
        if let Ok(menu) = build_tray_menu(app) {
            tray.set_menu(Some(menu)).ok();
        }
    }
}

pub fn connect_or_focus_sync(
    app: &AppHandle,
    state: &SessionsState,
    session_id: &str,
) -> crate::error::Result<()> {
    let (label, url, session_type, session_name) = {
        let sessions = state.sessions.read().unwrap();
        let session = sessions
            .iter()
            .find(|s| s.id == session_id)
            .ok_or_else(|| crate::error::Error::SessionNotFound(session_id.to_string()))?;
        (
            session.window_label(),
            session.url(),
            session.session_type.clone(),
            session.name.clone(),
        )
    };

    // If window already exists, focus it
    if let Some(win) = app.get_webview_window(&label) {
        win.set_focus()?;
        return Ok(());
    }

    match &session_type {
        crate::models::SessionType::Local { .. } => {
            let _window = tauri::WebviewWindowBuilder::new(
                app, &label, tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title(format!("Super Terminal — {}", session_name))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            let mut running = state.running.write().unwrap();
            running.insert(session_id.to_string(), crate::commands::RunningSession::Local);
        }

        crate::models::SessionType::Http { .. } => {
            let _window = tauri::WebviewWindowBuilder::new(
                app, &label, tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title(format!("Super Terminal — {}", session_name))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            let mut running = state.running.write().unwrap();
            running.insert(session_id.to_string(), crate::commands::RunningSession::Http);
        }

        crate::models::SessionType::Ssh { ref ssh_host, ssh_port, remote_port, local_port, ref identity_file } => {
            crate::ssh::setup_remote(ssh_host, *ssh_port, *remote_port, identity_file.as_deref())?;
            let child = crate::ssh::spawn_tunnel(ssh_host, *ssh_port, *remote_port, *local_port, identity_file.as_deref())?;
            std::thread::sleep(std::time::Duration::from_secs(2));

            let _window = tauri::WebviewWindowBuilder::new(
                app, &label, tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title(format!("Super Terminal — {}", session_name))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            let mut running = state.running.write().unwrap();
            running.insert(session_id.to_string(), crate::commands::RunningSession::Ssh { child });
        }
    }

    rebuild_tray_menu(app);
    Ok(())
}

fn open_settings_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("sessions-settings") {
        win.set_focus().ok();
        return;
    }

    tauri::WebviewWindowBuilder::new(
        app,
        "sessions-settings",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Super Terminal — Sessions")
    .inner_size(600.0, 400.0)
    .resizable(true)
    .build()
    .ok();
}
