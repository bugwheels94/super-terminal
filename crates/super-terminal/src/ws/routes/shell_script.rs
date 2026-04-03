use anyhow::Result;
use serde_json::json;
use std::fs;
use std::io::Write as _;
use tracing::error;

use crate::config::{config_dir, is_windows};
use crate::db::queries;
use crate::pty::process::write_to_pty;
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
        "post:script" => {
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let name = data
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("untitled-script");
            let script_content = data.get("script").and_then(|v| v.as_str());
            let parameters = data
                .get("parameters")
                .map(|v| v.to_string())
                .unwrap_or_else(|| "[]".to_string());

            let script = queries::create_script(
                &state.pool,
                Some(project_id),
                name,
                script_content,
                &parameters,
            )
            .await?;

            let broadcast = WsBroadcast::new(
                "response|post:script",
                json!({ "projectId": project_id, "data": script }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "clone:script" => {
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let script_id = data
                .get("scriptId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            let original = queries::get_script(&state.pool, script_id).await?;
            let cloned = queries::create_script(
                &state.pool,
                original.project_id,
                &format!("{}-clone", original.name),
                original.script.as_deref(),
                &original.parameters,
            )
            .await?;

            let broadcast = WsBroadcast::new(
                "response|clone:script",
                json!({ "data": cloned, "projectId": project_id }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "execute:script" => {
            let script_id = data
                .get("scriptId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let terminal_id = data
                .get("terminalId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let parameters = data
                .get("parameters")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            let script = queries::get_script(&state.pool, script_id).await?;
            let mut content = script.script.unwrap_or_default();

            // Interpolate parameters
            for (param_name, param_value) in &parameters {
                let placeholder = format!("{{{{{}}}}}", param_name);
                let value = param_value.as_str().unwrap_or("");
                content = content.replace(&placeholder, value);
            }

            // Write script to temp file and execute
            let script_name = script.name.replace(' ', "");
            let ext = if is_windows() { ".cmd" } else { "" };
            let script_path = config_dir().join(format!("script-{}{}", script_name, ext));

            let shell = if is_windows() {
                String::new()
            } else {
                format!(
                    "{} ",
                    std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string())
                )
            };

            let shebang = if is_windows() {
                String::new()
            } else {
                format!("#!{}\n", shell.trim())
            };

            let mut file = fs::File::create(&script_path)?;
            file.write_all(format!("{}{}", shebang, content).as_bytes())?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&script_path, fs::Permissions::from_mode(0o755))?;
            }

            let newline = if is_windows() { "\r\n" } else { "\n" };
            let command = format!(
                "{}{}{}",
                shell,
                script_path.to_string_lossy(),
                newline
            );
            write_to_pty(terminal_id, &command, &state.pty_map)?;
        }

        "patch:script" => {
            let script_id = data
                .get("scriptId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let updates = data.get("script").cloned().unwrap_or(json!({}));

            queries::update_script(&state.pool, script_id, &updates).await?;
            let updated = queries::get_script(&state.pool, script_id).await?;

            let broadcast = WsBroadcast::new(
                "response|patch:script",
                json!({
                    "data": updated,
                    "scriptId": script_id,
                    "projectId": project_id,
                }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        "get:scripts" => {
            let project_id = data.as_i64().unwrap_or(0);
            let scripts = queries::get_scripts(&state.pool, project_id).await?;

            let response = WsResponse::ok(msg_id, json!(scripts));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());
        }

        "delete:script" => {
            let script_id = data
                .get("scriptId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            queries::delete_script(&state.pool, script_id).await?;

            let broadcast = WsBroadcast::new(
                "response|delete:script",
                json!({ "scriptId": script_id, "projectId": project_id }),
            );
            state
                .broadcaster
                .send_to_group(&project_id.to_string(), &broadcast.to_json());
        }

        _ => {
            error!("Unknown shell-script route: {}", name);
        }
    }

    Ok(())
}
