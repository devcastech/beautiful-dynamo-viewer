mod commands;
mod error;
use aws_config::BehaviorVersion;
use aws_sdk_dynamodb::Client;
use tokio::sync::Mutex;

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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(client))
        .invoke_handler(tauri::generate_handler![
            commands::aws_profile::list_aws_profiles,
            commands::aws_profile::set_aws_profile,
            commands::aws_profile::aws_sso_login,
            commands::aws_profile::check_aws_profile,
            commands::workspace::save_text_file,
            commands::workspace::load_workspace,
            commands::workspace::save_workspace,
            commands::dynamodb::query_table,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
