use aws_sdk_dynamodb::Client;
use crate::error::AppError;
use std::{process::Command};
use tokio::sync::Mutex;

#[tauri::command]
pub async fn list_aws_profiles() -> Result<Vec<String>, AppError> {
    let profiles = Command::new("aws")
        .arg("configure")
        .arg("list-profiles")
        .output()
        .map_err(|e| AppError::from(e))?;

    let output = String::from_utf8_lossy(&profiles.stdout);
    let profiles: Vec<String> = output.lines().map(|l| l.to_string()).collect();
    Ok(profiles)
}

#[tauri::command]
pub async fn aws_sso_login(profile: String) -> Result<bool, AppError> {
    let result = tokio::process::Command::new("aws")
        .arg("sso")
        .arg("login")
        .arg("--profile")
        .arg(&profile)
        .output()
        .await
        .map_err(|e| AppError::from(e))?;

    Ok(result.status.success())
}

#[tauri::command]
pub async fn check_aws_profile(profile: String) -> Result<bool, AppError> {
    let result = tokio::process::Command::new("aws")
        .arg("sts")
        .arg("get-caller-identity")
        .arg("--profile")
        .arg(&profile)
        .output()
        .await
        .map_err(|e| AppError::from(e))?;

    Ok(result.status.success())
}

#[tauri::command]
pub async fn set_aws_profile(
    client: tauri::State<'_, Mutex<Client>>,
    profile: String,
    region: Option<String>,
) -> Result<(), AppError> {
    use aws_config::BehaviorVersion;
    let mut loader = aws_config::defaults(BehaviorVersion::latest()).profile_name(&profile);

    if let Some(region_str) = region {
        // aws_sdk_dynamodb::config::Region es un newtype sobre String
        use aws_config::meta::region::RegionProviderChain;
        use aws_sdk_dynamodb::config::Region;
        let region = Region::new(region_str);
        loader = loader.region(RegionProviderChain::first_try(region));
    }

    let new_config = loader.load().await;
    let new_client = Client::new(&new_config);

    // Tomar el lock y reemplazar el Client interior
    // MutexGuard hace deref a &mut Client, por eso funciona la asignación con *
    let mut guard = client.lock().await;
    *guard = new_client;

    Ok(())
}
