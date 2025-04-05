// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures::future;
use tauri::AppHandle;
use tokio::task;
use util::log;

mod ble;
mod serial;
mod util;

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
async fn start(app_handle: AppHandle, modes: Vec<String>) -> Result<(), String> {
    let mut tasks: Vec<task::JoinHandle<Result<(), String>>> = vec![];

    log(&format!("Starting connection with modes: {:?}", modes));

    if modes.contains(&"ble".to_string()) {
        let ble_task = task::spawn(async move { ble::start(app_handle.clone()).await });
        tasks.push(ble_task);
        log("Starting BLE connection");
    } else if modes.contains(&"serial".to_string()) {
        let serial_task = task::spawn(async move { serial::start(app_handle.clone()).await });
        tasks.push(serial_task);
        log("Starting Serial connection");
    } else {
        return Err("No valid connection type provided".to_string());
    }

    for result in future::join_all(tasks).await {
        match result {
            Ok(inner_result) => inner_result.map_err(|e| {
                log(&format!("Failed to start connection: {}", e));
                "Failed to start connection".to_string()
            })?,
            Err(join_error) => {
                log(&format!("Task join error: {}", join_error));
                return Err("Failed to start connection".to_string());
            }
        }
    }

    log("Started connection");
    Ok(())
}

#[tauri::command]
async fn stop(app_handle: AppHandle, modes: Vec<String>) -> Result<(), String> {
    let mut tasks: Vec<task::JoinHandle<Result<(), String>>> = vec![];

    if modes.contains(&"ble".to_string()) {
        let ble_task = task::spawn(async move { ble::stop(app_handle.clone()).await });
        tasks.push(ble_task);
    } else if modes.contains(&"serial".to_string()) {
        let serial_task = task::spawn(async move { serial::stop(app_handle.clone()).await });
        tasks.push(serial_task);
    } else {
        return Err("No valid connection type provided".to_string());
    }

    log("Stopped connection");
    Ok(())
}
