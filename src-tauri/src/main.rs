// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tokio::task;
use util::log;

mod util;
mod ble;
mod serial;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
    .plugin(tauri_plugin_prevent_default::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_serialplugin::init())
    .plugin(tauri_plugin_btleplug::init())
    .setup(|app: &mut tauri::App| {
        #[cfg(mobile)]
        app.btleplug()
            .request_permissions(tauri_plugin_btleplug::permission::RequestPermission {
                bluetooth: true,
                bluetooth_admin: true,
                bluetooth_advertise: true,
                bluetooth_connect: true,
                bluetooth_scan: true,
            })
            .expect("error while requesting permissions");
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![start, stop])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/*
 * Tauri commands
 */

#[tauri::command]
async fn start(app_handle: tauri::AppHandle) -> Result<(), String> {
    let ble_task = task::spawn(ble::start(app_handle.clone()));
    let serial_task = task::spawn(serial::start(app_handle.clone()));
    log("Started connection");

    let _ = tokio::try_join!(ble_task, serial_task).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn stop() {
    log("Stopped connection");
}


