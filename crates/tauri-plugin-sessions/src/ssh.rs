use crate::error::{Error, Result};
use std::process::{Child, Command, Stdio};
use tracing::{info, error};

/// Auto-install super-terminal-headless on a remote host if not present,
/// then start it on the given port.
pub fn setup_remote(ssh_host: &str, ssh_port: Option<u16>, remote_port: u16, identity_file: Option<&str>) -> Result<()> {
    let mut cmd = Command::new("ssh");

    if let Some(port) = ssh_port {
        cmd.args(["-p", &port.to_string()]);
    }
    if let Some(key) = identity_file {
        cmd.args(["-i", key]);
    }

    // Check if headless binary exists, install if not, then start in background
    let remote_cmd = format!(
        "which super-terminal-headless > /dev/null 2>&1 || \
         (curl -fsSL https://raw.githubusercontent.com/bugwheels94/super-terminal/master/install.sh | sh) && \
         nohup super-terminal-headless --port {} > /dev/null 2>&1 &",
        remote_port
    );

    cmd.arg(ssh_host)
        .arg(&remote_cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    info!("Setting up remote: ssh {} '{}'", ssh_host, remote_cmd);

    let output = cmd.output().map_err(|e| Error::Ssh(format!("Failed to run ssh setup: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("SSH setup failed: {}", stderr);
        return Err(Error::Ssh(format!("SSH setup failed: {}", stderr)));
    }

    info!("Remote setup complete for {}", ssh_host);
    Ok(())
}

/// Spawn an SSH tunnel: `ssh -N -L local_port:127.0.0.1:remote_port ssh_host`
pub fn spawn_tunnel(
    ssh_host: &str,
    ssh_port: Option<u16>,
    remote_port: u16,
    local_port: u16,
    identity_file: Option<&str>,
) -> Result<Child> {
    let mut cmd = Command::new("ssh");

    cmd.arg("-N"); // No remote command
    cmd.arg("-L");
    cmd.arg(format!("{}:127.0.0.1:{}", local_port, remote_port));

    if let Some(port) = ssh_port {
        cmd.args(["-p", &port.to_string()]);
    }
    if let Some(key) = identity_file {
        cmd.args(["-i", key]);
    }

    // Exit if tunnel fails, don't ask for passwords
    cmd.args(["-o", "BatchMode=yes"]);
    cmd.args(["-o", "ExitOnForwardFailure=yes"]);

    cmd.arg(ssh_host);
    cmd.stdout(Stdio::null())
        .stderr(Stdio::piped());

    info!(
        "Spawning SSH tunnel: local:{} -> {}:{}",
        local_port, ssh_host, remote_port
    );

    let child = cmd.spawn().map_err(|e| Error::Ssh(format!("Failed to spawn SSH tunnel: {}", e)))?;

    info!("SSH tunnel started (pid: {})", child.id());
    Ok(child)
}

/// Kill an SSH tunnel child process.
pub fn kill_tunnel(child: &mut Child) {
    info!("Killing SSH tunnel (pid: {})", child.id());
    child.kill().ok();
    child.wait().ok();
}
