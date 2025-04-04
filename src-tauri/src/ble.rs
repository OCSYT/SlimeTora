use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::util::log;
use futures::stream::StreamExt;
use once_cell::sync::Lazy;
use tauri_plugin_btleplug::{
    btleplug::{
        api::{bleuuid::BleUuid, Central, CentralEvent, CharPropFlags, Manager as _, Peripheral, ScanFilter},
        platform::{Manager, PeripheralId},
    },
    BtleplugExt,
};

/*
 * BLE constants
*/

// HaritoraX Wireless
static SERVICES: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("1800", "Generic Access");
    map.insert("1801", "Generic Attribute");
    map.insert("180a", "Device Information");
    map.insert("180f", "Battery Service");
    map.insert("fe59", "DFU Service");
    map.insert("00dbec3a-90aa-11ed-a1eb-0242ac120002", "Tracker Service");
    map.insert("ef84369a-90a9-11ed-a1eb-0242ac120002", "Setting Service");
    map
});

// HaritoraX Wireless
static CHARACTERISTICS: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("2a19", "BatteryLevel");
    map.insert("2a25", "SerialNumber");
    map.insert("2a29", "Manufacturer");
    map.insert("2a27", "HardwareRevision");
    map.insert("2a26", "FirmwareRevision");
    map.insert("2a28", "SoftwareRevision");
    map.insert("2a24", "ModelNumber");
    map.insert("00dbf1c6-90aa-11ed-a1eb-0242ac120002", "Sensor");
    map.insert("00dbf07c-90aa-11ed-a1eb-0242ac120002", "NumberOfImu");
    map.insert("00dbf306-90aa-11ed-a1eb-0242ac120002", "Magnetometer");
    map.insert("00dbf450-90aa-11ed-a1eb-0242ac120002", "MainButton");
    map.insert("00dbf586-90aa-11ed-a1eb-0242ac120002", "SecondaryButton");
    map.insert("00dbf6a8-90aa-11ed-a1eb-0242ac120002", "TertiaryButton");
    map.insert("ef844202-90a9-11ed-a1eb-0242ac120002", "FpsSetting");
    map.insert("ef8443f6-90a9-11ed-a1eb-0242ac120002", "TofSetting");
    map.insert("ef8445c2-90a9-11ed-a1eb-0242ac120002", "SensorModeSetting");
    map.insert("ef84c300-90a9-11ed-a1eb-0242ac120002", "WirelessModeSetting");
    map.insert(
        "ef84c305-90a9-11ed-a1eb-0242ac120002",
        "AutoCalibrationSetting",
    );
    map.insert("ef844766-90a9-11ed-a1eb-0242ac120002", "SensorDataControl");
    map.insert("ef843b54-90a9-11ed-a1eb-0242ac120002", "BatteryVoltage");
    map.insert("ef843cb2-90a9-11ed-a1eb-0242ac120002", "ChargeStatus");
    map.insert("8ec90003-f315-4f60-9fb8-838830daea50", "DFUControl");
    map.insert("0c900914-a85e-11ed-afa1-0242ac120002", "CommandMode");
    map.insert("0c900c84-a85e-11ed-afa1-0242ac120002", "Command");
    map.insert("0c900df6-a85e-11ed-afa1-0242ac120002", "Response");
    map
});

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
    let app_handle_clone = app_handle.clone();
    let _ = app_handle_clone
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
                        check_device(app_handle.clone(), peripheral, id).await;
                    }
                    CentralEvent::DeviceUpdated(id) => {
                        let peripheral =
                            central.peripheral(&id).await.map_err(|e| e.to_string())?;
                        check_device(app_handle.clone(), peripheral, id).await;
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
    app_handle: tauri::AppHandle,
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
        connect(app_handle, device.clone()).await.unwrap();
        let mut state = BLE_STATE.lock().await;
        state.connected_devices.push(id.clone());
        println!("Connected devices: {:?}", state.connected_devices);
    }
}

static REQUIRED_SERVICES: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("00dbec3a-90aa-11ed-a1eb-0242ac120002", "Tracker Service");
    map.insert("ef84369a-90a9-11ed-a1eb-0242ac120002", "Setting Service");
    map
});

