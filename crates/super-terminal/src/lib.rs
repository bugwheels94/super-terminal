pub mod cleanup;
pub mod config;
pub mod db;
pub mod history;
pub mod pty;
pub mod server;
pub mod ws;

pub use config::Config;

use anyhow::Result;

/// Start the super-terminal server with the given configuration.
pub async fn start_server(config: Config) -> Result<()> {
    server::run(config).await
}
