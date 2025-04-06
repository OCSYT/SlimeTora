use crate::util::log;

pub async fn start(app_handle: tauri::AppHandle, ports: Vec<String>) -> Result<(), String> {
    log(&format!("Starting serial connection on ports {:?}", ports));
    Ok(())
}

pub async fn stop(app_handle: tauri::AppHandle) -> Result<(), String> {
    log("Stopped serial connection");
    Ok(())
}