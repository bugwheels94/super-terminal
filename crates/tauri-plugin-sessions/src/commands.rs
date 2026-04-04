use crate::error::{Error, Result};
use crate::models::{Session, SessionType};
use crate::storage;
use std::collections::HashMap;
use std::process::Child;
use std::sync::RwLock;
use tauri::{AppHandle, Manager, State};

pub struct SessionsState {
    pub sessions: RwLock<Vec<Session>>,
    pub running: RwLock<HashMap<String, RunningSession>>,
}

pub enum RunningSession {
    Local,
    Http,
    Ssh { child: Child },
}

impl SessionsState {
    pub fn load() -> Result<Self> {
        let sessions = storage::load_sessions().unwrap_or_default();
        Ok(Self {
            sessions: RwLock::new(sessions),
            running: RwLock::new(HashMap::new()),
        })
    }

    fn save(&self) -> Result<()> {
        let sessions = self.sessions.read().unwrap();
        storage::save_sessions(&sessions)
    }
}

#[tauri::command]
pub fn list_sessions(state: State<'_, SessionsState>) -> std::result::Result<Vec<Session>, Error> {
    let sessions = state.sessions.read().unwrap();
    Ok(sessions.clone())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionArgs {
    pub name: String,
    pub session_type: SessionType,
}

#[tauri::command]
pub fn create_session(
    state: State<'_, SessionsState>,
    args: CreateSessionArgs,
) -> std::result::Result<Session, Error> {
    let session = Session {
        id: uuid::Uuid::new_v4().to_string(),
        name: args.name,
        session_type: args.session_type,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    {
        let mut sessions = state.sessions.write().unwrap();
        sessions.push(session.clone());
    }
    state.save()?;

    Ok(session)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionArgs {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_type: Option<SessionType>,
}

#[tauri::command]
pub fn update_session(
    state: State<'_, SessionsState>,
    args: UpdateSessionArgs,
) -> std::result::Result<Session, Error> {
    let mut sessions = state.sessions.write().unwrap();
    let session = sessions
        .iter_mut()
        .find(|s| s.id == args.id)
        .ok_or_else(|| Error::SessionNotFound(args.id.clone()))?;

    if let Some(name) = args.name {
        session.name = name;
    }
    if let Some(session_type) = args.session_type {
        session.session_type = session_type;
    }

    let updated = session.clone();
    drop(sessions);
    state.save()?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_session(
    app: AppHandle,
    state: State<'_, SessionsState>,
    id: String,
) -> std::result::Result<(), Error> {
    // Close the session window if open
    let label = format!("session_{}", id.replace('-', ""));
    if let Some(win) = app.get_webview_window(&label) {
        win.close()?;
    }

    {
        let mut sessions = state.sessions.write().unwrap();
        sessions.retain(|s| s.id != id);
    }

    // Clean up running session
    {
        let mut running = state.running.write().unwrap();
        if let Some(mut entry) = running.remove(&id) {
            match &mut entry {
                RunningSession::Local => {},
                RunningSession::Ssh { child } => crate::ssh::kill_tunnel(child),
                RunningSession::Http => {},
            }
        }
    }

    state.save()?;
    Ok(())
}

#[tauri::command]
pub async fn connect_session(
    app: AppHandle,
    state: State<'_, SessionsState>,
    id: String,
) -> std::result::Result<String, Error> {
    let (label, url, session_type, session_name) = {
        let sessions = state.sessions.read().unwrap();
        let session = sessions
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| Error::SessionNotFound(id.clone()))?;
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
        return Ok(url);
    }

    match &session_type {
        SessionType::Local { .. } => {
            let _window = tauri::WebviewWindowBuilder::new(
                &app,
                &label,
                tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title(format!("Super Terminal — {}", session_name))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            let mut running = state.running.write().unwrap();
            running.insert(id, RunningSession::Local);
        }

        SessionType::Http { .. } => {
            let _window = tauri::WebviewWindowBuilder::new(
                &app,
                &label,
                tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title(format!("Super Terminal — {}", session_name))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            let mut running = state.running.write().unwrap();
            running.insert(id, RunningSession::Http);
        }

        SessionType::Ssh { ssh_host, ssh_port, remote_port, local_port, identity_file } => {
            crate::ssh::setup_remote(ssh_host, *ssh_port, *remote_port, identity_file.as_deref())?;
            let child = crate::ssh::spawn_tunnel(ssh_host, *ssh_port, *remote_port, *local_port, identity_file.as_deref())?;

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            let _window = tauri::WebviewWindowBuilder::new(
                &app,
                &label,
                tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title(format!("Super Terminal — {}", session_name))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            let mut running = state.running.write().unwrap();
            running.insert(id, RunningSession::Ssh { child });
        }
    }

    Ok(url)
}
