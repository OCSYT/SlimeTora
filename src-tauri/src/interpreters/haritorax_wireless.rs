use crate::{
    connection::slimevr::{add_tracker, remove_tracker, send_accel, send_battery, send_rotation},
    interpreters::{
        common::{process_connection_data, process_info_data},
        core::{Interpreter, MagStatus},
    },
};
use async_trait::async_trait;
use base64::Engine;
use log::{error, info, warn};
use tauri::{AppHandle, Emitter};

use super::common::{
    decode_imu, process_battery_data, process_button_data, process_mag_data, process_settings_data,
    CONNECTED_TRACKERS,
};

pub struct HaritoraXWireless;

#[async_trait]
impl Interpreter for HaritoraXWireless {
    async fn parse_ble(
        &self,
        app_handle: &AppHandle,
        device_id: &str,
        device_assignment: &str,
        char_name: &str,
        data: &str,
    ) -> Result<(), String> {
        let buffer = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

        match char_name {
            "Sensor" => {
                process_imu(app_handle, device_id, device_assignment, "bluetooth", buffer).await?;
            }
            "MainButton" | "SubButton" => {
                process_button(app_handle, device_id, "bluetooth", data, Some(char_name)).await?;
            }
            "BatteryLevel" | "BatteryVoltage" | "ChargeStatus" => {
                process_battery(app_handle, device_id, "bluetooth", data, Some(char_name)).await?;
            }
            "SensorModeSetting" | "FpsSetting" | "AutoCalibrationSetting" | "TofSetting" => {
                // ok we don't need to process these, this is literally never send manually idk why we can even sub to these lol
            }
            "Magnetometer" => {
                process_mag(app_handle, device_id, "bluetooth", data).await?;
            }
            _ => {
                warn!("Unknown data from {}: {} - {}", device_id, data, char_name);
                return Ok(());
            }
        }

        Ok(())
    }

    async fn parse_serial(
        &self,
        app_handle: &AppHandle,
        device_id: &str,
        device_assignment: &str,
        data: &str,
    ) -> Result<(), String> {
        if device_id.is_empty() {
            return Ok(());
        }

        let (identifier, data) = data.split_once(':').unwrap_or(("", ""));
        //info!("Received identifier for {}: {}, data: {}", tracker_name, identifier, data);

        let normalized_identifier = identifier.to_lowercase().chars().next();
        match normalized_identifier {
            Some('x') => {
                let buffer = base64::engine::general_purpose::STANDARD
                    .decode(data)
                    .map_err(|e| format!("Failed to decode base64 data: {}", e))?;
                process_imu(app_handle, device_id, device_assignment, "serial", buffer).await?;
            }
            Some('v') => {
                process_battery(app_handle, device_id, "serial", data, None).await?;
            }
            Some('r') => {
                process_button(app_handle, device_id, "serial", data, None).await?;
            }
            Some('o') => {
                process_settings(app_handle, device_id, "serial", data).await?;
            }
            Some('i') => {
                process_info(app_handle, device_id, "serial", data).await?;
            }
            Some('a') => {
                process_connection(app_handle, device_id, "serial", data).await?;
            }
            _ => warn!("Unknown identifier: {}", identifier),
        }

        Ok(())
    }
}

async fn process_imu(
    app_handle: &AppHandle,
    tracker_name: &str,
    tracker_assignment: &str,
    connection_mode: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    if !tracker_name.is_empty() {
        match CONNECTED_TRACKERS.get(tracker_name) {
            Some(entry) => {
                if entry.is_none() {
                    // still initializing tracker
                    return Ok(());
                }
            }
            None => {
                info!("Creating new tracker: {}", tracker_name);

                // TODO: seed tracker serial for mac address
                // we should get the serial and seed that for the mac address, so when users switch between BT or serial they are the same tracker to SlimeVR Server
                if let Err(e) = add_tracker(app_handle, tracker_name, [0, 0, 0, 0, 0, 0x01]).await {
                    error!("Failed to add tracker: {}", e);
                    return Err(format!("Failed to add tracker: {}", e));
                }

                let payload = serde_json::json!({
                    "tracker": tracker_name,
                    "connection_mode": connection_mode,
                    "tracker_type": "Wireless",
                    "data": {
                        "assignment": tracker_assignment,
                    },
                });

                app_handle.emit("connect", payload).map_err(|e| {
                    format!(
                        "Failed to emit tracker added event for {}: {}",
                        tracker_name, e
                    )
                })?;
            }
        }
    }

    let imu_data = match decode_imu(&data, tracker_name) {
        Ok(data) => data,
        Err(e) => {
            error!(
                "Failed to decode IMU data for tracker {}: {}",
                tracker_name, e
            );
            return Err(format!("Failed to decode IMU data: {}", e));
        }
    };

    // since we are in wireless trackers, the ankle and mag data is actually within the data
    // this probably also applies to X2's, but ofc it's very different (with the new LiDAR sensor)
    let buffer_data = base64::engine::general_purpose::STANDARD.encode(data.clone());
    let ankle = if !buffer_data.ends_with("==") {
        let data_bytes = &data[data.len() - 2..];
        Some(u16::from_le_bytes([data_bytes[0], data_bytes[1]]))
    } else {
        None
    };
    let mut mag_status: Option<MagStatus> = None;

    if connection_mode == "serial" {
        let magnetometer_data = buffer_data.chars().nth(buffer_data.len() - 5);
        mag_status = match magnetometer_data {
            Some('A') => Some(MagStatus::VeryBad),
            Some('B') => Some(MagStatus::Bad),
            Some('C') => Some(MagStatus::Okay),
            Some('D') => Some(MagStatus::Great),
            _ => Some(MagStatus::Unknown),
        };
    }

    let imu_payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": {
            "rotation": imu_data.rotation.degrees,
            "acceleration": imu_data.acceleration,
            "ankle": ankle,
        },
    });
    app_handle
        .emit("imu", imu_payload)
        .map_err(|e| format!("Failed to emit IMU data: {}", e))?;

    // only fire mag event if not null (BLE tracker. if null, it's a BLE tracker and we skipped it)
    if let Some(status) = mag_status {
        let mag_payload = serde_json::json!({
            "tracker": tracker_name,
            "connection_mode": connection_mode,
            "tracker_type": "Wireless",
            "data": {
                "magnetometer": status,
            },
        });
        app_handle
            .emit("mag", mag_payload)
            .map_err(|e| format!("Failed to emit magnetometer data: {}", e))?;
    }

    let rotation_data = [
        imu_data.rotation.raw.x,
        imu_data.rotation.raw.y,
        imu_data.rotation.raw.z,
        imu_data.rotation.raw.w,
    ];
    let accel_data = [
        imu_data.acceleration.x,
        imu_data.acceleration.y,
        imu_data.acceleration.z,
    ];

    if let Err(e) = send_rotation(tracker_name, 0, rotation_data).await {
        error!("Failed to send rotation: {}", e);
    }

    if let Err(e) = send_accel(tracker_name, 0, accel_data).await {
        error!("Failed to send acceleration: {}", e);
    }

    Ok(())
}

