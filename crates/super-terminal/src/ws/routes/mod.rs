pub mod project;
pub mod shell_script;
pub mod terminal;

use std::sync::Arc;

use sqlx::SqlitePool;

use crate::pty::PtyMap;
use crate::ws::broadcast::Broadcaster;

/// Shared application state passed to all route handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub pty_map: PtyMap,
    pub broadcaster: Arc<Broadcaster>,
}
