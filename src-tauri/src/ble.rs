use std::sync::Arc;
use tokio::sync::Mutex;

use crate::util::log;
use futures::stream::StreamExt;
use once_cell::sync::Lazy;
use tauri_plugin_btleplug::{
    btleplug::{
        api::{bleuuid::BleUuid, Central, CentralEvent, Manager as _, Peripheral, ScanFilter},
        platform::{Manager, PeripheralId},
    },
    BtleplugExt,
};

/*
 * BLE constants
*/

struct BleState {
    manager: Option<Manager>,
    central: Option<tauri_plugin_btleplug::btleplug::platform::Adapter>,
    connected_devices: Vec<PeripheralId>,
}

static BLE_STATE: Lazy<Arc<Mutex<BleState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(BleState {
        manager: None,
        central: None,
        connected_devices: Vec::new(),
    }))
});

pub async fn start(app_handle: tauri::AppHandle) {
    log("Started BLE connection");
    let _ = app_handle
        .btleplug()
        .btleplug_context_spawn(async move {
            let manager = Manager::new().await.map_err(|e| e.to_string())?;
            let adapters = manager.adapters().await.map_err(|e| e.to_string())?;
            if adapters.is_empty() {
                return Err("No Bluetooth adapters found".to_string());
            }
            log(&format!("Found {} Bluetooth adapters", adapters.len()));

            let central = adapters.into_iter().nth(0).unwrap();
            let central_state = central.adapter_state().await.map_err(|e| e.to_string())?;
            println!("Central state: {:?}", central_state);

            {
                let mut state = BLE_STATE.lock().await;
                state.manager = Some(manager);
                state.central = Some(central.clone());
            }

            let mut events = central.events().await.map_err(|e| e.to_string())?;

            let _ = central
                .start_scan(ScanFilter::default())
                .await
                .map_err(|e| e.to_string())?;

            while let Some(event) = events.next().await {
                match event {
                    CentralEvent::DeviceDiscovered(id) => {
                        let peripheral =
                            central.peripheral(&id).await.map_err(|e| e.to_string())?;
                        check_device(peripheral, id).await;
                    }
                    CentralEvent::DeviceUpdated(id) => {
                        let peripheral =
                            central.peripheral(&id).await.map_err(|e| e.to_string())?;
                        check_device(peripheral, id).await;
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
                    _ => {}
                }
            }
            Ok(())
        })
        .await
        .expect("error during btleplug task");
}

pub async fn stop(app_handle: tauri::AppHandle) {
    log("Stopping BLE connection");
    let _ = app_handle
        .btleplug()
        .btleplug_context_spawn(async move {
            let mut state = BLE_STATE.lock().await;

            if let Some(central) = &state.central {
                if let Err(e) = central.stop_scan().await {
                    log(&format!("Error stopping scan: {}", e));
                } else {
                    log("Stopped BLE scanning");
                }
            }

            log("Disconnecting all connected devices");
            if let Some(central) = &state.central {
                for id in &state.connected_devices {
                    log(&format!("Disconnecting device {:?}", id));
                    if let Ok(device) = central.peripheral(id).await {
                        if let Err(e) = disconnect(device).await {
                            log(&format!("Failed to disconnect device {:?}: {}", id, e));
                        } else {
                            log(&format!("Disconnected device {:?}", id));
                        }
                    }
                }
                state.connected_devices.clear();
            }

            state.central = None;
            state.manager = None;

            Ok::<(), String>(())
        })
        .await
        .expect("error during btleplug stop task");

    log("Stopped BLE connection");
}

async fn check_device(
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
    id: PeripheralId,
) {
    let properties = device
        .properties()
        .await
        .map_err(|e| e.to_string())
        .unwrap();
    let name = properties
        .unwrap()
        .local_name
        .unwrap_or_else(|| "Unknown".to_string());

    if name.contains("Haritora") {
        println!("Found Haritora device: {:?}", id);
        connect(device.clone()).await.unwrap();
        let mut state = BLE_STATE.lock().await;
        state.connected_devices.push(id.clone());
        println!("Connected devices: {:?}", state.connected_devices);
    }
}

async fn connect(
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
) -> Result<(), String> {
    device.connect().await.map_err(|e| e.to_string())?;
    device
        .discover_services()
        .await
        .map_err(|e| e.to_string())?;
    let services = device.services();
    for service in services {
        println!("Service: {:?}", service);
    }

    let chars = device.characteristics();
    for char in chars {
        println!("Characteristic: {:?}", char);
    }

    // TODO: if find all required services and characteristics, start broadcasting data to frontend
    // broadcasting(device.clone())

    Ok(())
}

async fn disconnect(
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
) -> Result<(), String> {
    device.disconnect().await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn broadcasting(
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
) -> Result<(), String> {
    let characteristics = device.characteristics();
    for characteristic in characteristics {
        // TODO: subscribe to all characteristics and broadcast data to frontend
    }
    Ok(())
}
