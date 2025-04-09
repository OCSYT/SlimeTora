use crate::{interpreters::core::Interpreter, util::log};
use base64::Engine;
use tauri::AppHandle;

use super::common::decode_imu;

pub struct HaritoraXWireless;

impl Interpreter for HaritoraXWireless {
    fn parse_ble(
        app_handle: &AppHandle,
        device_id: Option<&str>,
        characteristic_uuid: &str,
        data: &str,
    ) -> Result<(), String> {
        // Implement BLE parsing logic for HaritoraX Wireless
        Ok(())
    }

    fn parse_serial(app_handle: &AppHandle, tracker_name: &str, data: &str) -> Result<(), String> {
        // Implement serial parsing logic for HaritoraX Wireless

        let (identifier, data) = data.split_once(':').unwrap_or(("", ""));
        log(&format!(
            "Received identifier: {}, data: {}",
            identifier, data
        ));

        match identifier {
            "x" => {
                // turn data into a buffer
                let buffer = base64::engine::general_purpose::STANDARD
                    .decode(data)
                    .map_err(|e| format!("Failed to decode base64 data: {}", e))?;
                process_imu_data(app_handle, tracker_name, buffer)?;
            }
            _ => {
                log(&format!("Unknown identifier: {}", identifier));
            }
        }

        Ok(())
    }
}

fn process_imu_data(
    app_handle: &AppHandle,
    tracker_name: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    let imu_data = decode_imu(&data, tracker_name);
    // since we are in wireless trackers, the ankle and wireless data is actually within the data
    // this probably also applies to X2's, but ofc it's very different (with the new LiDAR sensor)
    let buffer_data = base64::engine::general_purpose::STANDARD.encode(data.clone());
    let ankle = if !buffer_data.ends_with("==") {
        let data_bytes = &data[data.len() - 2..];
        Some(u16::from_le_bytes([data_bytes[0], data_bytes[1]]))
    } else {
        None
    };

    if !tracker_name.starts_with("HaritoraXW") {
        let magnetometer_data = buffer_data.chars().nth(buffer_data.len() - 5);
        let mag_status = match magnetometer_data {
            Some('A') => "VERY_BAD",
            Some('B') => "BAD",
            Some('C') => "OKAY",
            Some('D') => "GREAT",
            _ => "Unknown",
        };
        log(&format!(
            "Tracker: {}, Magnetometer Status: {}",
            tracker_name, mag_status
        ));
    }

    log(&format!(
        "Tracker: {}, IMU Data: {:?}, Ankle: {:?}",
        tracker_name, imu_data, ankle
    ));

    // TODO: send the data to SlimeVR, then to UI

    Ok(())
}
