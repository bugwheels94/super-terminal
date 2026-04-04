use crate::error::{Error, Result};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tracing::{info, error};

/// Create a temporary askpass script that echoes a password.
/// Returns (temp_dir, script_path). The temp_dir must be kept alive until SSH is done.
fn setup_askpass(password: &str) -> Result<(PathBuf, PathBuf)> {
    let dir = std::env::temp_dir().join(format!("st-askpass-{}", std::process::id()));
    std::fs::create_dir_all(&dir)?;

    let pass_file = dir.join("pass");
    std::fs::write(&pass_file, password)?;

    let script = dir.join("askpass.sh");
    std::fs::write(&script, format!("#!/bin/sh\ncat '{}'", pass_file.display()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700))?;
    }

    Ok((dir, script))
}

/// Clean up askpass temp files.
fn cleanup_askpass(dir: &PathBuf) {
    std::fs::remove_dir_all(dir).ok();
}

/// Check if SSH stderr indicates an authentication failure.
fn is_auth_error(stderr: &str) -> bool {
    let lower = stderr.to_lowercase();
    lower.contains("permission denied")
        || lower.contains("authentication failed")
        || lower.contains("no more authentication methods")
        || lower.contains("too many authentication failures")
}

/// Apply common SSH options and password/askpass env vars to a Command.
fn apply_ssh_options(cmd: &mut Command, ssh_port: Option<u16>, identity_file: Option<&str>, password: Option<&str>) -> Option<PathBuf> {
    if let Some(port) = ssh_port {
        cmd.args(["-p", &port.to_string()]);
    }
    if let Some(key) = identity_file {
        cmd.args(["-i", key]);
    }

    if let Some(pw) = password {
        match setup_askpass(pw) {
            Ok((dir, script)) => {
                cmd.env("SSH_ASKPASS", &script);
                cmd.env("SSH_ASKPASS_REQUIRE", "force");
                cmd.env("DISPLAY", ":0");
                return Some(dir);
            }
            Err(e) => {
                error!("Failed to setup askpass: {}", e);
            }
        }
    }

    None
}

/// Auto-install super-terminal-headless on a remote host if not present,
/// then start it on the given port. Returns the actual remote port in use.
pub fn setup_remote(ssh_host: &str, ssh_port: Option<u16>, remote_port: u16, identity_file: Option<&str>, password: Option<&str>) -> Result<u16> {
    let ssh_host = ssh_host.trim();
    let mut cmd = Command::new("ssh");

    let askpass_dir = apply_ssh_options(&mut cmd, ssh_port, identity_file, password);
    cmd.args(["-o", "ClearAllForwardings=yes"]);

    // Check if headless binary exists, install if not, then start only if not already running
    // Outputs the port number (existing or new) on stdout
    let remote_cmd = format!(
        "which super-terminal-headless > /dev/null 2>&1 || \
         (curl -fsSL https://raw.githubusercontent.com/bugwheels94/super-terminal/master/install.sh | sh) && \
         EXISTING_PORT=$(ps aux | grep 'super-terminal-headless' | grep -v grep | grep -oP '\\-\\-port\\s+\\K[0-9]+' | head -1) && \
         if [ -n \"$EXISTING_PORT\" ]; then echo $EXISTING_PORT; \
         else nohup super-terminal-headless --port {} > /dev/null 2>&1 & echo {}; fi",
        remote_port, remote_port
    );

    cmd.arg(ssh_host)
        .arg(&remote_cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    info!("Full SSH command: {:?}", cmd);

    let output = cmd.output().map_err(|e| Error::Ssh(format!("Failed to run ssh setup: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    info!("SSH setup exit code: {}", output.status);
    info!("SSH setup stdout: '{}'", stdout);
    info!("SSH setup stderr: '{}'", stderr);

    // Clean up askpass temp files
    if let Some(dir) = askpass_dir {
        cleanup_askpass(&dir);
    }

    if !output.status.success() {
        let stderr_str = stderr.to_string();
        if is_auth_error(&stderr_str) {
            return Err(Error::SshAuth(format!("Authentication failed for {}", ssh_host)));
        }
        error!("SSH setup failed: {}", stderr_str);
        return Err(Error::Ssh(format!("SSH setup failed: {}", stderr_str)));
    }

    info!("Remote setup complete for {}", ssh_host);

    // Parse the actual port from stdout
    let actual_port = stdout.trim().parse::<u16>().unwrap_or(remote_port);
    info!("Remote port: {}", actual_port);
    Ok(actual_port)
}

/// Spawn an SSH tunnel: `ssh -N -L local_port:127.0.0.1:remote_port ssh_host`
/// The returned AskpassCleanup should be kept alive until the tunnel is no longer needed.
pub fn spawn_tunnel(
    ssh_host: &str,
    ssh_port: Option<u16>,
    remote_port: u16,
    local_port: u16,
    identity_file: Option<&str>,
    password: Option<&str>,
) -> Result<(Child, Option<PathBuf>)> {
    let ssh_host = ssh_host.trim();
    let mut cmd = Command::new("ssh");

    cmd.arg("-N"); // No remote command
    cmd.arg("-L");
    cmd.arg(format!("{}:127.0.0.1:{}", local_port, remote_port));

    let askpass_dir = apply_ssh_options(&mut cmd, ssh_port, identity_file, password);
    cmd.args(["-o", "ExitOnForwardFailure=no"]);

    cmd.arg(ssh_host);
    cmd.stdout(Stdio::null())
        .stderr(Stdio::piped());

    info!(
        "Spawning SSH tunnel: local:{} -> {}:{}",
        local_port, ssh_host, remote_port
    );

    let child = cmd.spawn().map_err(|e| Error::Ssh(format!("Failed to spawn SSH tunnel: {}", e)))?;

    info!("SSH tunnel started (pid: {})", child.id());
    Ok((child, askpass_dir))
}

/// Kill an SSH tunnel child process and clean up askpass files.
pub fn kill_tunnel(child: &mut Child, askpass_dir: Option<&PathBuf>) {
    info!("Killing SSH tunnel (pid: {})", child.id());
    child.kill().ok();
    child.wait().ok();
    if let Some(dir) = askpass_dir {
        cleanup_askpass(dir);
    }
}
