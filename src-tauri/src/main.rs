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
        .setup(move |app| {
            let config = super_terminal::Config::load().unwrap_or_default();
            let port = config.port;

            // Spawn the super-terminal server in background
            std::thread::spawn(move || {
                rt.block_on(async {
                    if let Err(e) = super_terminal::start_server(config).await {
                        eprintln!("Server error: {}", e);
                    }
                });
            });

            // Wait for server to be ready
            std::thread::sleep(std::time::Duration::from_millis(500));
            let url = format!("http://127.0.0.1:{}", port);
            let _window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title("Super Terminal")
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
