use anyhow::Result;
use sha1::{Digest, Sha1};
use sqlx::SqlitePool;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use tracing::{error, info};

use crate::config::is_windows;
use crate::db::queries;

/// Initialize shell history: create FTS table and do initial import.
pub async fn init(pool: &SqlitePool) {
    if let Err(e) = import_history(pool).await {
        error!("Failed to import shell history: {}", e);
    }
}

/// Import shell history from known history files.
pub async fn import_history(pool: &SqlitePool) -> Result<()> {
    let paths = history_paths();
    for path in paths {
        let path_str = path.to_string_lossy().to_string();
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let hash = sha1_hash(&content);

        let existing = queries::get_history_hash(pool, &path_str).await?;
        if let Some(ref record) = existing {
            if record.hash == hash {
                continue; // No changes
            }
        }

        let history_id = queries::upsert_history_hash(pool, &path_str, &hash).await?;

        let commands = parse_history(&content);
        // Deduplicate
        let unique: Vec<String> = {
            let mut seen = HashSet::new();
            commands
                .into_iter()
                .filter(|c| !c.is_empty() && seen.insert(c.clone()))
                .collect()
        };

        queries::update_history_commands(pool, &unique, history_id).await?;
        info!(path = %path_str, commands = unique.len(), "Imported shell history");
    }

    Ok(())
}

/// Get paths to known shell history files.
fn history_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(home) = dirs::home_dir() {
        if !is_windows() {
            let candidates = [".history", ".bash_history", ".zsh_history"];
            for name in &candidates {
                let p = home.join(name);
                if p.exists() {
                    paths.push(p);
                }
            }
        }
    }

    if let Ok(histfile) = std::env::var("HISTFILE") {
        let p = PathBuf::from(&histfile);
        if p.exists() {
            paths.push(p);
        }
    }

    paths
}

/// Parse shell history content into individual commands.
fn parse_history(content: &str) -> Vec<String> {
    content
        .trim()
        .lines()
        .map(|line| {
            // Handle zsh extended history format: ": timestamp:0;command"
            if line.starts_with(": ") {
                if let Some(idx) = line.find(';') {
                    return line[idx + 1..].to_string();
                }
            }
            line.to_string()
        })
        .filter(|s| !s.is_empty())
        .collect()
}

fn sha1_hash(content: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}