static REQUIRED_CHARS: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("00dbf1c6-90aa-11ed-a1eb-0242ac120002", "Sensor");
    map.insert("00dbf450-90aa-11ed-a1eb-0242ac120002", "MainButton");
    map
});

async fn connect(
    app_handle: tauri::AppHandle,
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
) -> Result<(), String> {
    device.connect().await.map_err(|e| e.to_string())?;
    device
        .discover_services()
        .await
        .map_err(|e| e.to_string())?;
    let services = device.services();
    for service in services.iter() {
        println!("Service: {:?}", service);
    }

    let chars = device.characteristics();
    for char in chars.iter() {
        println!("Characteristic: {:?}", char);
    }

    // TODO: if find all required services and characteristics, start broadcasting data to frontend
    if REQUIRED_SERVICES
        .keys()
        .all(|service| services.iter().any(|s| s.uuid.to_string() == *service))
        && REQUIRED_CHARS
            .keys()
            .all(|char| chars.iter().any(|c| c.uuid.to_string() == *char))
    {
        println!("All required services and characteristics found");
        broadcasting(app_handle, device.clone()).await.unwrap();
    } else {
        println!("Not all required services or characteristics found");
        disconnect(device.clone()).await.unwrap();
        for service in REQUIRED_SERVICES.keys() {
            if !services.iter().any(|s| s.uuid.to_string() == *service) {
                println!("Missing service: {}", service);
            }
        }
        for char in REQUIRED_CHARS.keys() {
            if !chars.iter().any(|c| c.uuid.to_string() == *char) {
                println!("Missing characteristic: {}", char);
            }
        }
        return Err("Not all required services or characteristics found".to_string());
    }

    Ok(())
}

async fn disconnect(
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
) -> Result<(), String> {
    device.disconnect().await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn broadcasting(
    app_handle: tauri::AppHandle,
    device: tauri_plugin_btleplug::btleplug::platform::Peripheral,
) -> Result<(), String> {
    let characteristics = device.characteristics();
    let device_clone = device.clone();
    for characteristic in characteristics {
        // check if you can subscribe to characteristic, and if so, subscribe to notify frontend
        if characteristic.properties.contains(CharPropFlags::NOTIFY) {
            let _ = device_clone
            .subscribe(&characteristic)
            .await
            .map_err(|e| e.to_string())?;
            println!("Subscribed to characteristic: {:?}", characteristic);

            let characteristic_name = CHARACTERISTICS
                .iter()
                .find_map(|(uuid, name)| {
                    if characteristic.uuid.to_string() == *uuid {
                        Some(*name)
                    } else {
                        None
                    }
                })
                .unwrap_or("Unknown");

            let mut notification_stream = device_clone.notifications().await.map_err(|e| e.to_string())?;
            let app_handle_clone = app_handle.clone();
            let device_clone = device.clone();

            tokio::spawn(async move {
                while let Some(data) = notification_stream.next().await {
                    println!(
                        "Received data from {} ({}): {:?}",
                        characteristic_name, characteristic.uuid, data.value
                    );

                    // emit data to tauri frontend with name of peripheral, service, characteristic, and data
                    let peripheral_name = device_clone.properties().await.unwrap().unwrap().local_name.unwrap_or_else(|| "Unknown".to_string());
                    let service_name = SERVICES
                        .iter()
                        .find_map(|(uuid, name)| {
                            if characteristic.service_uuid.to_string() == *uuid {
                                Some(*name)
                            } else {
                                None
                            }
                        })
                        .unwrap_or("Unknown");
                    let characteristic_name = CHARACTERISTICS
                        .iter()
                        .find_map(|(uuid, name)| {
                            if characteristic.uuid.to_string() == *uuid {
                                Some(*name)
                            } else {
                                None
                            }
                        })
                        .unwrap_or("Unknown");
                    let data = data.value.clone();

                    if let Err(e) = app_handle_clone.emit(
                        "ble_notification",
                        serde_json::json!({
                            "peripheral_name": peripheral_name,
                            "service_name": service_name,
                            "characteristic_name": characteristic_name,
                            "data": data,
                        }),
                    ) {
                        log(&format!("Failed to emit BLE notification: {}", e));
                    }
                }
            });
        }
    }
    Ok(())
}
