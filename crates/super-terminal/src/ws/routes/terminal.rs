use anyhow::Result;
use serde_json::json;
use std::io::Read;
use tokio::time::Duration;
use tracing::error;

use crate::db::queries;
use crate::pty::process::{kill_pty, resize_pty, spawn_pty, take_pty_reader, write_to_pty};
use crate::ws::protocol::{WsBroadcast, WsResponse};

use super::AppState;

pub async fn handle(
    state: &AppState,
    client_id: u64,
    name: &str,
    data: &serde_json::Value,
    msg_id: Option<u64>,
) -> Result<()> {
    match name {
        "post:terminal" => {
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let terminal_data = data.get("terminal").cloned().unwrap_or(json!({}));

            let terminal =
                queries::create_terminal_from_data(&state.pool, project_id, &terminal_data).await?;

            spawn_and_stream(state, &terminal, project_id, None)?;

            let broadcast = WsBroadcast::new(
                "response|post:terminal",
                json!({ "terminal": terminal, "projectId": project_id }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "clone:terminal" => {
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let terminal_id = data.get("id").and_then(|v| v.as_i64()).unwrap_or(0);

            let old_terminal = queries::get_terminal(&state.pool, terminal_id).await?;
            let clone_data = json!({
                "title": format!("{}-clone", old_terminal.title.as_deref().unwrap_or("Terminal")),
                "height": old_terminal.height,
                "width": old_terminal.width,
                "x": old_terminal.x.unwrap_or(0),
                "y": old_terminal.y.unwrap_or(0),
                "shell": old_terminal.shell,
                "cwd": old_terminal.cwd,
                "mainCommand": old_terminal.main_command,
                "startupCommands": old_terminal.startup_commands,
                "startupEnvironmentVariables": old_terminal.startup_environment_variables,
            });

            let terminal =
                queries::create_terminal_from_data(&state.pool, project_id, &clone_data).await?;

            spawn_and_stream(state, &terminal, project_id, None)?;

            let broadcast = WsBroadcast::new(
                "response|post:terminal",
                json!({ "terminal": terminal, "projectId": project_id }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "patch:terminal" => {
            let id = data.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let terminal_data = data.get("terminal").cloned().unwrap_or(json!({}));

            let restart = terminal_data
                .get("restart")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let meta = terminal_data.get("meta");

            if restart {
                kill_pty(id, &state.pty_map);
                let terminal = queries::get_terminal(&state.pool, id).await?;
                let meta_info = meta.and_then(|m| {
                    Some((
                        m.get("cols")?.as_u64()? as u16,
                        m.get("rows")?.as_u64()? as u16,
                    ))
                });
                spawn_and_stream(state, &terminal, project_id, meta_info)?;
                return Ok(());
            }

            if let Some(m) = meta {
                let cols = m.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;
                let rows = m.get("rows").and_then(|v| v.as_u64()).unwrap_or(30) as u16;
                resize_pty(id, cols, rows, &state.pty_map)?;
                return Ok(());
            }

            // Validate YAML env vars if present
            if let Some(env_str) = terminal_data
                .get("startupEnvironmentVariables")
                .and_then(|v| v.as_str())
            {
                if !env_str.is_empty() {
                    if serde_yaml::from_str::<serde_json::Value>(env_str).is_err() {
                        return Err(anyhow::anyhow!(
                            "Invalid YAML for startup Environment Variables"
                        ));
                    }
                }
            }

            // Filter out meta/restart/id before updating DB
            let mut update_obj = terminal_data.clone();
            if let Some(obj) = update_obj.as_object_mut() {
                obj.remove("meta");
                obj.remove("restart");
                obj.remove("id");
            }

            if update_obj
                .as_object()
                .map(|o| !o.is_empty())
                .unwrap_or(false)
            {
                queries::update_terminal(&state.pool, id, &update_obj).await?;
            }

            let updated = queries::get_terminal(&state.pool, id).await?;
            let broadcast = WsBroadcast::new(
                "response|patch:terminal",
                json!({
                    "terminal": updated,
                    "projectId": project_id,
                    "terminalId": id,
                }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "delete:terminal" => {
            let id = data.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            kill_pty(id, &state.pty_map);
            queries::delete_terminal(&state.pool, id).await?;

            let broadcast = WsBroadcast::new(
                "response|delete:terminal",
                json!({ "terminalId": id, "projectId": project_id }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "get:terminals" => {
            let project_id = data.as_i64().unwrap_or(0);

            let project = queries::get_project(&state.pool, project_id).await?;
            let terminals = queries::get_terminals_by_project(&state.pool, project_id).await?;
            let logs_limit = project.number_of_logs_to_restore.unwrap_or(100);

            let mut result = Vec::new();
            for terminal in &terminals {
                let logs =
                    queries::get_terminal_logs(&state.pool, terminal.id, logs_limit).await?;

                const MAX_TOTAL_BYTES: usize = 1_000_000; // 1MB per terminal
                let mut total_bytes: usize = 0;
                let mut log_entries: Vec<serde_json::Value> = Vec::new();

                // Iterate from most recent, collect until budget exhausted
                for l in logs.into_iter().rev() {
                    if total_bytes + l.log.len() <= MAX_TOTAL_BYTES {
                        total_bytes += l.log.len();
                        log_entries.push(json!({ "log": l.log }));
                    } else {
                        // Crop this entry to fill remaining budget
                        let remaining = MAX_TOTAL_BYTES - total_bytes;
                        if remaining > 0 {
                            // Take the tail end of the log (most recent output)
                            let start = l.log.len() - remaining;
                            log_entries.push(json!({ "log": &l.log[start..] }));
                        }
                        break;
                    }
                }
                log_entries.reverse(); // Back to chronological order

                let mut t = serde_json::to_value(terminal)?;
                t.as_object_mut()
                    .unwrap()
                    .insert("logs".to_string(), json!(log_entries));
                result.push(t);

                // Spawn PTY for each terminal
                spawn_and_stream(state, terminal, project_id, None)?;
            }

            let response = WsResponse::ok(msg_id, json!(result));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());

            let broadcast = WsBroadcast::new("response|post:running-projects", json!(project_id));
            state
                .broadcaster
                .send_to_group("global", &broadcast.to_json());
        }

        "post:terminal-command" => {
            let terminal_id = data
                .get("terminalId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let command = data
                .get("command")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            write_to_pty(terminal_id, command, &state.pty_map)?;
        }

        "get:terminal-commands" => {
            let query = data.as_str().unwrap_or("");
            let results = queries::search_commands(&state.pool, query).await?;
            let response = WsResponse::ok(msg_id, json!(results));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());
        }

        _ => {
            error!("Unknown terminal route: {}", name);
        }
    }

    Ok(())
}

/// Spawn a PTY and start streaming its output to WebSocket clients.
fn spawn_and_stream(
    state: &AppState,
    terminal: &crate::db::models::Terminal,
    project_id: i64,
    meta: Option<(u16, u16)>,
) -> Result<()> {
    let (cols, rows) = meta.unwrap_or((80, 30));

    spawn_pty(
        terminal.id,
        project_id,
        terminal.shell.as_deref(),
        terminal.cwd.as_deref(),
        terminal.startup_environment_variables.as_deref(),
        cols,
        rows,
        &state.pty_map,
    )?;

    // Take the reader for this PTY's output
    let reader = match take_pty_reader(terminal.id, &state.pty_map) {
        Ok(r) => r,
        Err(_) => return Ok(()), // Already taken or failed
    };

    let broadcaster = state.broadcaster.clone();
    let pool = state.pool.clone();
    let tid = terminal.id;
    let pid = project_id;
    let startup_commands = terminal.startup_commands.clone();
    let pty_map = state.pty_map.clone();

    // Channel to serialize log writes in order
    let (log_tx, mut log_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let log_pool = pool.clone();
    tokio::spawn(async move {
        while let Some(log) = log_rx.recv().await {
            let _ = queries::save_terminal_log(&log_pool, tid, &log).await;
        }
    });

    // Spawn a blocking task to read PTY output and broadcast
    tokio::task::spawn_blocking(move || {
        let mut log_buffer = String::new();
        let mut last_save = std::time::Instant::now();

        // Read PTY in a separate thread, send chunks via channel
        let (data_tx, data_rx) = std::sync::mpsc::channel::<String>();
        std::thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        if data_tx.send(data).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        loop {
            match data_rx.recv_timeout(Duration::from_millis(50)) {
                Ok(data) => {
                    let broadcast = WsBroadcast::new(
                        "terminal-data",
                        json!({ "data": data, "id": tid }),
                    );
                    broadcaster.send_to_group(&pid.to_string(), &broadcast.to_json());

                    log_buffer.push_str(&data);

                    // Flush during sustained output every 500ms
                    if last_save.elapsed() >= Duration::from_millis(500) && !log_buffer.is_empty() {
                        let log = std::mem::take(&mut log_buffer);
                        let _ = log_tx.send(log);
                        last_save = std::time::Instant::now();
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // No data for 50ms — flush buffer
                    if !log_buffer.is_empty() {
                        let log = std::mem::take(&mut log_buffer);
                        let _ = log_tx.send(log);
                        last_save = std::time::Instant::now();
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    // PTY closed
                    break;
                }
            }
        }

        // Save any remaining buffer
        if !log_buffer.is_empty() {
            let _ = log_tx.send(log_buffer);
        }
        // log_tx drops here, closing the channel so the writer task ends
    });

    // Send startup commands after a short delay
    if let Some(ref cmds) = startup_commands {
        if !cmds.is_empty() {
            let pty_map = pty_map.clone();
            let cmds = format!("{}\n", cmds);
            let tid = terminal.id;
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(500)).await;
                let _ = write_to_pty(tid, &cmds, &pty_map);
            });
        }
    }

    Ok(())
}
