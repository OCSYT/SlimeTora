use crate::util::log;

pub async fn start(app_handle: tauri::AppHandle) -> Result<(), String> {
    log("Started serial connection");
    Ok(())
}

pub async fn stop(app_handle: tauri::AppHandle) -> Result<(), String> {
    log("Stopped serial connection");
    Ok(())
}