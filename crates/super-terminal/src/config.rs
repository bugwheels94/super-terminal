use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Application configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_password")]
    pub auth_password: String,
    #[serde(default)]
    pub cert: Option<String>,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub ui_path: Option<String>,
}

fn default_port() -> u16 {
    3879
}
fn default_host() -> String {
    "127.0.0.1".to_string()
}
fn default_password() -> String {
    "password".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: default_port(),
            host: default_host(),
            auth_password: default_password(),
            cert: None,
            key: None,
            ui_path: None,
        }
    }
}

impl Config {
    /// Load configuration from YAML file + environment variables.
    pub fn load() -> Result<Self> {
        let config_dir = config_dir();
        fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("config");
        let mut config = if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            serde_yaml::from_str::<Config>(&content).unwrap_or_default()
        } else {
            Config::default()
        };

        // Environment variable overrides
        if let Ok(host) = std::env::var("SUPER_TERMINAL_HOST") {
            config.host = host;
        }
        if let Ok(port) = std::env::var("SUPER_TERMINAL_PORT") {
            if let Ok(p) = port.parse() {
                config.port = p;
            }
        }

        Ok(config)
    }
}

/// Returns ~/.config/super-terminal
pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("super-terminal")
}

/// Returns the database path, respecting SUPER_TERMINAL_DB env var.
pub fn database_path() -> PathBuf {
    if let Ok(path) = std::env::var("SUPER_TERMINAL_DB") {
        PathBuf::from(path)
    } else {
        config_dir().join("database.sqlite")
    }
}

pub fn is_windows() -> bool {
    cfg!(target_os = "windows")
}
