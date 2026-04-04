use crate::commands::SessionsState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Manager, Wry};

/// Build the app menu bar with a Sessions submenu and register event handler.
pub fn setup_app_menu(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_app_menu(app)?;
    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| {
        let id = event.id().as_ref();
        if let Some(session_id) = id.strip_prefix("menu-session:") {
            let state = app.state::<SessionsState>();
            if let Err(e) = crate::tray::connect_or_focus_sync(app, &state, session_id) {
                tracing::error!("Failed to connect session from menu: {}", e);
            }
        }
    });

    Ok(())
}

fn build_app_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<Wry>> {
    let state = app.state::<SessionsState>();
    let sessions = state.sessions.read().unwrap();
    let running = state.running.read().unwrap();

    let mut sessions_submenu = SubmenuBuilder::new(app, "Sessions");

    for session in sessions.iter() {
        let is_connected = running.contains_key(&session.id);
        let prefix = if is_connected { "● " } else { "○ " };
        let label = format!("{}{}", prefix, session.name);
        let item_id = format!("menu-session:{}", session.id);

        let item = MenuItemBuilder::with_id(item_id, label)
            .enabled(true)
            .build(app)?;
        sessions_submenu = sessions_submenu.item(&item);
    }

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&edit_submenu)
        .item(&sessions_submenu.build()?)
        .build()?;

    Ok(menu)
}

/// Rebuild the app menu (call after session state changes).
pub fn rebuild_app_menu(app: &AppHandle) {
    if let Ok(menu) = build_app_menu(app) {
        app.set_menu(menu).ok();
    }
}
