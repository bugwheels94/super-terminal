use anyhow::Result;
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "super-terminal", about = "Terminal management server")]
struct Cli {
    /// Port to listen on
    #[arg(short, long)]
    port: Option<u16>,

    /// Host to bind to
    #[arg(long)]
    host: Option<String>,

    /// Authentication password
    #[arg(long)]
    password: Option<String>,

    /// Path to TLS certificate
    #[arg(long)]
    cert: Option<String>,

    /// Path to TLS key
    #[arg(long)]
    key: Option<String>,

    /// Path to UI static files
    #[arg(long)]
    ui: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "super_terminal=info".into()),
        )
        .init();

    let cli = Cli::parse();

    let mut config = super_terminal::Config::load()?;

    if let Some(port) = cli.port {
        config.port = port;
    }
    if let Some(host) = cli.host {
        config.host = host;
    }
    if let Some(password) = cli.password {
        config.auth_password = password;
    }
    if let Some(cert) = cli.cert {
        config.cert = Some(cert);
    }
    if let Some(key) = cli.key {
        config.key = Some(key);
    }
    if let Some(ui) = cli.ui {
        config.ui_path = Some(ui);
    }

    super_terminal::start_server(config).await
}
