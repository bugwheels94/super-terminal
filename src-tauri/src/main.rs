#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "super_terminal=info".into()),
        )
        .init();

    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");

    tauri::Builder::default()
        .plugin(tauri_plugin_sessions::init())
        .setup(move |app| {
            // Start the local backend server
            let config = super_terminal::Config::load().unwrap_or_default();
            std::thread::spawn(move || {
                rt.block_on(async {
                    if let Err(e) = super_terminal::start_server(config).await {
                        eprintln!("Server error: {}", e);
                    }
                });
            });

            // Open sessions UI
            let _window = tauri::WebviewWindowBuilder::new(
                app,
                "sessions-settings",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Super Terminal — Sessions")
            .inner_size(600.0, 400.0)
            .resizable(true)
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
