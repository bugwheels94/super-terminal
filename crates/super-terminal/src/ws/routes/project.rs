use anyhow::Result;
use serde_json::json;
use tracing::error;

use crate::db::queries;
use crate::pty::process::{kill_project_ptys, running_project_ids};
use crate::ws::protocol::{WsBroadcast, WsResponse};

use super::AppState;

const DEFAULT_THEME: &str = r##"{"name":"Breeze","black":"#31363b","red":"#ed1515","green":"#11d116","yellow":"#f67400","blue":"#1d99f3","purple":"#9b59b6","cyan":"#1abc9c","white":"#eff0f1","brightBlack":"#7f8c8d","brightRed":"#c0392b","brightGreen":"#1cdc9a","brightYellow":"#fdbc4b","brightBlue":"#3daee9","brightPurple":"#8e44ad","brightCyan":"#16a085","brightWhite":"#fcfcfc","background":"#31363b","foreground":"#eff0f1","selectionBackground":"#eff0f1","cursorColor":"#eff0f1"}"##;

pub async fn handle(
    state: &AppState,
    client_id: u64,
    name: &str,
    data: &serde_json::Value,
    msg_id: Option<u64>,
) -> Result<()> {
    match name {
        "get:projects" => {
            let projects = queries::get_projects(&state.pool).await?;
            let response = WsResponse::ok(msg_id, json!(projects));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());
        }

        "post:project" => {
            let slug = data
                .get("slug")
                .and_then(|v| v.as_str())
                .unwrap_or("default");

            // Try to find existing, otherwise create
            let project = match queries::get_project_by_slug(&state.pool, slug).await? {
                Some(p) => p,
                None => {
                    let id = queries::create_project(&state.pool, slug, DEFAULT_THEME).await?;
                    // Create a default terminal
                    queries::create_terminal(&state.pool, id, "New Terminal", 250, 400, 0, 0)
                        .await?;
                    queries::get_project(&state.pool, id).await?
                }
            };

            let response = WsResponse::ok_empty(msg_id);
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());

            let broadcast = WsBroadcast::new("response|post:projects", json!(project));
            state
                .broadcaster
                .send_to_group("global", &broadcast.to_json());
        }

        "put:project" => {
            let slug = data.as_str().unwrap_or("default");

            let project = match queries::get_project_by_slug(&state.pool, slug).await? {
                Some(p) => p,
                None => {
                    let id = queries::create_project(&state.pool, slug, DEFAULT_THEME).await?;
                    queries::create_terminal(&state.pool, id, "New Terminal", 250, 400, 0, 0)
                        .await?;
                    queries::get_project(&state.pool, id).await?
                }
            };

            let response = WsResponse::ok(msg_id, json!(project.id));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());
        }

        "get:project" => {
            let id = data.as_i64().unwrap_or(0);
            let project = queries::get_project(&state.pool, id).await?;

            // Join client to project group
            state
                .broadcaster
                .join_group(client_id, &id.to_string());

            let response = WsResponse::ok(msg_id, json!(project));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());
        }

        "patch:project" => {
            let id = data
                .get("id")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let updates = data.get("project").cloned().unwrap_or(json!({}));

            match queries::update_project(&state.pool, id, &updates).await {
                Ok(_) => {
                    let project = queries::get_project(&state.pool, id).await?;
                    let broadcast = WsBroadcast::new("response|patch:project", json!(project));
                    state
                        .broadcaster
                        .send_to_group(&id.to_string(), &broadcast.to_json());
                }
                Err(e) => {
                    let err_str = e.to_string();
                    if err_str.contains("UNIQUE") {
                        let response =
                            WsResponse::err(msg_id, "Project with this name already exists".into());
                        state
                            .broadcaster
                            .send_to_client(client_id, &response.to_json());
                    } else {
                        return Err(e);
                    }
                }
            }
        }

        "delete:project" => {
            let id = data.as_i64().unwrap_or(0);
            kill_project_ptys(id, &state.pty_map);
            queries::delete_project(&state.pool, id).await?;

            let broadcast = WsBroadcast::new("response|delete:project", json!(id));
            state
                .broadcaster
                .send_to_group("global", &broadcast.to_json());

            let broadcast2 = WsBroadcast::new("response|close:running-projects", json!(id));
            state
                .broadcaster
                .send_to_group("global", &broadcast2.to_json());
        }

        "close:running-projects" => {
            let id = data.as_i64().unwrap_or(0);
            kill_project_ptys(id, &state.pty_map);

            let broadcast = WsBroadcast::new("response|close:running-projects", json!(id));
            state
                .broadcaster
                .send_to_group("global", &broadcast.to_json());
        }

        "get:running-projects" => {
            let ids = running_project_ids(&state.pty_map);
            let response = WsResponse::ok(msg_id, json!(ids));
            state
                .broadcaster
                .send_to_client(client_id, &response.to_json());
        }

        "delete:logs-archive" => {
            let days = data
                .get("days")
                .and_then(|v| v.as_i64())
                .unwrap_or(7);
            if let Err(e) = queries::delete_old_archives(&state.pool, days).await {
                error!("Failed to delete old archives: {}", e);
            }
        }

        "delete:project-logs" => {
            let project_id = data
                .get("projectId")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            if let Err(e) = queries::delete_project_logs(&state.pool, project_id).await {
                error!("Failed to delete project logs: {}", e);
            }
        }

        _ => {
            error!("Unknown project route: {}", name);
        }
    }

    Ok(())
}
