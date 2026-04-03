use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub slug: String,
    pub terminal_layout: String,
    pub font_size: Option<i64>,
    pub number_of_logs_to_restore: Option<i64>,
    pub scrollback: Option<i64>,
    #[serde(serialize_with = "serialize_optional_json_string")]
    pub terminal_theme: Option<String>, // JSON string
    pub max_log_size_mb: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Terminal {
    pub id: i64,
    pub project_id: Option<i64>,
    pub title: Option<String>,
    pub height: Option<i64>,
    pub width: Option<i64>,
    pub x: Option<i64>,
    pub y: Option<i64>,
    pub z: Option<i64>,
    pub minimized: Option<i64>,
    pub maximized: Option<i64>,
    pub shell: Option<String>,
    pub main_command: Option<String>,
    pub startup_commands: Option<String>,
    pub startup_environment_variables: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TerminalLog {
    pub id: i64,
    pub terminal_id: i64,
    pub log: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TerminalLogArchive {
    pub id: i64,
    pub terminal_id: i64,
    pub log: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TerminalSetting {
    pub id: i64,
    pub terminal_id: Option<i64>,
    pub height: Option<i64>,
    pub width: Option<i64>,
    pub x: Option<i64>,
    pub y: Option<i64>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct HistoryHash {
    pub id: i64,
    pub path: String,
    pub hash: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ShellScript {
    pub id: i64,
    pub name: String,
    pub script: Option<String>,
    pub project_id: Option<i64>,
    #[serde(serialize_with = "serialize_json_string")]
    pub parameters: String,
    pub created_at: String,
}

fn serialize_json_string<S>(value: &str, serializer: S) -> std::result::Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let parsed: serde_json::Value =
        serde_json::from_str(value).unwrap_or(serde_json::Value::Array(vec![]));
    parsed.serialize(serializer)
}

fn serialize_optional_json_string<S>(value: &Option<String>, serializer: S) -> std::result::Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match value {
        Some(s) => {
            let parsed: serde_json::Value =
                serde_json::from_str(s).unwrap_or(serde_json::Value::Null);
            parsed.serialize(serializer)
        }
        None => serializer.serialize_none(),
    }
}

/// Terminal with its logs attached (used in get:terminals response).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalWithLogs {
    #[serde(flatten)]
    pub terminal: Terminal,
    pub logs: Vec<LogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub log: String,
}

/// Command search result from FTS5.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommandResult {
    pub command: String,
}
