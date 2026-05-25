mod commands;
mod error;
use aws_sdk_dynamodb::Client;
use tokio::sync::Mutex;
use aws_config::BehaviorVersion;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = tauri::async_runtime::block_on(async {
        let config = aws_config::defaults(BehaviorVersion::latest())
            .region("us-east-1")
            .load()
            .await;
        Client::new(&config)
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(client))
        .invoke_handler(tauri::generate_handler![
            commands::list_aws_profiles,
            commands::set_aws_profile,
            commands::aws_sso_login,
            commands::check_aws_profile,
            commands::query_table,
            commands::save_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
