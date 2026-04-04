use crate::error::Result;
use crate::models::Session;
use std::fs;
use std::path::PathBuf;

/// Returns the path to sessions.json
fn sessions_file() -> PathBuf {
    let config_dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("super-terminal");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("sessions.json")
}

/// Load all sessions from disk.
pub fn load_sessions() -> Result<Vec<Session>> {
    let path = sessions_file();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)?;
    let sessions: Vec<Session> = serde_json::from_str(&content)?;
    Ok(sessions)
}

/// Save all sessions to disk.
pub fn save_sessions(sessions: &[Session]) -> Result<()> {
    let path = sessions_file();
    let content = serde_json::to_string_pretty(sessions)?;
    fs::write(&path, content)?;
    Ok(())
}
