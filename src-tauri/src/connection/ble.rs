use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_btleplug::{btleplug::api::WriteType, BtleplugExt};
use tokio::sync::Mutex;

use once_cell::sync::Lazy;
use tauri_plugin_btleplug::btleplug::{
    self,
    api::{Central, CentralEvent, CharPropFlags, Manager as _, Peripheral, ScanFilter},
    platform::{Manager, PeripheralId},
};

use crate::log;

/*
 * BLE constants
*/

// HaritoraX Wireless (2?)
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

// HaritoraX Wireless (2?)
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
    map.insert(
        "ef84c300-90a9-11ed-a1eb-0242ac120002",
        "WirelessModeSetting",
    );
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
    central: Option<btleplug::platform::Adapter>,
    connected_devices: Vec<PeripheralId>,
}

static BLE_STATE: Lazy<Arc<Mutex<BleState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(BleState {
        manager: None,
        central: None,
        connected_devices: Vec::new(),
    }))
});

async fn get_device_name(device: &btleplug::platform::Peripheral) -> String {
    device
        .properties()
        .await
        .map(|p| p.and_then(|pp| pp.local_name))
        .unwrap_or(Some("Unknown".to_string()))
        .unwrap_or_else(|| "Unknown".to_string())
}

pub async fn start(app_handle: tauri::AppHandle) -> Result<(), String> {
    log!("Started BLE connection");
    let app_handle_clone = app_handle.clone();
    let btleplug_result = app_handle_clone
        .btleplug()
        .btleplug_context_spawn(async move {
            let manager = Manager::new().await.map_err(|e| e.to_string())?;
            let adapters = manager.adapters().await.map_err(|e| e.to_string())?;
            if adapters.is_empty() {
                return Err("No Bluetooth adapters found".to_string());
            }
            log!("Found {} Bluetooth adapters", adapters.len());

            let central = adapters.into_iter().next().unwrap();
            let central_state = central.adapter_state().await.map_err(|e| e.to_string())?;
            log!("Central state: {:?}", central_state);

            {
                let mut state = BLE_STATE.lock().await;
                state.manager = Some(manager);
                state.central = Some(central.clone());
            }

            let mut events = central.events().await.map_err(|e| e.to_string())?;
            let central_clone = central.clone();

            central
                .start_scan(ScanFilter::default())
                .await
                .map_err(|e| e.to_string())?;

            while let Some(event) = events.next().await {
                match event {
                    CentralEvent::DeviceDiscovered(id) => {
                        let app_handle_clone = app_handle.clone();
                        let central_clone = central_clone.clone();
                        tokio::spawn(async move {
                            match central_clone.peripheral(&id).await {
                                Ok(peripheral) => {
                                    if let Err(e) =
                                        check_device(app_handle_clone, peripheral, id).await
                                    {
                                        log!("Error checking device: {}", e);
                                    }
                                }
                                Err(e) => log!("Error getting peripheral: {}", e),
                            }
                        });
                    }
                    CentralEvent::DeviceUpdated(id) => {
                        let app_handle_clone = app_handle.clone();
                        let central_clone = central_clone.clone();
                        tokio::spawn(async move {
                            match central_clone.peripheral(&id).await {
                                Ok(peripheral) => {
                                    if let Err(e) =
                                        check_device(app_handle_clone, peripheral, id).await
                                    {
                                        log!("Error checking device: {}", e);
                                    }
                                }
                                Err(e) => log!("Error getting peripheral: {}", e),
                            }
                        });
                    }
                    CentralEvent::StateUpdate(state) => {
                        log!("AdapterStatusUpdate {:?}", state);
                    }
                    CentralEvent::DeviceConnected(id) => {
                        let app_handle_clone = app_handle.clone();
                        let central_clone = central_clone.clone();
                        tokio::spawn(async move {
                            match central_clone.peripheral(&id).await {
                                Ok(peripheral) => {
                                    let name = get_device_name(&peripheral).await;
                                    log!("DeviceConnected: {} ({:?})", name, id);

                                    if let Err(e) = app_handle_clone.emit("device_connected", name)
                                    {
                                        log!("Failed to emit device_connected: {}", e);
                                    }
                                }
                                Err(e) => log!("Error getting peripheral: {}", e),
                            }
                        });
                    }
                    CentralEvent::DeviceDisconnected(id) => {
                        let app_handle_clone = app_handle.clone();
                        let central_clone = central_clone.clone();
                        tokio::spawn(async move {
                            match central_clone.peripheral(&id).await {
                                Ok(peripheral) => {
                                    let name = get_device_name(&peripheral).await;
                                    log!("DeviceDisconnected: {} ({:?})", name, id);

                                    if let Err(e) =
                                        app_handle_clone.emit("device_disconnected", name)
                                    {
                                        log!("Failed to emit device_disconnected: {}", e);
                                    }
                                }
                                Err(e) => log!("Error getting peripheral: {}", e),
                            }
                        });
                    }
                    _ => {}
                }
            }
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?;

    match btleplug_result {
        Ok(_) => {}
        Err(e) => {
            log!("Error during btleplug task: {}", e);
            return Err(e);
        }
    }

    log!("Started BLE connection");
    Ok(())
}

pub async fn stop(app_handle: tauri::AppHandle) -> Result<(), String> {
    log!("Stopping BLE connection");
    let _ = app_handle
        .btleplug()
        .btleplug_context_spawn(async move {
            let mut state = BLE_STATE.lock().await;

            if let Some(central) = &state.central {
                if let Err(e) = central.stop_scan().await {
                    log!("Error stopping scan: {}", e);
                } else {
                    log!("Stopped BLE scanning");
                }
            }

            log!("Disconnecting all connected devices");
            if let Some(central) = &state.central {
                for id in &state.connected_devices {
                    log!("Disconnecting device {:?}", id);
                    if let Ok(device) = central.peripheral(id).await {
                        if let Err(e) = disconnect(device).await {
                            log!("Failed to disconnect device {:?}: {}", id, e);
                        } else {
                            log!("Disconnected device {:?}", id);
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

    log!("Stopped BLE connection");
    Ok(())
}

pub async fn write(
    device_name: &str,
    characteristic_uuid: &str,
    data: Vec<u8>,
    expecting_response: bool,
) -> Result<Option<Vec<u8>>, String> {
    let device = find_device_by_name(device_name).await?;

    if let Some(characteristic) = find_characteristic_by_uuid(&device, characteristic_uuid) {
        let write_type = if expecting_response {
            WriteType::WithResponse
        } else {
            WriteType::WithoutResponse
        };

        if let Err(e) = device.write(&characteristic, &data, write_type).await {
            log!(
                "Failed to write to characteristic {:?}: {}",
                characteristic,
                e
            );
            return Err(e.to_string());
        }

        if expecting_response {
            return device.read(&characteristic).await.map(Some).map_err(|e| {
                log!(
                    "Failed to read response from characteristic {:?}: {}",
                    characteristic,
                    e
                );
                e.to_string()
            });
        }

        Ok(None)
    } else {
        Err("Characteristic not found".to_string())
    }
}

pub async fn read(device_name: &str, characteristic_uuid: &str) -> Result<Vec<u8>, String> {
    let device = find_device_by_name(device_name).await?;

    if let Some(characteristic) = find_characteristic_by_uuid(&device, characteristic_uuid) {
        device
            .read(&characteristic)
            .await
            .map_err(|_| "Failed to read from characteristic".to_string())
    } else {
        Err("Characteristic not found".to_string())
    }
}

async fn find_device_by_name(device_name: &str) -> Result<btleplug::platform::Peripheral, String> {
    let state = BLE_STATE.lock().await;

    let central = state.central.as_ref().ok_or("Central not initialized")?;
    let peripherals = central.peripherals().await.map_err(|e| e.to_string())?;

    peripherals
        .into_iter()
        .find(|p| {
            let device_name = device_name.to_string();
            let properties = tokio::runtime::Handle::current()
                .block_on(async { p.properties().await.ok().flatten() });
            properties
                .and_then(|props| props.local_name)
                .is_some_and(|name| name == device_name)
        })
        .ok_or("Device not found".to_string())
}

fn find_characteristic_by_uuid(
    device: &btleplug::platform::Peripheral,
    characteristic_uuid: &str,
) -> Option<btleplug::api::Characteristic> {
    device
        .characteristics()
        .into_iter()
        .find(|char| char.uuid.to_string() == characteristic_uuid)
}

async fn check_device(
    app_handle: tauri::AppHandle,
    device: btleplug::platform::Peripheral,
    id: PeripheralId,
) -> Result<(), String> {
    let name = get_device_name(&device).await;

    if name.contains("Haritora") {
        log!("Found Haritora device: {:?}", id);
        if let Err(e) = connect(app_handle, device.clone()).await {
            log!("Failed to connect to device {:?}: {}", id, e);
            return Err(e);
        }
        let mut state = BLE_STATE.lock().await;
        state.connected_devices.push(id.clone());
        log!("Connected devices: {:?}", state.connected_devices);
    }

    Ok(())
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
    map.insert("00dbf586-90aa-11ed-a1eb-0242ac120002", "SecondaryButton");
    map
});

async fn connect(
    app_handle: tauri::AppHandle,
    device: btleplug::platform::Peripheral,
) -> Result<(), String> {
    device.connect().await.map_err(|e| e.to_string())?;
    device
        .discover_services()
        .await
        .map_err(|e| e.to_string())?;
    let services = device.services();
    for service in services.iter() {
        log!("Service: {:?}", service);
    }

    let chars = device.characteristics();
    for char in chars.iter() {
        log!("Characteristic: {:?}", char);
    }

    if REQUIRED_SERVICES
        .keys()
        .all(|service| services.iter().any(|s| s.uuid.to_string() == *service))
        && REQUIRED_CHARS
            .keys()
            .all(|char| chars.iter().any(|c| c.uuid.to_string() == *char))
    {
        log!("All required services and characteristics found");
        broadcasting(app_handle, device.clone()).await.unwrap();
    } else {
        log!("Not all required services or characteristics found");
        disconnect(device.clone()).await.unwrap();
        for service in REQUIRED_SERVICES.keys() {
            if !services.iter().any(|s| s.uuid.to_string() == *service) {
                log!("Missing service: {}", service);
            }
        }
        for char in REQUIRED_CHARS.keys() {
            if !chars.iter().any(|c| c.uuid.to_string() == *char) {
                log!("Missing characteristic: {}", char);
            }
        }
        return Err("Not all required services or characteristics found".to_string());
    }

    Ok(())
}

async fn disconnect(device: btleplug::platform::Peripheral) -> Result<(), String> {
    device.disconnect().await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn broadcasting(
    app_handle: tauri::AppHandle,
    device: btleplug::platform::Peripheral,
) -> Result<(), String> {
    let characteristics = device.characteristics();
    let device_clone = device.clone();
    for characteristic in characteristics {
        // check if you can subscribe to characteristic, and if so, subscribe to notify frontend
        if characteristic.properties.contains(CharPropFlags::NOTIFY) {
            let subscribe_result = device_clone.subscribe(&characteristic).await;
            match subscribe_result {
                Ok(_) => {
                    log!("Subscribed to characteristic: {:?}", characteristic);

                    // let characteristic_name = CHARACTERISTICS
                    //     .iter()
                    //     .find_map(|(uuid, name)| {
                    //         if characteristic.uuid.to_string() == *uuid {
                    //             Some(*name)
                    //         } else {
                    //             None
                    //         }
                    //     })
                    //     .unwrap_or("Unknown");

                    let notification_stream_result = device_clone.notifications().await;
                    match notification_stream_result {
                        Ok(mut notification_stream) => {
                            let app_handle_clone = app_handle.clone();
                            let device_clone = device.clone();

                            tokio::spawn(async move {
                                while let Some(data) = notification_stream.next().await {
                                    // log!(
                                    //     "Received data from {} ({}): {:?}",
                                    //     characteristic_name, characteristic.uuid, data.value
                                    // );

                                    // emit data to tauri frontend with name of peripheral, service, characteristic, and data
                                    let peripheral_name = device_clone
                                        .properties()
                                        .await
                                        .map(|p| p.unwrap().local_name)
                                        .unwrap_or(Some("Unknown".to_string()));
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
                                        log!("Failed to emit BLE notification: {}", e);
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            log!(
                                "Failed to get notification stream for characteristic {:?}: {}",
                                characteristic,
                                e
                            );
                        }
                    }
                }
                Err(e) => {
                    log!(
                        "Failed to subscribe to characteristic {:?}: {}",
                        characteristic,
                        e
                    );
                }
            }
        }
    }
    Ok(())
}
