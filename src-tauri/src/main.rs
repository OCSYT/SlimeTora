// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use futures::stream::StreamExt;
use tauri_plugin_btleplug::{
    btleplug::{
        api::{bleuuid::BleUuid, Central, CentralEvent, Manager as _, Peripheral, ScanFilter},
        platform::Manager,
    },
    BtleplugExt,
};

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
async fn start(app_handle: tauri::AppHandle) -> Result<(), String> {
    util::log("Started connection");
    let _ = app_handle
        .btleplug()
        .btleplug_context_spawn(async move {
            let manager = Manager::new().await.map_err(|e| e.to_string())?;
            let adapters = manager.adapters().await.map_err(|e| e.to_string())?;
            if adapters.is_empty() {
                return Err("No Bluetooth adapters found".to_string());
            }
            util::log(&format!("Found {} Bluetooth adapters", adapters.len()));

            let central = adapters.into_iter().nth(0).unwrap();
            let central_state = central.adapter_state().await.map_err(|e| e.to_string())?;
            println!("Central state: {:?}", central_state);

            let mut events = central.events().await.map_err(|e| e.to_string())?;

            let _ = central
                .start_scan(ScanFilter::default())
                .await
                .map_err(|e| e.to_string())?;

            while let Some(event) = events.next().await {
                match event {
                    CentralEvent::DeviceDiscovered(device) => {
                        let peripheral = central
                            .peripheral(&device)
                            .await
                            .map_err(|e| e.to_string())?;
                        let properties = peripheral
                            .properties()
                            .await
                            .map_err(|e| e.to_string())
                            .clone()?;
                        peripheral.is_connected().await.map_err(|e| e.to_string())?;

                        let name = properties.as_ref().and_then(|p| p.local_name.clone());
                        if let Some(name) = name {
                            // TODO: pass to a function that checks name, and if it matches, connect to the device
                            println!("Device discovered: {:?}", name);
                        }
                    }
                    CentralEvent::DeviceUpdated(id) => {
                        println!("DeviceUpdated: {:?}", id);
                        let peripheral =
                            central.peripheral(&id).await.map_err(|e| e.to_string())?;
                        let properties = peripheral
                            .properties()
                            .await
                            .map_err(|e| e.to_string())
                            .clone()?;
                        let name = properties.as_ref().and_then(|p| p.local_name.clone());
                        if let Some(name) = name {
                            // TODO: pass to a function that checks name, and if it matches, connect to the device
                            println!("Device updated: {:?}", name);
                        }
                    }
                    CentralEvent::StateUpdate(state) => {
                        println!("AdapterStatusUpdate {:?}", state);
                    }
                    CentralEvent::DeviceConnected(id) => {
                        println!("DeviceConnected: {:?}", id);
                    }
                    CentralEvent::DeviceDisconnected(id) => {
                        println!("DeviceDisconnected: {:?}", id);
                    }
                    CentralEvent::ManufacturerDataAdvertisement {
                        id,
                        manufacturer_data,
                    } => {
                        println!(
                            "ManufacturerDataAdvertisement: {:?}, {:?}",
                            id, manufacturer_data
                        );
                    }
                    CentralEvent::ServiceDataAdvertisement { id, service_data } => {
                        println!("ServiceDataAdvertisement: {:?}, {:?}", id, service_data);
                    }
                    CentralEvent::ServicesAdvertisement { id, services } => {
                        let services: Vec<String> =
                            services.into_iter().map(|s| s.to_short_string()).collect();
                        println!("ServicesAdvertisement: {:?}, {:?}", id, services);
                    }
                    _ => {}
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


