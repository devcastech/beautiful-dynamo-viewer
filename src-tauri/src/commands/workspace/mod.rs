use crate::error::AppError;

/// Escribe `contents` en `path` (la ruta la elige el usuario en el "Guardar como…" nativo).
/// Va por Rust en vez del plugin-fs para no lidiar con su scope de rutas permitidas.
#[tauri::command]
pub async fn save_text_file(path: String, contents: String) -> Result<(), AppError> {
    std::fs::write(&path, contents)?;
    Ok(())
}

fn workspace_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, AppError> {
    use tauri::Manager;
    Ok(app.path().app_data_dir()?.join("workspace.json"))
}

/// Contenido de workspace.json en el app-data dir, o None si todavía no existe
/// (primer arranque — el frontend siembra los schemas de ejemplo).
#[tauri::command]
pub async fn load_workspace(app: tauri::AppHandle) -> Result<Option<String>, AppError> {
    let path = workspace_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Escritura atómica: tmp + rename, para no dejar un workspace.json truncado
/// si la app muere a mitad de escritura.
#[tauri::command]
pub async fn save_workspace(app: tauri::AppHandle, contents: String) -> Result<(), AppError> {
    let path = workspace_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, contents)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}
