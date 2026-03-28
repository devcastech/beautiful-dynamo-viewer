use tokio::sync::Mutex;
use aws_sdk_dynamodb::Client;
use crate::error::AppError;


// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub async fn query_table(
    client: tauri::State<'_, Mutex<Client>>,
    params: QueryParams,
) -> Result<QueryResult, AppError> {
    println!("{:?}", params);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
