use std::{
    thread::sleep,
    time::{self, Duration},
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use futures::stream::StreamExt;
use tauri_plugin_btleplug::{
    btleplug::{
        api::{bleuuid::BleUuid, Central, CentralEvent, Manager as _, Peripheral, ScanFilter},
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
            let adapters = manager.adapters().await.unwrap();
            if adapters.is_empty() {
                return Err("No Bluetooth adapters found".to_string());
            }
            util::log(&format!("Found {} Bluetooth adapters", adapters.len()));

            let central = adapters.into_iter().nth(0).unwrap();
            let central_state = central.adapter_state().await.unwrap();
            println!("Central state: {:?}", central_state);

            let mut events = central.events().await.unwrap();

            let _ = central.start_scan(ScanFilter::default()).await;

            while let Some(event) = events.next().await {
                match event {
                    CentralEvent::DeviceDiscovered(device) => {
                        let peripheral = central.peripheral(&device).await.unwrap();
                        let name = peripheral.properties().await.unwrap().unwrap().local_name;
                        if let Some(name) = name {
                            util::log(&format!("Discovered device: {}", name));
                        } else {
                            util::log("Discovered device with no name");
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
