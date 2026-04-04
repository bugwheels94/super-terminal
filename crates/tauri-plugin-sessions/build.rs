const COMMANDS: &[&str] = &[
    "list_sessions",
    "create_session",
    "update_session",
    "delete_session",
    "connect_session",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
