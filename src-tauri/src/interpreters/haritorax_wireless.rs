use crate::{
    connection::slimevr::{add_tracker, send_accel, send_rotation},
    interpreters::core::Interpreter,
    util::log,
};
use async_trait::async_trait;
use base64::Engine;
use tauri::{AppHandle, Emitter};

use super::common::{decode_imu, CONNECTED_TRACKERS};

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
        log(&format!(
            "Received identifier: {}, data: {}",
            identifier, data
        ));

        let normalized_identifier = identifier.to_lowercase().chars().next();
        match normalized_identifier {
            Some('x') => {
                let buffer = base64::engine::general_purpose::STANDARD
                    .decode(data)
                    .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

                process_imu_data(app_handle, tracker_name, buffer).await?;
            }
            _ => log(&format!("Unknown identifier: {}", identifier)),
        }

        Ok(())
    }
}

async fn process_imu_data(
    app_handle: &AppHandle,
    tracker_name: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    if !CONNECTED_TRACKERS.contains_key(tracker_name) && !tracker_name.is_empty() {
        log(&format!("Creating new tracker: {}", tracker_name));

        if let Err(e) = add_tracker(app_handle, tracker_name, [0, 0, 0, 0, 0, 0x01]).await {
            log(&format!("Failed to add tracker: {}", e));
            return Err(format!("Failed to add tracker: {}", e));
        }
    }

    let imu_data = match decode_imu(&data, tracker_name) {
        Ok(data) => data,
        Err(e) => {
            log(&format!(
                "Failed to decode IMU data for tracker {}: {}",
                tracker_name, e
            ));
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

    log(&format!(
        "Tracker: {} - IMU: {:?} - Mag: {:?} -  Ankle: {:?}",
        tracker_name, imu_data, mag_status, ankle
    ));

    let imu_payload = serde_json::json!({
        "tracker": tracker_name,
        "data": {
            "rotation": imu_data.rotation.degrees,
            "acceleration": imu_data.acceleration,
            "ankle": ankle,
        },
    });
    let mag_payload = serde_json::json!({
        "tracker": tracker_name,
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

    let tracker_name = tracker_name.to_string();

    if let Err(e) = send_rotation(&tracker_name, 0, rotation_data).await {
        log(&format!("Failed to send rotation: {}", e));
    }

    if let Err(e) = send_accel(&tracker_name, 0, accel_data).await {
        log(&format!("Failed to send acceleration: {}", e));
    }

    Ok(())
}
