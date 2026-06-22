use aws_sdk_dynamodb::Client;
use crate::error::AppError;
use tokio::sync::Mutex;

fn aws() -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new("aws");
    // GUI apps on macOS don't inherit the shell PATH; prepend common install locations.
    #[cfg(target_os = "macos")] {
        let existing = std::env::var("PATH").unwrap_or_default();
        cmd.env("PATH", format!("/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:{existing}"));
    }
    cmd
}

#[tauri::command]
pub async fn list_aws_profiles() -> Result<Vec<String>, AppError> {
    let out = aws()
        .arg("configure")
        .arg("list-profiles")
        .output()
        .await
        .map_err(AppError::from)?;

    let profiles = String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(|l| l.to_string())
        .collect();
    Ok(profiles)
}

#[tauri::command]
pub async fn aws_sso_login(profile: String) -> Result<bool, AppError> {
    let result = aws()
        .arg("sso")
        .arg("login")
        .arg("--profile")
        .arg(&profile)
        .output()
        .await
        .map_err(AppError::from)?;

    Ok(result.status.success())
}

#[tauri::command]
pub async fn check_aws_profile(profile: String) -> Result<bool, AppError> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(20),
        aws()
            .arg("sts")
            .arg("get-caller-identity")
            .arg("--profile")
            .arg(&profile)
            .env("AWS_PAGER", "")
            .output(),
    )
    .await
    .map_err(|_| AppError { message: "profile check timed out".into() })?
    .map_err(AppError::from)?;

    Ok(output.status.success())
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
