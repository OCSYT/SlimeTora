use base64::Engine;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::Emitter;
use tauri_plugin_blec::{
    get_handler,
    models::{BleDevice, WriteType},
    OnDisconnectHandler,
};

use log::{error, info, warn};
use crate::util::normalize_uuid;

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
    // mac_address, device_name
    connected_devices: HashMap<String, String>,
}

static BLE_STATE: Lazy<Arc<Mutex<BleState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(BleState {
        connected_devices: HashMap::new(),
    }))
});

pub async fn start(app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Starting BLE connection");

    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    let devices = handler
        .start_scan(None, 10000)
        .await
        .map_err(|e| format!("Failed to start scan: {}", e))?;

    // process discovered devices
    for device in devices {
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_device_discovered(app_handle_clone, device).await {
                warn!("Error handling discovered device: {}", e);
            }
        });
    }

    info!("Started BLE scanning");
    Ok(())
}

pub async fn stop(_app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Stopping BLE connection");

    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    if let Err(e) = handler.stop_scan().await {
        error!("Error stopping scan: {}", e);
    } else {
        info!("Stopped BLE scanning");
    }

    info!("Disconnecting all connected devices");
    if let Err(e) = handler.disconnect_all().await {
        error!("Failed to disconnect all devices: {}", e);
    } else {
        info!("Disconnected all devices");
    }

    {
        let mut state = BLE_STATE.lock().await;
        state.connected_devices.clear();
    }

    info!("Stopped BLE connection");
    Ok(())
}

pub async fn write(
    device_name: &str,
    characteristic_uuid: &str,
    data: Vec<u8>,
    expecting_response: bool,
) -> Result<Option<Vec<u8>>, String> {
    let address = find_device_address_by_name(device_name).await?;
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    let write_type = if expecting_response {
        WriteType::WithResponse
    } else {
        WriteType::WithoutResponse
    };

    let char_uuid = normalize_uuid(characteristic_uuid)
        .map_err(|e| format!("Invalid characteristic UUID {}: {}", characteristic_uuid, e))?;

    if let Err(e) = handler
        .send_data(&address, char_uuid, &data, write_type)
        .await
    {
        error!(
            "Failed to write to characteristic {}: {}",
            characteristic_uuid, e
        );
        return Err(e.to_string());
    }

    if expecting_response {
        return handler
            .read_data(&address, char_uuid)
            .await
            .map(Some)
            .map_err(|e| {
                error!(
                    "Failed to read response from characteristic {}: {}",
                    characteristic_uuid, e
                );
                e.to_string()
            });
    }

    Ok(None)
}

pub async fn read(device_name: &str, characteristic_uuid: &str) -> Result<Vec<u8>, String> {
    let address = find_device_address_by_name(device_name).await?;
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    let char_uuid = normalize_uuid(characteristic_uuid)
        .map_err(|e| format!("Invalid characteristic UUID {}: {}", characteristic_uuid, e))?;

    handler.read_data(&address, char_uuid).await.map_err(|e| {
        format!(
            "Failed to read from characteristic {}: {}",
            characteristic_uuid, e
        )
    })
}

async fn find_device_address_by_name(device_name: &str) -> Result<String, String> {
    let state = BLE_STATE.lock().await;

    for (address, name) in &state.connected_devices {
        if name == device_name {
            return Ok(address.clone());
        }
    }

    Err(format!(
        "Device '{}' not found in connected devices",
        device_name
    ))
}

async fn handle_device_discovered(
    app_handle: tauri::AppHandle,
    device: BleDevice,
) -> Result<(), String> {
    let name = &device.name;

    if name.starts_with("Haritora") {
        info!("Found Haritora device: {} ({})", name, device.address);

        let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

        let address = device.address.clone();
        let app_handle_clone = app_handle.clone();
        let device_name = name.clone();

        let disconnect_handler = OnDisconnectHandler::from(move || {
            info!("Device disconnected: {}", device_name);
            let app_handle = app_handle_clone.clone();
            let name = device_name.clone();
            tokio::spawn(async move {
                if let Err(e) = app_handle.emit("device_disconnected", &name) {
                    error!("Failed to emit device_disconnected: {}", e);
                }

                let mut state = BLE_STATE.lock().await;
                state.connected_devices.retain(|_, n| n != &name);
            });
        });

        if let Err(e) = handler.connect(&address, disconnect_handler).await {
            error!("Failed to connect to device {}: {}", name, e);
            return Err(e.to_string());
        }

        {
            let mut state = BLE_STATE.lock().await;
            state
                .connected_devices
                .insert(address.clone(), name.clone());
        }

        info!("Connected to device: {} ({})", name, address);

        if let Err(e) = app_handle.emit("device_connected", name) {
            error!("Failed to emit device_connected: {}", e);
        }

        if let Err(e) = setup_notifications(app_handle, &address, name).await {
            error!("Failed to setup notifications for {}: {}", name, e);
        }
    }

    Ok(())
}

async fn setup_notifications(
    app_handle: tauri::AppHandle,
    address: &str,
    device_name: &str,
) -> Result<(), String> {
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    // subscribe to all characteristics
    for (char_uuid_str, char_name) in CHARACTERISTICS.iter() {
        let char_uuid = normalize_uuid(char_uuid_str)
            .map_err(|e| format!("Invalid characteristic UUID {}: {}", char_uuid_str, e))?;

        let app_handle_clone = app_handle.clone();
        let device_name_clone = device_name.to_string();
        let char_name_clone = char_name.to_string();
        let char_uuid_str_clone = char_uuid_str.to_string();

        let callback = move |data: Vec<u8>| {
            let app_handle = app_handle_clone.clone();
            let device_name = device_name_clone.clone();
            let char_name = char_name_clone.clone();
            let char_uuid_str = char_uuid_str_clone.clone();

            tokio::spawn(async move {
                // convert data into base64 and process in interpreter
                let data_str = base64::engine::general_purpose::STANDARD.encode(&data);

                if let Err(e) = crate::interpreters::core::process_ble(
                    &app_handle,
                    &device_name,
                    &char_uuid_str,
                    &data_str,
                )
                .await
                {
                    error!("Failed to process BLE data: {}", e);
                }

                // find service name of characteristic
                let service_name = SERVICES
                    .iter()
                    .find_map(|(_, name)| Some(*name))
                    .unwrap_or("Unknown");

                let payload = serde_json::json!({
                    "peripheral_name": device_name,
                    "service_name": service_name,
                    "characteristic_name": char_name,
                    "data": data,
                });

                if let Err(e) = app_handle.emit("ble_notification", payload) {
                    error!("Failed to emit BLE notification: {}", e);
                }
            });
        };

        match handler.subscribe(address, char_uuid, callback).await {
            Ok(_) => {
                info!(
                    "Subscribed to characteristic {} for device {}",
                    char_name, device_name
                );
            }
            Err(e) => {
                warn!(
                    "Failed to subscribe to characteristic {} for device {}: {}",
                    char_name, device_name, e
                );
            }
        }
    }

    Ok(())
}
