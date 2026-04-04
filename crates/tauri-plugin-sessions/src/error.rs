use serde::Serialize;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already connected: {0}")]
    AlreadyConnected(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("SSH authentication failed: {0}")]
    SshAuth(String),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        match self {
            Error::SshAuth(_) => map.serialize_entry("kind", "ssh_auth")?,
            Error::Ssh(_) => map.serialize_entry("kind", "ssh")?,
            _ => map.serialize_entry("kind", "other")?,
        }
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}
