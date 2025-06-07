use base64::Engine;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_blec::{
    get_handler,
    models::{BleDevice, ScanFilter, WriteType},
    OnDisconnectHandler,
};
use tokio::sync::Mutex;

use crate::util::normalize_uuid;
use log::{error, info, warn};

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
// characteristic, (name, can_subscribe)
static CHARACTERISTICS: Lazy<HashMap<&'static str, (&'static str, bool)>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert("2a19", ("BatteryLevel", true));
    map.insert("2a25", ("SerialNumber", false));
    map.insert("2a29", ("Manufacturer", false));
    map.insert("2a27", ("HardwareRevision", false));
    map.insert("2a26", ("FirmwareRevision", false));
    map.insert("2a28", ("SoftwareRevision", false));
    map.insert("2a24", ("ModelNumber", false));
    map.insert("00dbf1c6-90aa-11ed-a1eb-0242ac120002", ("Sensor", true));
    map.insert(
        "00dbf07c-90aa-11ed-a1eb-0242ac120002",
        ("NumberOfImu", false),
    );
    map.insert(
        "00dbf306-90aa-11ed-a1eb-0242ac120002",
        ("Magnetometer", true),
    );
    map.insert("00dbf450-90aa-11ed-a1eb-0242ac120002", ("MainButton", true));
    map.insert(
        "00dbf586-90aa-11ed-a1eb-0242ac120002",
        ("SecondaryButton", true),
    );
    map.insert(
        "00dbf6a8-90aa-11ed-a1eb-0242ac120002",
        ("TertiaryButton", true),
    );
    map.insert(
        "ef844202-90a9-11ed-a1eb-0242ac120002",
        ("FpsSetting", false),
    );
    map.insert(
        "ef8443f6-90a9-11ed-a1eb-0242ac120002",
        ("TofSetting", false),
    );
    map.insert(
        "ef8445c2-90a9-11ed-a1eb-0242ac120002",
        ("SensorModeSetting", false),
    );
    map.insert(
        "ef84c300-90a9-11ed-a1eb-0242ac120002",
        ("WirelessModeSetting", false),
    );
    map.insert(
        "ef84c305-90a9-11ed-a1eb-0242ac120002",
        ("AutoCalibrationSetting", false),
    );
    map.insert(
        "ef844766-90a9-11ed-a1eb-0242ac120002",
        ("SensorDataControl", false),
    );
    map.insert(
        "ef843b54-90a9-11ed-a1eb-0242ac120002",
        ("BatteryVoltage", true),
    );
    map.insert(
        "ef843cb2-90a9-11ed-a1eb-0242ac120002",
        ("ChargeStatus", true),
    );
    map.insert(
        "ef84c301-90a9-11ed-a1eb-0242ac120002",
        ("BodyPartAssignment", false),
    );
    map.insert(
        "8ec90003-f315-4f60-9fb8-838830daea50",
        ("DFUControl", false),
    );
    map.insert(
        "0c900914-a85e-11ed-afa1-0242ac120002",
        ("CommandMode", false),
    );
    map.insert("0c900c84-a85e-11ed-afa1-0242ac120002", ("Command", false));
    map.insert("0c900df6-a85e-11ed-afa1-0242ac120002", ("Response", false));
    map
});

struct BleState {
    // mac_address, BleDevice
    discovered_devices: HashMap<String, BleDevice>,
    // mac_address, device_name
    connected_devices: HashMap<String, String>,
    paired_devices: Vec<String>,
    scanning: bool,
}

static BLE_STATE: Lazy<Arc<Mutex<BleState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(BleState {
        discovered_devices: HashMap::new(),
        connected_devices: HashMap::new(),
        paired_devices: Vec::new(),
        scanning: false,
    }))
});

/*
 * BLE scanning commands
 */

pub async fn start_scanning(
    _app_handle: tauri::AppHandle,
    timeout: Option<u64>,
) -> Result<Vec<BleDevice>, String> {
    let timeout = timeout.unwrap_or(5000);

    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    {
        let mut state = BLE_STATE.lock().await;
        if state.scanning {
            return Err("Scanning already in progress".to_string());
        }
        state.scanning = true;
    }

    info!("Started BLE device scanning for {}ms", timeout);
    let result = match handler.start_scan(ScanFilter::None, timeout).await {
        Ok(result) => {
            info!("Finished BLE device scanning");
            let filtered: Vec<BleDevice> = result
                .into_iter()
                .filter(|dev| {
                    dev.name.starts_with("HaritoraX")
                        || dev.services.iter().any(|uuid| {
                            uuid.to_string().to_lowercase()
                                == "ef84369a-90a9-11ed-a1eb-0242ac120002"
                        })
                })
                .collect();
            Ok(filtered)
        }
        Err(e) => {
            error!("Failed to start BLE scan: {}", e);
            Err(format!("Failed to start BLE scan: {}", e))
        }
    };

    {
        let mut state = BLE_STATE.lock().await;
        state.scanning = false;
    }

    info!("Result of BLE scan: {:?}", result);

    result
}

