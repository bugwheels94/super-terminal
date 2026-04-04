use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    http::{header, StatusCode, Uri},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use rust_embed::Embed;
use std::sync::Arc;
use tower_http::services::ServeDir;
use tracing::{error, info};

#[derive(Embed)]
#[folder = "../../ui/dist/"]
struct UiAssets;

use crate::cleanup;
use crate::config::Config;
use crate::db;
use crate::history;
use crate::pty;
use crate::ws::broadcast::Broadcaster;
use crate::ws::protocol::WsMessage;
use crate::ws::routes::{project, shell_script, terminal, AppState};

#[derive(Clone)]
struct ServerState {
    app: AppState,
    auth_password: String,
}

/// Run the super-terminal server.
pub async fn run(config: Config) -> Result<()> {
    let pool = db::init().await?;

    // Initialize shell history
    history::init(&pool).await;

    // Start background cleanup tasks
    cleanup::start(pool.clone());

    let pty_map = pty::new_pty_map();
    let broadcaster = Broadcaster::new();

    let state = AppState {
        pool,
        pty_map,
        broadcaster,
    };

    // Determine UI path
    let ui_path = config.ui_path.clone();

    let server_state = Arc::new(ServerState {
        app: state,
        auth_password: config.auth_password.clone(),
    });

    let mut app = Router::new()
        .route(
            "/password",
            post({
                let _st = server_state.clone();
                move |body: String| async move {
                    let password = body
                        .split('&')
                        .find_map(|pair| {
                            let mut parts = pair.splitn(2, '=');
                            if parts.next() == Some("password") {
                                parts.next().map(|s| s.to_string())
                            } else {
                                None
                            }
                        })
                        .unwrap_or_default();

                    (
                        StatusCode::OK,
                        [(
                            "Set-Cookie",
                            format!("password={};Path=/", password),
                        )],
                        "",
                    )
                }
            }),
        )
        .route(
            "/ws",
            get({
                let st = server_state.clone();
                move |ws: WebSocketUpgrade| async move {
                    ws.protocols(["ws"])
                        .on_upgrade(move |socket| handle_socket(socket, st))
                }
            }),
        );

    // Serve UI from filesystem (dev mode) or embedded assets
    if let Some(path) = ui_path {
        app = app.fallback_service(
            ServeDir::new(&path).append_index_html_on_directories(true),
        );
    } else {
        app = app.fallback(serve_embedded);
    }

    let addr = format!("{}:{}", config.host, config.port);
    info!("Running at {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn serve_embedded(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    // Try exact file, then fall back to index.html for SPA routing
    let file = if path.is_empty() {
        UiAssets::get("index.html")
    } else {
        UiAssets::get(path).or_else(|| UiAssets::get("index.html"))
    };

    match file {
        Some(content) => {
            let mime = mime_guess::from_path(if UiAssets::get(path).is_some() {
                path
            } else {
                "index.html"
            })
            .first_or_text_plain()
            .to_string();

            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime)],
                content.data.into_owned(),
            )
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    let (client_id, mut rx) = state.app.broadcaster.add_client();
    let (mut sender, mut receiver) = socket.split();

    use futures::SinkExt;
    use futures::StreamExt;

    // Task to forward broadcasts to this client's WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task to handle incoming messages from this client
    let app_state = state.app.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    handle_message(&app_state, client_id, &text).await;
                }
                Message::Binary(data) => {
                    if let Ok(text) = String::from_utf8(data.to_vec()) {
                        handle_message(&app_state, client_id, &text).await;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    state.app.broadcaster.remove_client(client_id);
}

async fn handle_message(state: &AppState, client_id: u64, text: &str) {
    let msg: WsMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            error!("Failed to parse WS message: {}", e);
            return;
        }
    };

    let result = match msg.namespace.as_str() {
        "project" => project::handle(state, client_id, &msg.name, &msg.data, msg.id).await,
        "terminal" => terminal::handle(state, client_id, &msg.name, &msg.data, msg.id).await,
        "shell-script" => {
            shell_script::handle(state, client_id, &msg.name, &msg.data, msg.id).await
        }
        _ => {
            error!("Unknown namespace: {}", msg.namespace);
            Ok(())
        }
    };

    if let Err(e) = result {
        error!(
            namespace = %msg.namespace,
            name = %msg.name,
            error = %e,
            "Route handler error"
        );
    }
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    info!("Shutting down...");
}
