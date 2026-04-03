use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

/// Manages WebSocket client groups and broadcasting.
pub struct Broadcaster {
    inner: Mutex<BroadcasterInner>,
}

struct BroadcasterInner {
    /// group_name -> set of client_ids
    groups: HashMap<String, HashSet<u64>>,
    /// client_id -> sender channel
    clients: HashMap<u64, mpsc::UnboundedSender<String>>,
    next_id: u64,
}

impl Broadcaster {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(BroadcasterInner {
                groups: HashMap::new(),
                clients: HashMap::new(),
                next_id: 1,
            }),
        })
    }

    /// Register a new client, returns (client_id, receiver).
    pub fn add_client(&self) -> (u64, mpsc::UnboundedReceiver<String>) {
        let mut inner = self.inner.lock().unwrap();
        let id = inner.next_id;
        inner.next_id += 1;
        let (tx, rx) = mpsc::unbounded_channel();
        inner.clients.insert(id, tx);
        // Auto-join "global" group
        inner
            .groups
            .entry("global".to_string())
            .or_default()
            .insert(id);
        (id, rx)
    }

    /// Remove a client from all groups.
    pub fn remove_client(&self, client_id: u64) {
        let mut inner = self.inner.lock().unwrap();
        inner.clients.remove(&client_id);
        for members in inner.groups.values_mut() {
            members.remove(&client_id);
        }
    }

    /// Add a client to a group.
    pub fn join_group(&self, client_id: u64, group: &str) {
        let mut inner = self.inner.lock().unwrap();
        inner
            .groups
            .entry(group.to_string())
            .or_default()
            .insert(client_id);
    }

    /// Send a message to a specific client.
    pub fn send_to_client(&self, client_id: u64, message: &str) {
        let inner = self.inner.lock().unwrap();
        if let Some(tx) = inner.clients.get(&client_id) {
            let _ = tx.send(message.to_string());
        }
    }

    /// Send a message to all clients in a group.
    pub fn send_to_group(&self, group: &str, message: &str) {
        let inner = self.inner.lock().unwrap();
        if let Some(members) = inner.groups.get(group) {
            for &client_id in members {
                if let Some(tx) = inner.clients.get(&client_id) {
                    let _ = tx.send(message.to_string());
                }
            }
        }
    }
}
