pub mod models;
pub mod queries;

use anyhow::Result;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;

use crate::config::database_path;

/// Initialize the SQLite database pool and run migrations.
pub async fn init() -> Result<SqlitePool> {
    let db_path = database_path();
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    let options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Create tables
    create_tables(&pool).await?;

    Ok(pool)
}

async fn create_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            terminal_layout TEXT NOT NULL DEFAULT 'automatic',
            font_size INTEGER DEFAULT 14,
            number_of_logs_to_restore INTEGER DEFAULT 100,
            scrollback INTEGER DEFAULT 1000,
            terminal_theme TEXT,
            max_log_size_mb INTEGER
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS terminals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            title TEXT,
            height INTEGER,
            width INTEGER,
            x INTEGER,
            y INTEGER,
            z INTEGER,
            minimized INTEGER,
            maximized INTEGER DEFAULT 0,
            shell TEXT,
            main_command TEXT,
            startup_commands TEXT,
            startup_environment_variables TEXT,
            cwd TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS terminal_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id INTEGER NOT NULL,
            log TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS terminal_log_archives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id INTEGER NOT NULL,
            log TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS terminal_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id INTEGER,
            height INTEGER,
            width INTEGER,
            x INTEGER,
            y INTEGER,
            device_id TEXT NOT NULL,
            FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS history_hashes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS shell_scripts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            script TEXT,
            project_id INTEGER,
            parameters TEXT DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    // FTS5 virtual table for command history search
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS terminal_history USING fts5(command, historyFileId)",
    )
    .execute(pool)
    .await?;

    // Create indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_terminals_project_id ON terminals(project_id)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_terminal_logs_terminal_id ON terminal_logs(terminal_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_terminal_logs_created_at ON terminal_logs(created_at)",
    )
    .execute(pool)
    .await?;

    // Migrations for existing databases
    let _ = sqlx::query("ALTER TABLE projects ADD COLUMN max_log_size_mb INTEGER")
        .execute(pool)
        .await;

    Ok(())
}