async fn process_mag(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
) -> Result<(), String> {
    let mag_status = process_mag_data(data)?;
    if mag_status.is_empty() {
        return Ok(());
    }

    let payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": {
            "magnetometer": mag_status,
        },
    });
    app_handle
        .emit("mag", payload)
        .map_err(|e| format!("Failed to emit magnetometer data: {}", e))?;

    if connection_mode == "bluetooth" {
        info!("Mag data for {}: {:?}", tracker_name, mag_status);
    }

    Ok(())
}

async fn process_battery(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
    characteristic: Option<&str>,
) -> Result<(), String> {
    let battery_option = process_battery_data(data, tracker_name, characteristic)?;
    if battery_option.is_none() {
        return Ok(());
    }

    let battery_data = battery_option.unwrap();
    let payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": battery_data,
    });
    app_handle
        .emit("battery", payload)
        .map_err(|e| format!("Failed to emit battery data: {}", e))?;

    info!("Battery data: {:?}", battery_data);

    let battery_percentage = battery_data.remaining.unwrap_or(0) as f32 / 100.0;
    let battery_voltage = battery_data.voltage.unwrap_or(0) as f32 / 1000.0;
    if let Err(e) = send_battery(tracker_name, battery_percentage, battery_voltage).await {
        error!("Failed to send battery data: {}", e);
    }

    Ok(())
}

async fn process_button(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
    characteristic: Option<&str>,
) -> Result<(), String> {
    let data = process_button_data(data, tracker_name, characteristic)?;
    if data.is_empty() {
        return Ok(());
    }

    let payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": data,
    });

    app_handle
        .emit("button", payload)
        .map_err(|e| format!("Failed to emit button data: {}", e))?;
    Ok(())
}

async fn process_settings(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
) -> Result<(), String> {
    let settings_data = process_settings_data(data, tracker_name)?;
    if settings_data.is_null() {
        return Ok(());
    }

    let payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": settings_data,
    });
    app_handle
        .emit("settings", payload)
        .map_err(|e| format!("Failed to emit settings data: {}", e))?;
    Ok(())
}

async fn process_info(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
) -> Result<(), String> {
    let info_data = process_info_data(data, tracker_name)?;
    if info_data.is_null() {
        return Ok(());
    }

    let payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": info_data,
    });
    app_handle
        .emit("info", payload)
        .map_err(|e| format!("Failed to emit info data: {}", e))?;
    Ok(())
}

// TODO: this is probably RSSI data if connected
async fn process_connection(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
) -> Result<(), String> {
    let data = process_connection_data(data)?;
    // Check if dongle_rssi and tracker_rssi are null, if so, return early
    let dongle_rssi = data.get("dongle_rssi");
    let tracker_rssi = data.get("tracker_rssi");
    if (dongle_rssi.is_none()
        || dongle_rssi.unwrap().is_null()
        || tracker_rssi.is_none()
        || tracker_rssi.unwrap().is_null())
        && CONNECTED_TRACKERS.contains_key(tracker_name)
    {
        let payload = serde_json::json!({
            "tracker": tracker_name,
            "connection_mode": connection_mode,
            "tracker_type": "Wireless",
        });

        if let Err(e) = remove_tracker(tracker_name).await {
            error!("Failed to remove tracker: {}", e);
        }

        app_handle.emit("disconnect", payload).map_err(|e| {
            format!(
                "Failed to emit tracker disconnected event for {}: {}",
                tracker_name, e
            )
        })?;
        return Ok(());
    }

    let payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": data,
    });

    app_handle
        .emit("connection", payload)
        .map_err(|e| format!("Failed to emit connection data: {}", e))?;
    Ok(())
}
