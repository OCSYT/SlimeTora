use base64::Engine;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_blec::{
    get_handler,
    models::{ScanFilter, WriteType},
    OnDisconnectHandler,
};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::{interpreters::core::TrackerModel, util::normalize_uuid};
use log::{error, info, warn};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerDevice {
    device_name: String,
    mac_address: String,
    tracker_type: Option<TrackerModel>, // "wired", "wireless", or "x2"
    rssi: Option<i16>,                  // Received Signal Strength Indicator
}

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
    map.insert("00dbf586-90aa-11ed-a1eb-0242ac120002", ("SubButton", true));
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
    discovered_devices: Vec<TrackerDevice>,
    connected_devices: Vec<String>,
    scanning: bool,
    connection_cancel_token: Option<CancellationToken>,
}

static BLE_STATE: Lazy<Arc<Mutex<BleState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(BleState {
        discovered_devices: Vec::new(),
        connected_devices: Vec::new(),
        scanning: false,
        connection_cancel_token: None,
    }))
});

/*
 * BLE scanning commands
 */

pub async fn start_scanning(
    _app_handle: tauri::AppHandle,
    timeout: Option<u64>,
) -> Result<Vec<TrackerDevice>, String> {
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
            let filtered: Vec<TrackerDevice> = result
                .into_iter()
                .filter_map(|dev| {
                    let tracker_type = if dev.name.starts_with("HaritoraX-") {
                        Some(TrackerModel::Wired)
                    } else if dev.name.starts_with("HaritoraXW-") {
                        Some(TrackerModel::Wireless)
                    } else if dev.name.starts_with("HaritoraX2-") {
                        Some(TrackerModel::X2)
                    } else {
                        None
                    };
                    tracker_type.map(|tt| TrackerDevice {
                        device_name: dev.name.clone(),
                        mac_address: dev.address.clone(),
                        tracker_type: Some(tt),
                        rssi: dev.rssi,
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
        state.discovered_devices.clear();
        if let Ok(devices) = &result {
            state.discovered_devices.extend(devices.iter().cloned());
        }
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

    let cancel_token = CancellationToken::new();

    {
        let mut state = BLE_STATE.lock().await;

        // cancel any existing connection management task
        if let Some(existing_token) = &state.connection_cancel_token {
            existing_token.cancel();
        }
        state.connection_cancel_token = Some(cancel_token.clone());
    }

    tokio::spawn(async move {
        info!(
            "Starting BLE connection management for {} devices",
            mac_addresses.len()
        );

        let mut reconnect_interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
        reconnect_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        if let Ok(handler) = get_handler() {
            match handler.start_scan_stream(None).await {
                Ok(_) => {}
                Err(e) => {
                    warn!("Background scan failed: {}", e);
                }
            }
        }

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    info!("BLE connection management task cancelled, stopping");
                    break;
                }
                _ = reconnect_interval.tick() => {
                    // constantly attempt to find and connect to paired devices
                    for mac in &mac_addresses {
                        let is_connected = {
                            let state = BLE_STATE.lock().await;
                            state.connected_devices.iter().any(|addr| addr == mac)
                        };

                        if !is_connected {
                            info!(
                                "Attempting to connect to paired device: {}",
                                mac
                            );

                            match connect_to_device(app_handle.clone(), mac).await {
                                Ok(_) => {
                                    info!(
                                        "Successfully connected to device: {}",
                                        mac
                                    );
                                    if let Err(e) = app_handle.emit("connect", mac) {
                                        error!("Failed to emit connect event: {}", e);
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "Failed to connect to device {}: {}",
                                        mac, e
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        info!("BLE connection management task ended");
    });

    Ok(())
}

pub async fn stop_connections() -> Result<(), String> {
    info!("Stopping all connections");

    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    {
        let mut state = BLE_STATE.lock().await;

        if let Some(cancel_token) = &state.connection_cancel_token {
            cancel_token.cancel();
            info!("Cancelled BLE connection management task");
        }
        state.connection_cancel_token = None;
        state.connected_devices.clear();
    }

    if let Err(e) = handler.disconnect_all().await {
        error!("Failed to disconnect all devices: {}", e);
    } else {
        info!("Disconnected all devices");
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    info!("Stopped all connections");
    Ok(())
}

pub async fn disconnect_device(mac_address: &str) -> Result<(), String> {
    let handler = get_handler().map_err(|e| format!("Failed to get BLE handler: {}", e))?;

    if let Err(e) = handler.disconnect(mac_address).await {
        error!("Failed to disconnect device {}: {}", mac_address, e);
        return Err(e.to_string());
    }

    info!("Disconnected device: {}", mac_address);

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
    let is_connected = {
        let mut state = BLE_STATE.lock().await;
        // find and remove the mac address, returning true if found
        if let Some(pos) = state
            .connected_devices
            .iter()
            .position(|addr| addr == &mac_address)
        {
            state.connected_devices.remove(pos);
            true
        } else {
            false
        }
    };

    if is_connected {
        info!("Removed device {} from connected devices", mac_address);

        if let Err(e) = app_handle.emit("disconnect", &mac_address) {
            error!("Failed to emit disconnect: {}", e);
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

    let mut state = BLE_STATE.lock().await;

    state.connected_devices.push(mac_address_string.clone());
    info!("Connected to device: {}", mac_address);

    if let Err(e) = app_handle.emit("disconnect", &mac_address_string) {
        error!("Failed to emit disconnect: {}", e);
    }

    if let Err(e) = setup_notifications(app_handle, &mac_address_string).await {
        error!(
            "Failed to setup notifications for {}: {}",
            mac_address_string, e
        );
    }

    Ok(())
}

async fn setup_notifications(
    app_handle: tauri::AppHandle,
    mac_address: &str,
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
        let mac_address_string = mac_address.to_string();
        let char_name_clone = char_name.to_string();

        let callback = move |data: Vec<u8>| {
            let app_handle = app_handle_clone.clone();
            let mac = mac_address_string.clone();
            let char_name = char_name_clone.clone();

            tokio::spawn(async move {
                // convert data into base64 and process in interpreter
                let data_str = base64::engine::general_purpose::STANDARD.encode(&data);

                if let Err(e) =
                    crate::interpreters::core::process_ble(&app_handle, &mac, &char_name, &data_str)
                        .await
                {
                    error!("Failed to process BLE data: {}", e);
                }
            });
        };

        match handler.subscribe(mac_address, char_uuid, callback).await {
            Ok(_) => {
                info!(
                    "Subscribed to characteristic {} for device {}",
                    char_name, mac_address
                );
            }
            Err(e) => {
                warn!(
                    "Failed to subscribe to characteristic {} for device {}: {}",
                    char_name, mac_address, e
                );
            }
        }
    }

    Ok(())
}
