use serde::{Deserialize, Serialize};

/// Incoming WebSocket message from client.
#[derive(Debug, Clone, Deserialize)]
pub struct WsMessage {
    pub namespace: String,
    pub name: String,
    pub data: serde_json::Value,
    pub id: Option<u64>,
}

/// Outgoing response (correlated by id).
#[derive(Debug, Clone, Serialize)]
pub struct WsResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Outgoing broadcast (named event).
#[derive(Debug, Clone, Serialize)]
pub struct WsBroadcast {
    pub name: String,
    pub data: serde_json::Value,
}

impl WsResponse {
    pub fn ok(id: Option<u64>, data: serde_json::Value) -> Self {
        Self {
            data: Some(data),
            id,
            error: None,
        }
    }

    pub fn ok_empty(id: Option<u64>) -> Self {
        Self {
            data: None,
            id,
            error: None,
        }
    }

    pub fn err(id: Option<u64>, error: String) -> Self {
        Self {
            data: None,
            id,
            error: Some(error),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}

impl WsBroadcast {
    pub fn new(name: &str, data: serde_json::Value) -> Self {
        Self {
            name: name.to_string(),
            data,
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}
