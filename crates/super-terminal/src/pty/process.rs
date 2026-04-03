use anyhow::Result;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use tracing::{error, info};

use super::{PtyMap, PtyProcess};

/// Spawn a new PTY process for a terminal.
pub fn spawn_pty(
    terminal_id: i64,
    project_id: i64,
    shell: Option<&str>,
    cwd: Option<&str>,
    env_vars: Option<&str>,
    cols: u16,
    rows: u16,
    pty_map: &PtyMap,
) -> Result<()> {
    {
        let map = pty_map.lock().unwrap();
        if map.contains_key(&terminal_id) {
            return Ok(());
        }
    }

    let pty_system = native_pty_system();

    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    // Determine shell
    let shell_path = if let Some(s) = shell {
        if s.is_empty() {
            default_shell()
        } else {
            s.to_string()
        }
    } else {
        default_shell()
    };

    let mut cmd = CommandBuilder::new(&shell_path);

    // Set CWD with env var expansion
    let resolved_cwd = if let Some(c) = cwd {
        if c.is_empty() {
            home_dir()
        } else {
            expand_env_vars(c)
        }
    } else {
        home_dir()
    };
    cmd.cwd(&resolved_cwd);

    // Parse and set environment variables (YAML format)
    let mut env: HashMap<String, String> = std::env::vars().collect();
    if let Some(env_yaml) = env_vars {
        if !env_yaml.is_empty() {
            if let Ok(parsed) = serde_yaml::from_str::<HashMap<String, serde_json::Value>>(env_yaml)
            {
                for (key, val) in parsed {
                    let val_str = match val {
                        serde_json::Value::String(s) => s,
                        other => other.to_string(),
                    };
                    env.insert(key, val_str);
                }
            }
        }
    }

    env.insert("TERM".to_string(), "xterm-256color".to_string());

    for (k, v) in &env {
        cmd.env(k, v);
    }

    let child = pair.slave.spawn_command(cmd)?;
    let writer = pair.master.take_writer()?;
    let reader = Some(pair.master.try_clone_reader()?);

    info!(
        terminal_id,
        shell = %shell_path,
        cwd = %resolved_cwd,
        "Spawned PTY process"
    );

    let pty_process = PtyProcess {
        writer,
        reader,
        child,
        current_command: String::new(),
        project_id,
        master: pair.master,
    };

    pty_map.lock().unwrap().insert(terminal_id, pty_process);
    Ok(())
}

/// Resize a PTY.
pub fn resize_pty(terminal_id: i64, cols: u16, rows: u16, pty_map: &PtyMap) -> Result<()> {
    let map = pty_map.lock().unwrap();
    if let Some(process) = map.get(&terminal_id) {
        process.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
    }
    Ok(())
}

/// Write data to a PTY.
pub fn write_to_pty(terminal_id: i64, data: &str, pty_map: &PtyMap) -> Result<()> {
    let mut map = pty_map.lock().unwrap();
    if let Some(process) = map.get_mut(&terminal_id) {
        process.writer.write_all(data.as_bytes())?;
    } else {
        error!(terminal_id, "PTY process not found");
    }
    Ok(())
}

/// Kill a PTY process and remove from map.
pub fn kill_pty(terminal_id: i64, pty_map: &PtyMap) {
    let mut map = pty_map.lock().unwrap();
    if let Some(mut process) = map.remove(&terminal_id) {
        if let Err(e) = process.child.kill() {
            error!(terminal_id, error = %e, "Failed to kill PTY process");
        }
    }
}

/// Kill all PTY processes for a project.
pub fn kill_project_ptys(project_id: i64, pty_map: &PtyMap) {
    let terminal_ids: Vec<i64> = {
        let map = pty_map.lock().unwrap();
        map.iter()
            .filter(|(_, p)| p.project_id == project_id)
            .map(|(id, _)| *id)
            .collect()
    };

    for id in terminal_ids {
        kill_pty(id, pty_map);
    }
}

/// Get all unique project IDs that have running PTY processes.
pub fn running_project_ids(pty_map: &PtyMap) -> Vec<i64> {
    let map = pty_map.lock().unwrap();
    let mut ids: Vec<i64> = map.values().map(|p| p.project_id).collect();
    ids.sort_unstable();
    ids.dedup();
    ids
}

/// Take the reader from a PTY (can only be called once per terminal).
pub fn take_pty_reader(
    terminal_id: i64,
    pty_map: &PtyMap,
) -> Result<Box<dyn Read + Send>> {
    let mut map = pty_map.lock().unwrap();
    let process = map
        .get_mut(&terminal_id)
        .ok_or_else(|| anyhow::anyhow!("PTY not found for terminal {}", terminal_id))?;
    process
        .reader
        .take()
        .ok_or_else(|| anyhow::anyhow!("Reader already taken for terminal {}", terminal_id))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn default_shell() -> String {
    if cfg!(target_os = "windows") {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string())
    }
}

fn home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string())
}

/// Expand $VAR references in a string using current env.
fn expand_env_vars(s: &str) -> String {
    let mut result = s.to_string();
    let re_pattern: Vec<String> = s
        .match_indices('$')
        .filter_map(|(i, _)| {
            let rest = &s[i + 1..];
            let end = rest
                .find(|c: char| !c.is_alphanumeric() && c != '_')
                .unwrap_or(rest.len());
            if end > 0 {
                Some(rest[..end].to_string())
            } else {
                None
            }
        })
        .collect();

    for var_name in re_pattern {
        if let Ok(val) = std::env::var(&var_name) {
            result = result.replace(&format!("${}", var_name), &val);
        }
    }
    result
}
