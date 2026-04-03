use sqlx::SqlitePool;
use std::time::Duration;
use tokio::time;
use tracing::{error, info};

use crate::db::queries;
use crate::history;

/// Start background cleanup tasks.
pub fn start(pool: SqlitePool) {
    // Log archival every 4 hours
    let pool_cleanup = pool.clone();
    tokio::spawn(async move {
        run_cleanup(&pool_cleanup).await;

        let mut interval = time::interval(Duration::from_secs(4 * 60 * 60));
        interval.tick().await;
        loop {
            interval.tick().await;
            run_cleanup(&pool_cleanup).await;
        }
    });

    // Log size enforcement every 10 minutes
    let pool_log_size = pool.clone();
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(10 * 60));
        loop {
            interval.tick().await;
            check_log_size_limits(&pool_log_size).await;
        }
    });

    // Shell history import every 30 seconds
    let pool_history = pool;
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Err(e) = history::import_history(&pool_history).await {
                error!("Shell history import failed: {}", e);
            }
        }
    });
}

async fn run_cleanup(pool: &SqlitePool) {
    info!("Running log cleanup");
    if let Err(e) = queries::archive_old_logs(pool).await {
        error!("Log archival failed: {}", e);
    }
    if let Err(e) = queries::delete_old_archives(pool, 7).await {
        error!("Archive cleanup failed: {}", e);
    }
}

async fn check_log_size_limits(pool: &SqlitePool) {
    let projects = match queries::get_projects_with_log_limit(pool).await {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to get projects with log limits: {}", e);
            return;
        }
    };

    for project in projects {
        if let Some(max_mb) = project.max_log_size_mb {
            let max_bytes = max_mb * 1024 * 1024;
            match queries::get_project_log_size_bytes(pool, project.id).await {
                Ok(size) if size > max_bytes => {
                    info!(
                        "Project {} logs ({} bytes) exceed limit ({} bytes), deleting",
                        project.slug, size, max_bytes
                    );
                    if let Err(e) = queries::delete_project_logs(pool, project.id).await {
                        error!("Failed to auto-delete logs for project {}: {}", project.slug, e);
                    }
                }
                Err(e) => {
                    error!("Failed to get log size for project {}: {}", project.slug, e);
                }
                _ => {}
            }
        }
    }
}
