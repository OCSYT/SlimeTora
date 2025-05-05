use crate::connection::slimevr::{remove_tracker, send_battery};
use crate::interpreters::common::process_connection_data;
use log::{error, info, warn};
use crate::{
    connection::slimevr::{add_tracker, send_accel, send_rotation},
    interpreters::core::Interpreter,
};
use async_trait::async_trait;
use base64::Engine;
use tauri::{AppHandle, Emitter};

use super::common::{
    decode_imu, process_battery_data, process_button_data, process_settings_data,
    CONNECTED_TRACKERS,
};

pub struct HaritoraXWireless;

#[async_trait]
impl Interpreter for HaritoraXWireless {
    async fn parse_ble(
        &self,
        app_handle: &AppHandle,
        device_id: Option<&str>,
        characteristic_uuid: &str,
        data: &str,
    ) -> Result<(), String> {
        // Implement BLE parsing logic for HaritoraX Wireless
        Ok(())
    }

    async fn parse_serial(
        &self,
        app_handle: &AppHandle,
        tracker_name: &str,
        data: &str,
    ) -> Result<(), String> {
        let (identifier, data) = data.split_once(':').unwrap_or(("", ""));
        //info!("Received identifier: {}, data: {}", identifier, data);
        if tracker_name.is_empty() {
            return Ok(());
        }

        let normalized_identifier = identifier.to_lowercase().chars().next();
        match normalized_identifier {
            Some('x') => {
                let buffer = base64::engine::general_purpose::STANDARD
                    .decode(data)
                    .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

                process_imu(app_handle, tracker_name, "serial", buffer).await?;
            }
            Some('v') => {
                process_battery(app_handle, tracker_name, "serial", data).await?;
            }
            Some('r') => {
                process_button(app_handle, tracker_name, "serial", data).await?;
            }
            Some('o') => {
                process_settings(app_handle, tracker_name, "serial", data).await?;
            }
            Some('i') => {
                process_info(app_handle, tracker_name, "serial", data).await?;
            }
            Some('a') => {
                process_connection(app_handle, tracker_name, "serial", data).await?;
            }
            _ => warn!("Unknown identifier: {}", identifier),
        }

        Ok(())
    }
}

async fn process_imu(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    if !CONNECTED_TRACKERS.contains_key(tracker_name) && !tracker_name.is_empty() {
        info!("Creating new tracker: {}", tracker_name);

        if let Err(e) = add_tracker(app_handle, tracker_name, [0, 0, 0, 0, 0, 0x01]).await {
            error!("Failed to add tracker: {}", e);
            return Err(format!("Failed to add tracker: {}", e));
        }

        let payload = serde_json::json!({
            "tracker": tracker_name,
            "connection_mode": connection_mode,
            "tracker_type": "Wireless",
        });

        app_handle.emit("connect", payload).map_err(|e| {
            format!(
                "Failed to emit tracker added event for {}: {}",
                tracker_name, e
            )
        })?;
    }

    let imu_data = match decode_imu(&data, tracker_name) {
        Ok(data) => data,
        Err(e) => {
            error!(
                "Failed to decode IMU data for tracker {}: {}",
                tracker_name,
                e
            );
            return Err(format!("Failed to decode IMU data: {}", e));
        }
    };

    // since we are in wireless trackers, the ankle and wireless data is actually within the data
    // this probably also applies to X2's, but ofc it's very different (with the new LiDAR sensor)
    let buffer_data = base64::engine::general_purpose::STANDARD.encode(data.clone());
    let ankle = if !buffer_data.ends_with("==") {
        let data_bytes = &data[data.len() - 2..];
        Some(u16::from_le_bytes([data_bytes[0], data_bytes[1]]))
    } else {
        None
    };
    let mut mag_status: Option<&str> = None;

    if !tracker_name.starts_with("HaritoraXW") {
        let magnetometer_data = buffer_data.chars().nth(buffer_data.len() - 5);
        mag_status = match magnetometer_data {
            Some('A') => Some("VERY_BAD"),
            Some('B') => Some("BAD"),
            Some('C') => Some("OKAY"),
            Some('D') => Some("GREAT"),
            _ => Some("UNKNOWN"),
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
    let mag_payload = serde_json::json!({
        "tracker": tracker_name,
        "connection_mode": connection_mode,
        "tracker_type": "Wireless",
        "data": {
            "magnetometer": mag_status,
        },
    });
    app_handle
        .emit("imu", imu_payload)
        .map_err(|e| format!("Failed to emit IMU data: {}", e))?;
    app_handle
        .emit("mag", mag_payload)
        .map_err(|e| format!("Failed to emit magnetometer data: {}", e))?;

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

async fn process_battery(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
) -> Result<(), String> {
    let battery_data = process_battery_data(data, tracker_name, None)?;
    if data.is_empty() {
        return Ok(());
    }

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
) -> Result<(), String> {
    let data = process_button_data(data, tracker_name, None)?;
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
    if data.is_empty() {
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
    //let info_data
    Ok(())
}

// TODO: this is probably RSSI data if connected
async fn process_connection(
    app_handle: &AppHandle,
    tracker_name: &str,
    connection_mode: &str,
    data: &str,
) -> Result<(), String> {
    let data = process_connection_data(data, tracker_name)?;
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
