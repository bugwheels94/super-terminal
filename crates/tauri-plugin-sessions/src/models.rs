use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub name: String,
    pub session_type: SessionType,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum SessionType {
    Local {
        port: u16,
    },
    Http {
        host: String,
        port: u16,
        #[serde(skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
    Ssh {
        ssh_host: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        ssh_port: Option<u16>,
        remote_port: u16,
        local_port: u16,
        #[serde(skip_serializing_if = "Option::is_none")]
        identity_file: Option<String>,
    },
}

impl Session {
    /// Returns the URL to open in a WebviewWindow for this session.
    pub fn url(&self) -> String {
        match &self.session_type {
            SessionType::Local { port } => format!("http://127.0.0.1:{}", port),
            SessionType::Http { host, port, .. } => format!("http://{}:{}", host, port),
            SessionType::Ssh { local_port, .. } => format!("http://127.0.0.1:{}", local_port),
        }
    }

    /// Returns the window label for this session.
    pub fn window_label(&self) -> String {
        format!("session_{}", self.id.replace('-', ""))
    }
}
