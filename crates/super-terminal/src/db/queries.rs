use anyhow::Result;
use sqlx::SqlitePool;

use super::models::*;

// ─── Projects ───────────────────────────────────────────────────────────────

pub async fn get_projects(pool: &SqlitePool) -> Result<Vec<Project>> {
    let rows = sqlx::query_as::<_, Project>("SELECT * FROM projects")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn get_project(pool: &SqlitePool, id: i64) -> Result<Project> {
    let row = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(row)
}

pub async fn get_project_by_slug(pool: &SqlitePool, slug: &str) -> Result<Option<Project>> {
    let row = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE slug = ?")
        .bind(slug)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create_project(pool: &SqlitePool, slug: &str, theme_json: &str) -> Result<i64> {
    let result = sqlx::query(
        "INSERT INTO projects (slug, font_size, terminal_theme, scrollback) VALUES (?, 14, ?, 1000)",
    )
    .bind(slug)
    .bind(theme_json)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

pub async fn update_project(pool: &SqlitePool, id: i64, updates: &serde_json::Value) -> Result<()> {
    // Build dynamic UPDATE from JSON fields
    let obj = updates.as_object().ok_or_else(|| anyhow::anyhow!("expected object"))?;
    if obj.is_empty() {
        return Ok(());
    }

    let mut set_clauses = Vec::new();
    let mut values: Vec<String> = Vec::new();

    for (key, val) in obj {
        let column = to_snake_case(key);
        if val.is_null() {
            set_clauses.push(format!("{} = NULL", column));
        } else {
            set_clauses.push(format!("{} = ?", column));
            match val {
                serde_json::Value::String(s) => values.push(s.clone()),
                serde_json::Value::Number(n) => values.push(n.to_string()),
                serde_json::Value::Null => unreachable!(),
                other => values.push(other.to_string()),
            }
        }
    }

    let sql = format!("UPDATE projects SET {} WHERE id = ?", set_clauses.join(", "));
    let mut query = sqlx::query(&sql);
    for v in &values {
        query = query.bind(v);
    }
    query.bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_project(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ─── Terminals ──────────────────────────────────────────────────────────────

pub async fn get_terminals_by_project(pool: &SqlitePool, project_id: i64) -> Result<Vec<Terminal>> {
    let rows = sqlx::query_as::<_, Terminal>("SELECT * FROM terminals WHERE project_id = ?")
        .bind(project_id)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn get_terminal(pool: &SqlitePool, id: i64) -> Result<Terminal> {
    let row = sqlx::query_as::<_, Terminal>("SELECT * FROM terminals WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(row)
}

pub async fn create_terminal(
    pool: &SqlitePool,
    project_id: i64,
    title: &str,
    height: i64,
    width: i64,
    x: i64,
    y: i64,
) -> Result<i64> {
    let result = sqlx::query(
        "INSERT INTO terminals (project_id, title, height, width, x, y) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(project_id)
    .bind(title)
    .bind(height)
    .bind(width)
    .bind(x)
    .bind(y)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

pub async fn create_terminal_from_data(
    pool: &SqlitePool,
    project_id: i64,
    data: &serde_json::Value,
) -> Result<Terminal> {
    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("New Terminal");
    let height = data.get("height").and_then(|v| v.as_i64()).unwrap_or(250);
    let width = data.get("width").and_then(|v| v.as_i64()).unwrap_or(400);
    let x = data.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
    let y = data.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
    let shell = data.get("shell").and_then(|v| v.as_str());
    let cwd = data.get("cwd").and_then(|v| v.as_str());
    let main_command = data.get("mainCommand").and_then(|v| v.as_str());
    let startup_commands = data.get("startupCommands").and_then(|v| v.as_str());
    let startup_env = data
        .get("startupEnvironmentVariables")
        .and_then(|v| v.as_str());

    let result = sqlx::query(
        "INSERT INTO terminals (project_id, title, height, width, x, y, shell, cwd, main_command, startup_commands, startup_environment_variables) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(project_id)
    .bind(title)
    .bind(height)
    .bind(width)
    .bind(x)
    .bind(y)
    .bind(shell)
    .bind(cwd)
    .bind(main_command)
    .bind(startup_commands)
    .bind(startup_env)
    .execute(pool)
    .await?;

    get_terminal(pool, result.last_insert_rowid()).await
}

pub async fn update_terminal(
    pool: &SqlitePool,
    id: i64,
    updates: &serde_json::Value,
) -> Result<()> {
    let obj = updates
        .as_object()
        .ok_or_else(|| anyhow::anyhow!("expected object"))?;
    if obj.is_empty() {
        return Ok(());
    }

    let mut set_clauses = Vec::new();
    let mut values: Vec<String> = Vec::new();

    for (key, val) in obj {
        // Skip meta fields handled separately
        if key == "meta" || key == "restart" || key == "id" {
            continue;
        }
        let column = to_snake_case(key);
        set_clauses.push(format!("{} = ?", column));
        match val {
            serde_json::Value::String(s) => values.push(s.clone()),
            serde_json::Value::Number(n) => values.push(n.to_string()),
            serde_json::Value::Bool(b) => values.push(if *b { "1".into() } else { "0".into() }),
            serde_json::Value::Null => values.push(String::new()),
            other => values.push(other.to_string()),
        }
    }

    if set_clauses.is_empty() {
        return Ok(());
    }

    let sql = format!("UPDATE terminals SET {} WHERE id = ?", set_clauses.join(", "));
    let mut query = sqlx::query(&sql);
    for v in &values {
        query = query.bind(v);
    }
    query.bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_terminal(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM terminals WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ─── Terminal Logs ──────────────────────────────────────────────────────────

pub async fn save_terminal_log(pool: &SqlitePool, terminal_id: i64, log: &str) -> Result<()> {
    sqlx::query("INSERT INTO terminal_logs (terminal_id, log) VALUES (?, ?)")
        .bind(terminal_id)
        .bind(log)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_terminal_logs(
    pool: &SqlitePool,
    terminal_id: i64,
    limit: i64,
) -> Result<Vec<TerminalLog>> {
    // Get most recent logs, then reverse to chronological order
    let rows = sqlx::query_as::<_, TerminalLog>(
        "SELECT * FROM terminal_logs WHERE terminal_id = ? ORDER BY id DESC LIMIT ?",
    )
    .bind(terminal_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().rev().collect())
}

// ─── Log Cleanup ────────────────────────────────────────────────────────────

pub async fn archive_old_logs(pool: &SqlitePool) -> Result<()> {
    // Move logs beyond 1000-per-terminal to archive
    sqlx::query(
        "INSERT INTO terminal_log_archives (terminal_id, log, created_at)
         SELECT terminal_id, log, created_at FROM terminal_logs
         WHERE id NOT IN (
             SELECT id FROM terminal_logs
             ORDER BY created_at DESC
             LIMIT 1000
         )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "DELETE FROM terminal_logs
         WHERE id NOT IN (
             SELECT id FROM terminal_logs
             ORDER BY created_at DESC
             LIMIT 1000
         )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_old_archives(pool: &SqlitePool, days: i64) -> Result<()> {
    sqlx::query(
        "DELETE FROM terminal_log_archives WHERE created_at < datetime('now', ? || ' days')",
    )
    .bind(-days)
    .execute(pool)
    .await?;

    sqlx::query("VACUUM").execute(pool).await.ok();
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)").execute(pool).await.ok();
    Ok(())
}

pub async fn delete_project_logs(pool: &SqlitePool, project_id: i64) -> Result<()> {
    sqlx::query(
        "DELETE FROM terminal_logs WHERE terminal_id IN (SELECT id FROM terminals WHERE project_id = ?)",
    )
    .bind(project_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "DELETE FROM terminal_log_archives WHERE terminal_id IN (SELECT id FROM terminals WHERE project_id = ?)",
    )
    .bind(project_id)
    .execute(pool)
    .await?;

    sqlx::query("VACUUM").execute(pool).await.ok();
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)").execute(pool).await.ok();
    Ok(())
}

pub async fn get_project_log_size_bytes(pool: &SqlitePool, project_id: i64) -> Result<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(LENGTH(log)), 0) FROM (
            SELECT log FROM terminal_logs WHERE terminal_id IN (SELECT id FROM terminals WHERE project_id = ?)
            UNION ALL
            SELECT log FROM terminal_log_archives WHERE terminal_id IN (SELECT id FROM terminals WHERE project_id = ?)
        )",
    )
    .bind(project_id)
    .bind(project_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn get_projects_with_log_limit(pool: &SqlitePool) -> Result<Vec<Project>> {
    let rows = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE max_log_size_mb IS NOT NULL",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// ─── Shell Scripts ──────────────────────────────────────────────────────────

pub async fn get_scripts(pool: &SqlitePool, project_id: i64) -> Result<Vec<ShellScript>> {
    let rows = sqlx::query_as::<_, ShellScript>(
        "SELECT * FROM shell_scripts WHERE project_id = ? OR project_id IS NULL",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_script(pool: &SqlitePool, id: i64) -> Result<ShellScript> {
    let row = sqlx::query_as::<_, ShellScript>("SELECT * FROM shell_scripts WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(row)
}

pub async fn create_script(
    pool: &SqlitePool,
    project_id: Option<i64>,
    name: &str,
    script: Option<&str>,
    parameters: &str,
) -> Result<ShellScript> {
    let result = sqlx::query(
        "INSERT INTO shell_scripts (project_id, name, script, parameters) VALUES (?, ?, ?, ?)",
    )
    .bind(project_id)
    .bind(name)
    .bind(script)
    .bind(parameters)
    .execute(pool)
    .await?;
    get_script(pool, result.last_insert_rowid()).await
}

pub async fn update_script(
    pool: &SqlitePool,
    id: i64,
    updates: &serde_json::Value,
) -> Result<()> {
    let obj = updates
        .as_object()
        .ok_or_else(|| anyhow::anyhow!("expected object"))?;
    if obj.is_empty() {
        return Ok(());
    }

    let mut set_clauses = Vec::new();
    let mut values: Vec<String> = Vec::new();

    for (key, val) in obj {
        let column = to_snake_case(key);
        if val.is_null() {
            set_clauses.push(format!("{} = NULL", column));
        } else {
            set_clauses.push(format!("{} = ?", column));
            match val {
                serde_json::Value::String(s) => values.push(s.clone()),
                serde_json::Value::Number(n) => values.push(n.to_string()),
                serde_json::Value::Null => unreachable!(),
                other => values.push(other.to_string()),
            }
        }
    }

    if set_clauses.is_empty() {
        return Ok(());
    }

    let sql = format!(
        "UPDATE shell_scripts SET {} WHERE id = ?",
        set_clauses.join(", ")
    );
    let mut query = sqlx::query(&sql);
    for v in &values {
        query = query.bind(v);
    }
    query.bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_script(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM shell_scripts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ─── History ────────────────────────────────────────────────────────────────

pub async fn get_history_hash(pool: &SqlitePool, path: &str) -> Result<Option<HistoryHash>> {
    let row =
        sqlx::query_as::<_, HistoryHash>("SELECT * FROM history_hashes WHERE path = ?")
            .bind(path)
            .fetch_optional(pool)
            .await?;
    Ok(row)
}

pub async fn upsert_history_hash(pool: &SqlitePool, path: &str, hash: &str) -> Result<i64> {
    let result = sqlx::query(
        "INSERT INTO history_hashes (path, hash) VALUES (?, ?)
         ON CONFLICT(path) DO UPDATE SET hash = excluded.hash",
    )
    .bind(path)
    .bind(hash)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

pub async fn search_commands(pool: &SqlitePool, query: &str) -> Result<Vec<CommandResult>> {
    let chunks: Vec<String> = query
        .trim()
        .split(|c: char| c.is_whitespace() || c == '-' || c == '.')
        .filter(|s| !s.is_empty())
        .map(|s| format!("\"{}\"*", s))
        .collect();

    if chunks.is_empty() {
        return Ok(vec![]);
    }

    let fts_query = chunks.join(" OR ");
    let rows = sqlx::query_as::<_, CommandResult>(
        "SELECT DISTINCT command FROM terminal_history WHERE terminal_history MATCH ? ORDER BY rank LIMIT 10",
    )
    .bind(&fts_query)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    Ok(rows)
}

pub async fn update_history_commands(
    pool: &SqlitePool,
    commands: &[String],
    history_file_id: i64,
) -> Result<()> {
    // Delete existing entries for this history file
    sqlx::query("DELETE FROM terminal_history WHERE historyFileId = ?")
        .bind(history_file_id)
        .execute(pool)
        .await?;

    // Insert in chunks of 500
    for chunk in commands.chunks(500) {
        let placeholders: Vec<String> = chunk.iter().map(|_| format!("(?, {})", history_file_id)).collect();
        let sql = format!(
            "INSERT INTO terminal_history(command, historyFileId) VALUES{}",
            placeholders.join(",")
        );
        let mut query = sqlx::query(&sql);
        for cmd in chunk {
            query = query.bind(cmd);
        }
        query.execute(pool).await?;
    }

    Ok(())
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Convert camelCase to snake_case for DB column mapping.
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}
