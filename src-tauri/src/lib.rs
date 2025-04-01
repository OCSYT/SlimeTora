use std::{thread::sleep, time::{self, Duration}};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_btleplug::{
    btleplug::{
        api::{Central, Manager as _, Peripheral, ScanFilter},
        platform::Manager,
    },
    BtleplugExt,
};
mod util;

#[tauri::command]
async fn start(app_handle: tauri::AppHandle) -> Result<(), String> {
    util::log("Started connection");
    let _ = app_handle
        .btleplug()
        .btleplug_context_spawn(async move {
            let manager = Manager::new().await.map_err(|e| e.to_string())?;
            let adapter_list = manager.adapters().await.map_err(|e| e.to_string())?;
            if adapter_list.is_empty() {
                return Err("No Bluetooth adapters found".to_string());
            }
            util::log(&format!(
                "Found {} Bluetooth adapters",
                adapter_list.len()
            ));

            for adapter in adapter_list {
                let info = adapter.adapter_info().await.unwrap_or_else(|_| "Unknown".to_string());
                util::log(&format!("Adapter: {}", info));
                adapter
                    .start_scan(ScanFilter::default())
                    .await
                    .expect("Failed to start scan");
                sleep(Duration::from_secs(2));
                let devices = adapter.peripherals().await.map_err(|e| e.to_string())?;
                if devices.is_empty() {
                    util::log("No devices found");
                } else {
                    for device in devices {
                        let properties = device.properties().await.map_err(|e| e.to_string());
                        let name = properties
                            .and_then(|p| Ok(p.unwrap().local_name))
                            .map(|n| n.unwrap_or_default());
                        util::log(&format!(
                            "Found Bluetooth device: {}",
                            name.unwrap_or("Unknown".to_string())
                        ));
                    }
                }
            }

            Ok(())
        })
        .await
        .expect("error during btleplug task");
    Ok(())
}

#[tauri::command]
fn stop() {
    util::log("Stopped connection");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
