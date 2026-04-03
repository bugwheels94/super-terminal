pub mod process;

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{Child, MasterPty};

/// Holds the PTY process state for a terminal.
pub struct PtyProcess {
    pub writer: Box<dyn Write + Send>,
    pub reader: Option<Box<dyn Read + Send>>,
    pub child: Box<dyn Child + Send + Sync>,
    pub current_command: String,
    pub project_id: i64,
    pub master: Box<dyn MasterPty + Send>,
}

/// Thread-safe map of terminal_id -> PtyProcess.
/// We use Mutex<HashMap> instead of DashMap because MasterPty is not Sync.
pub type PtyMap = Arc<Mutex<HashMap<i64, PtyProcess>>>;

pub fn new_pty_map() -> PtyMap {
    Arc::new(Mutex::new(HashMap::new()))
}
