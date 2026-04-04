mod commands;
mod error;
mod menu;
mod models;
pub mod ssh;
mod storage;
mod tray;

pub use models::{Session, SessionType};

use commands::SessionsState;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Wry};

pub fn init() -> TauriPlugin<Wry> {
    Builder::new("sessions")
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::create_session,
            commands::update_session,
            commands::delete_session,
            commands::connect_session,
        ])
        .setup(|app, _api| {
            let state = SessionsState::load().unwrap_or_else(|e| {
                tracing::error!("Failed to load sessions: {}", e);
                SessionsState {
                    sessions: std::sync::RwLock::new(Vec::new()),
                    running: std::sync::RwLock::new(std::collections::HashMap::new()),
                }
            });
            app.manage(state);

            tray::setup_tray(app).unwrap_or_else(|e| {
                tracing::error!("Failed to setup tray: {}", e);
            });

            menu::setup_app_menu(app).unwrap_or_else(|e| {
                tracing::error!("Failed to setup app menu: {}", e);
            });

            Ok(())
        })
        .build()
}