pub async fn stop_scanning() -> Result<(), String> {
    info!("Stopping BLE device scanning");

    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    {
        let mut state = BLE_STATE.lock().await;
        state.scanning = false;
        state.discovered_devices.clear();
    }

    if let Err(e) = handler.stop_scan().await {
        error!("Failed to stop BLE scan: {}", e);
        Err(format!("Failed to stop BLE scan: {}", e))
    } else {
        info!("Stopped BLE device scanning");
        Ok(())
    }
}

/*
 * BLE connection management
*/

pub async fn start_connections(
    app_handle: tauri::AppHandle,
    mac_addresses: Vec<String>,
) -> Result<(), String> {
    info!(
        "Setting paired devices to start connection: {:?}",
        mac_addresses
    );

    {
        let mut state = BLE_STATE.lock().await;
        state.paired_devices = mac_addresses.clone();
    }

    tokio::spawn(async move {
        info!(
            "Starting connection management for {} devices",
            mac_addresses.len()
        );

        let mut reconnect_interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
        reconnect_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            reconnect_interval.tick().await;

            // Check if we still have paired devices
            let current_pairs = {
                let state = BLE_STATE.lock().await;
                state.paired_devices.clone()
            };

            if current_pairs.is_empty() {
                info!("No paired devices, stopping connection management");
                break;
            }

            // Check each paired device
            for mac_address in &current_pairs {
                let is_connected = {
                    let state = BLE_STATE.lock().await;
                    state.connected_devices.contains_key(mac_address)
                };

                if !is_connected {
                    info!("Attempting to connect to paired device: {}", mac_address);

                    match connect_to_device(app_handle.clone(), mac_address).await {
                        Ok(_) => {
                            info!("Successfully connected to device: {}", mac_address);
                        }
                        Err(e) => {
                            warn!("Failed to connect to device {}: {}", mac_address, e);
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

pub async fn stop_connections() -> Result<(), String> {
    info!("Stopping all connections");

    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    {
        let mut state = BLE_STATE.lock().await;
        state.paired_devices.clear();
    }

    // Disconnect all devices
    if let Err(e) = handler.disconnect_all().await {
        error!("Failed to disconnect all devices: {}", e);
    } else {
        info!("Disconnected all devices");
    }

    {
        let mut state = BLE_STATE.lock().await;
        state.connected_devices.clear();
    }

    info!("Stopped all connections");
    Ok(())
}

/*
 * BLE device management
 */

pub async fn write(
    mac_address: &str,
    characteristic_uuid: &str,
    data: Vec<u8>,
    expecting_response: bool,
) -> Result<Option<Vec<u8>>, String> {
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    let write_type = if expecting_response {
        WriteType::WithResponse
    } else {
        WriteType::WithoutResponse
    };

    let char_uuid = normalize_uuid(characteristic_uuid)
        .map_err(|e| format!("Invalid characteristic UUID {}: {}", characteristic_uuid, e))?;

    if let Err(e) = handler
        .send_data(mac_address, char_uuid, &data, write_type)
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
            .read_data(mac_address, char_uuid)
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

pub async fn read(mac_address: &str, characteristic_uuid: &str) -> Result<Vec<u8>, String> {
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    let char_uuid = normalize_uuid(characteristic_uuid)
        .map_err(|e| format!("Invalid characteristic UUID {}: {}", characteristic_uuid, e))?;

    handler
        .read_data(mac_address, char_uuid)
        .await
        .map_err(|e| {
            format!(
                "Failed to read from characteristic {}: {}",
                characteristic_uuid, e
            )
        })
}

async fn handle_device_disconnect(
    app_handle: tauri::AppHandle,
    mac_address: String,
) -> Result<(), String> {
    info!("Handling device disconnect for: {}", mac_address);

    let device_name = {
        let mut state = BLE_STATE.lock().await;
        state.connected_devices.remove(&mac_address)
    };

    if let Some(name) = device_name {
        info!(
            "Removed device {} ({}) from connected devices",
            name, mac_address
        );

        if let Err(e) = app_handle.emit("device_disconnected", &mac_address) {
            error!("Failed to emit device_disconnected: {}", e);
        }

        // Check if this device should be reconnected
        let should_reconnect = {
            let state = BLE_STATE.lock().await;
            state.paired_devices.contains(&mac_address)
        };

        if should_reconnect {
            info!(
                "Device {} is a paired device, will attempt reconnection",
                mac_address
            );
            // the connection management task reconnect
        }
    } else {
        warn!("Device {} not found in connected devices", mac_address);
    }

    Ok(())
}

async fn connect_to_device(app_handle: tauri::AppHandle, mac_address: &str) -> Result<(), String> {
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    let app_handle_clone = app_handle.clone();
    let mac_address_string = mac_address.to_string();
    let disconnect_handler = OnDisconnectHandler::from({
        let mac_address = mac_address_string.clone();
        move || {
            let app_handle = app_handle_clone.clone();
            let mac_address = mac_address.clone();
            tokio::spawn(async move {
                if let Err(e) = handle_device_disconnect(app_handle, mac_address).await {
                    error!("Failed to handle device disconnect: {}", e);
                }
            });
        }
    });

    if let Err(e) = handler
        .connect(&mac_address_string, disconnect_handler)
        .await
    {
        return Err(e.to_string());
    }

    // Get device name for friendly display
    let device_name = get_device_name(mac_address)
        .await
        .unwrap_or_else(|_| mac_address.to_string());

    {
        let mut state = BLE_STATE.lock().await;
        state
            .connected_devices
            .insert(mac_address_string.clone(), device_name.clone());
    }

    info!("Connected to device: {} ({})", device_name, mac_address);

    if let Err(e) = app_handle.emit("device_connected", &mac_address_string) {
        error!("Failed to emit device_connected: {}", e);
    }

    if let Err(e) = setup_notifications(app_handle, &mac_address_string, &device_name).await {
        error!("Failed to setup notifications for {}: {}", device_name, e);
    }

    Ok(())
}

async fn setup_notifications(
    app_handle: tauri::AppHandle,
    mac_address: &str,
    device_name: &str,
) -> Result<(), String> {
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    // subscribe only to characteristics where the bool is true
    for (char_uuid_str, (char_name, can_subscribe)) in CHARACTERISTICS.iter() {
        if !*can_subscribe {
            continue;
        }

        let char_uuid = normalize_uuid(char_uuid_str)
            .map_err(|e| format!("Invalid characteristic UUID {}: {}", char_uuid_str, e))?;

        let app_handle_clone = app_handle.clone();
        let device_name_clone = device_name.to_string();
        let char_name_clone = char_name.to_string();
        let mac_address_clone = mac_address.to_string();

        let callback = move |data: Vec<u8>| {
            let app_handle = app_handle_clone.clone();
            let device_name = device_name_clone.clone();
            let char_name = char_name_clone.clone();
            let mac_address = mac_address_clone.clone();

            tokio::spawn(async move {
                // convert data into base64 and process in interpreter
                let data_str = base64::engine::general_purpose::STANDARD.encode(&data);

                // Use MAC address for processing since that's our primary identifier now
                if let Err(e) = crate::interpreters::core::process_ble(
                    &app_handle,
                    &mac_address, // Changed from device_name to mac_address
                    &char_name,
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
                    "peripheral_address": mac_address,
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

        match handler.subscribe(mac_address, char_uuid, callback).await {
            Ok(_) => {
                info!(
                    "Subscribed to characteristic {} for device {} ({})",
                    char_name, device_name, mac_address
                );
            }
            Err(e) => {
                warn!(
                    "Failed to subscribe to characteristic {} for device {} ({}): {}",
                    char_name, device_name, mac_address, e
                );
            }
        }
    }

    Ok(())
}

pub async fn get_device_name(mac_address: &str) -> Result<String, String> {
    let state = BLE_STATE.lock().await;

    if let Some(device) = state.discovered_devices.get(mac_address) {
        Ok(device.name.clone())
    } else if let Some(name) = state.connected_devices.get(mac_address) {
        Ok(name.clone())
    } else {
        Err(format!(
            "Device with MAC address '{}' not found",
            mac_address
        ))
    }
}
