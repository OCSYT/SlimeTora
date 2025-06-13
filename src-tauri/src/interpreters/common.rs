use super::core::ChargeStatus;
use crate::interpreters::core::{
    Acceleration, BatteryData, IMUData, InfoData, Rotation, Rotations,
};
use base64::Engine;
use byteorder::{LittleEndian, ReadBytesExt};
use dashmap::DashMap;
use log::info;
use nalgebra::{Quaternion, UnitQuaternion};
use once_cell::sync::Lazy;
use std::io::Cursor;
use std::time::Instant;
use tracker_emulation_rs::EmulatedTracker;

pub static CONNECTED_TRACKERS: Lazy<DashMap<String, Option<EmulatedTracker>>> =
    Lazy::new(DashMap::new);

// BatteryLevel: Option<u8>, BatteryVoltage: Option<u16>, ChargeStatus: Option<String>
pub static BATTERY_INFO: Lazy<DashMap<String, (Option<u8>, Option<u16>, Option<String>)>> =
    Lazy::new(DashMap::new);

const ROTATION_SCALAR: f32 = 0.01 / 180.0;
const GRAVITY_SCALAR: f32 = 1.0 / 256.0;
const GRAVITY_CONSTANT: f32 = 9.81;
const GRAVITY_ADJUSTMENT: f32 = 1.2;

// map of tracker name and button presses as int
static BUTTON_MAP: Lazy<DashMap<&'static str, u8>> = Lazy::new(|| {
    let map = DashMap::new();
    map.insert("main", 255);
    map.insert("sub", 255);
    map.insert("tertiary", 255);
    map
});

/// ### Connections supported:
/// - Serial
/// - BLE
///
/// ### Trackers supported:
/// - HaritoraX Wired (1.0/1.1/1.1b)
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn decode_imu(data: &[u8], tracker_name: &str) -> Result<IMUData, String> {
    if tracker_name.is_empty() || data.len() < 14 {
        return Err(format!(
            "Invalid data for IMU packet: {}",
            if tracker_name.is_empty() {
                "no tracker name"
            } else {
                "insufficient data length"
            }
        ));
    }

    let mut cursor = Cursor::new(data);

    // Read rotation
    let rotation_x = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read rotation_x: {}", e))? as f32
        * ROTATION_SCALAR;
    let rotation_y = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read rotation_y: {}", e))? as f32
        * ROTATION_SCALAR;
    let rotation_z = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read rotation_z: {}", e))? as f32
        * -ROTATION_SCALAR;
    let rotation_w = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read rotation_w: {}", e))? as f32
        * -ROTATION_SCALAR;

    // Read raw gravity
    let raw_gravity_x = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read raw_gravity_x: {}", e))?
        as f32
        * GRAVITY_SCALAR;
    let raw_gravity_y = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read raw_gravity_y: {}", e))?
        as f32
        * GRAVITY_SCALAR;
    let raw_gravity_z = cursor
        .read_i16::<LittleEndian>()
        .map_err(|e| format!("Failed to read raw_gravity_z: {}", e))?
        as f32
        * GRAVITY_SCALAR;

    let rotation_obj = Rotation {
        x: rotation_x,
        y: rotation_y,
        z: rotation_z,
        w: rotation_w,
    };

    let rc = [
        rotation_obj.w,
        rotation_obj.x,
        rotation_obj.y,
        rotation_obj.z,
    ];
    let r = [rc[0], -rc[1], -rc[2], -rc[3]];
    let p = [0.0, 0.0, 0.0, GRAVITY_CONSTANT];

    let hrp = [
        r[0] * p[0] - r[1] * p[1] - r[2] * p[2] - r[3] * p[3],
        r[0] * p[1] + r[1] * p[0] + r[2] * p[3] - r[3] * p[2],
        r[0] * p[2] - r[1] * p[3] + r[2] * p[0] + r[3] * p[1],
        r[0] * p[3] + r[1] * p[2] - r[2] * p[1] + r[3] * p[0],
    ];

    let h_final = [
        hrp[0] * rc[0] - hrp[1] * rc[1] - hrp[2] * rc[2] - hrp[3] * rc[3],
        hrp[0] * rc[1] + hrp[1] * rc[0] + hrp[2] * rc[3] - hrp[3] * rc[2],
        hrp[0] * rc[2] - hrp[1] * rc[3] + hrp[2] * rc[0] + hrp[3] * rc[1],
        hrp[0] * rc[3] + hrp[1] * rc[2] - hrp[2] * rc[1] + hrp[3] * rc[0],
    ];

    // Create acceleration object
    let acceleration = Acceleration {
        x: raw_gravity_x - h_final[1] * -GRAVITY_ADJUSTMENT,
        y: raw_gravity_y - h_final[2] * -GRAVITY_ADJUSTMENT,
        z: raw_gravity_z - h_final[3] * GRAVITY_ADJUSTMENT,
    };

    // Convert rotation to degrees
    let quaternion = UnitQuaternion::from_quaternion(Quaternion::new(
        rotation_obj.w as f32,
        rotation_obj.x as f32,
        rotation_obj.y as f32,
        rotation_obj.z as f32,
    ));
    let euler_angles = quaternion.euler_angles();

    // Convert radians to degrees
    let x = euler_angles.0 * (180.0 / std::f32::consts::PI);
    let y = euler_angles.1 * (180.0 / std::f32::consts::PI);
    let z = euler_angles.2 * (180.0 / std::f32::consts::PI);

    let rotation_degrees = Rotation { x, y, z, w: 0.0 };

    let rotations = Rotations {
        raw: rotation_obj,
        degrees: rotation_degrees,
    };

    // ankle and magStatus processed within interpreters, not here

    Ok(IMUData {
        tracker_name: tracker_name.to_string(),
        rotation: rotations,
        acceleration,
        ankle: None,
        mag_status: None,
    })
}

/// Processes magnetometer data for a tracker.
///
/// ### Connections supported:
/// - BLE
///
/// ### Trackers supported:
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn process_mag_data(data: &str) -> Result<String, String> {
    // convert data into base64 buffer
    let buffer = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

    let mag_data = buffer[0];

    let mag_status = match mag_data {
        3 => "GREAT",
        2 => "OKAY",
        1 => "BAD",
        0 => "VERY_BAD",
        _ => "UNKNOWN",
    };

    Ok(mag_status.to_string())
}

/// Processes battery data for a tracker.
///
/// ### Connections supported:
/// - Serial
/// - BLE
///
/// ### Trackers supported:
/// - HaritoraX Wired (1.0/1.1/1.1b)
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn process_battery_data(
    data: &str,
    tracker_name: &str,
    characteristic: Option<&str>,
) -> Result<Option<BatteryData>, String> {
    if tracker_name.is_empty() || data.is_empty() {
        return Ok(None);
    }

    // for BLE, processed based on characteristics
    if let Some(characteristic) = characteristic {
        let mut entry = BATTERY_INFO
            .entry(tracker_name.to_string())
            .or_insert((None, None, None));
        let buffer = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

        let mut just_charge_status = false;

        match characteristic {
            "BatteryLevel" => {
                let remaining = u8::from_str_radix(&hex::encode(&buffer), 16)
                    .map_err(|e| format!("Failed to parse battery level: {}", e))?;
                entry.0 = Some(remaining);
            }
            "BatteryVoltage" => {
                let voltage =
                    i16::from_le_bytes(buffer[..2].try_into().map_err(|_| "Invalid voltage data")?)
                        as f64;
                entry.1 = Some(voltage as u16);
            }
            "ChargeStatus" => {
                let status = buffer[0];
                let new_status = match status {
                    0 => Some("discharging".to_string()),
                    1 => Some("charging".to_string()),
                    2 => Some("charged".to_string()),
                    _ => None,
                };
                // Only emit if status changed
                if entry.2 != new_status {
                    entry.2 = new_status;
                    just_charge_status = true;
                }
            }
            _ => return Err(format!("Unknown characteristic: {}", characteristic)),
        }

        // only emit if we have both BatteryLevel and BatteryVoltage
        if entry.0.is_some() && entry.1.is_some() {
            let battery_data = BatteryData {
                remaining: entry.0,
                voltage: entry.1,
                status: None,
            };
            info!(
                "Processed BLE battery data for tracker `{}`: {:?}",
                tracker_name, battery_data
            );
            // reset BatteryLevel and BatteryVoltage
            entry.0 = None;
            entry.1 = None;
            return Ok(Some(battery_data));
        } else if just_charge_status && entry.2.is_some() {
            // emit charge status
            let status_enum = match entry.2.as_deref() {
                Some("discharging") => Some(ChargeStatus::Discharging),
                Some("charging") => Some(ChargeStatus::Charging),
                Some("charged") => Some(ChargeStatus::Charged),
                _ => None,
            };
            let battery_data = BatteryData {
                remaining: None,
                voltage: None,
                status: status_enum,
            };
            info!(
                "Processed BLE battery data for tracker `{}`: {:?}",
                tracker_name, battery_data
            );
            return Ok(Some(battery_data));
        } else {
            // not enough data yet
            return Ok(None);
        }
    }

    // for serial it's a JSON string
    let mut battery_data = BatteryData {
        remaining: None,
        voltage: None,
        status: None,
    };
    if characteristic.is_none() {
        let battery_info: serde_json::Value = serde_json::from_str(data)
            .map_err(|e| format!("Failed to parse battery data JSON: {}", e))?;
        battery_data.remaining = battery_info["battery remaining"].as_u64().map(|v| v as u8);
        battery_data.voltage = battery_info["battery voltage"].as_u64().map(|v| v as u16);
        battery_data.status =
            battery_info["charge status"]
                .as_str()
                .and_then(|s| match s.to_lowercase().as_str() {
                    "discharging" => Some(ChargeStatus::Discharging),
                    "charging" => Some(ChargeStatus::Charging),
                    "charged" => Some(ChargeStatus::Charged),
                    _ => None,
                });
        if battery_data.status.is_none() {
            return Err(format!(
                "Unknown charge status: {}",
                battery_info["charge status"].as_str().unwrap_or("Unknown")
            ));
        }
        info!(
            "Processed serial battery data for tracker `{}`: remaining: {:?}%, voltage: {:?}, status: {:?}",
            tracker_name, battery_data.remaining, battery_data.voltage, battery_data.status
        );
        return Ok(Some(battery_data));
    }
    Ok(None)
}

/// Processes button data for a tracker.
/// Returns the button that was pressed.
///
/// ### Connections supported:
/// - Serial
/// - BLE
///
/// ### Trackers supported:
/// - (?) HaritoraX Wired (1.0/1.1/1.1b)
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn process_button_data(
    data: &str,
    // TODO: check if we even need tracker_name here - maybe we will identify the trackers first and then when we know
    // then we can process the data for the specific tracker, meaning we already know the tracker and dont need to pass
    // it as an argument in any of the functions
    tracker_name: &str,
    characteristic: Option<&str>,
) -> Result<String, String> {
    // we should only check difference and return which button was changed
    // so we should store it locally for every tracker. does not apply to BLE.
    // TODO: find tertiary characteristic for wired

    let mut button_pressed = "";
    let debounce_threshold = 50;
    static LAST_PRESS_TIMES: Lazy<DashMap<&'static str, Instant>> = Lazy::new(DashMap::new);

    // process for BLE
    if let Some(characteristic) = characteristic {
        match characteristic {
            "MainButton" => button_pressed = "main",
            "SubButton" => button_pressed = "sub",
            "TertiaryButton" => button_pressed = "tertiary",
            _ => {
                return Err(format!(
                    "Unknown characteristic for button data: {}",
                    characteristic
                ));
            }
        }
    } else {
        // tertiary button is handled in the interpreter for wired (only exists on wired trackers)
        // we don't process it in this function (wired is sent as a JSON)
        let main_button = data.chars().nth(6).unwrap_or('0').to_digit(16).unwrap_or(0) as u8;
        let sub_button = data.chars().nth(9).unwrap_or('0').to_digit(16).unwrap_or(0) as u8;

        // compare to BUTTON_MAP to see which button was pressed
        {
            let main_value = BUTTON_MAP.get("main").map(|r| *r.value());
            if let Some(previous_main) = main_value {
                if previous_main != main_button {
                    let now = Instant::now();
                    let last_press_time = LAST_PRESS_TIMES.get("main").map(|r| *r.value());

                    if last_press_time.is_none()
                        || now.duration_since(last_press_time.unwrap()).as_millis()
                            > debounce_threshold
                    {
                        button_pressed = "main";
                        BUTTON_MAP.insert("main", main_button);
                        LAST_PRESS_TIMES.insert("main", now);
                    }
                }
            }
        }

        {
            let sub_value = BUTTON_MAP.get("sub").map(|r| *r.value());
            if let Some(previous_sub) = sub_value {
                if previous_sub != sub_button {
                    let now = Instant::now();
                    let last_press_time = LAST_PRESS_TIMES.get("sub").map(|r| *r.value());

                    if last_press_time.is_none()
                        || now.duration_since(last_press_time.unwrap()).as_millis()
                            > debounce_threshold
                    {
                        button_pressed = "sub";
                        BUTTON_MAP.insert("sub", sub_button);
                        LAST_PRESS_TIMES.insert("sub", now);
                    }
                }
            }
        }
    }

    // TODO: detect if vrmanager/haritoraconfigurator is open

    info!(
        "Button pressed from tracker {}: {}",
        tracker_name, button_pressed
    );
    Ok(button_pressed.to_string())
}

/// Processes info data for the set of trackers.
///
/// ### Connections supported:
/// - Serial
///
/// ### Trackers supported:
/// - HaritoraX Wired (1.0/1.1/1.1b)
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn process_info_data(data: &str, tracker_name: &str) -> Result<InfoData, String> {
    // example: {"model":"MC2B", "version":"1.7.10", "serial no":"0000000", "comm":"BLT", "comm_next":"BTSPP"}
    let json_data: serde_json::Value =
        serde_json::from_str(data).expect("Failed to parse JSON data");
    let model = json_data["model"].as_str().unwrap_or("").to_string();
    let version = json_data["version"].as_str().unwrap_or("").to_string();
    let serial = json_data["serial no"].as_str().unwrap_or("").to_string();
    let communication = json_data["comm"].as_str().map(|s| s.to_string());
    let communication_type = json_data["comm_next"].as_str().map(|s| s.to_string());
    let info_data = InfoData {
        version,
        model,
        serial,
        communication,
        communication_type,
    };

    info!(
        "Received info data from tracker {}: {:?}",
        tracker_name, info_data
    );

    Ok(info_data)
}

/// Processes settings data for a tracker.
///
/// ### Connections supported:
/// - Serial
/// - BLE(?)
///
/// ### Trackers supported:
/// - HaritoraX Wired (1.0/1.1/1.1b)
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn process_settings_data(data: &str, tracker_name: &str) -> Result<serde_json::Value, String> {
    let sensor_mode = data.chars().nth(6).unwrap_or('0').to_digit(16).unwrap_or(0) as u8;
    let fps_mode = data.chars().nth(5).unwrap_or('0').to_digit(16).unwrap_or(0) as u8;
    let sensor_auto_correction = data
        .chars()
        .nth(10)
        .unwrap_or('0')
        .to_digit(16)
        .unwrap_or(0) as u8;
    let ankle_enabled = data
        .chars()
        .nth(13)
        .unwrap_or('0')
        .to_digit(16)
        .unwrap_or(0) as u8;

    let sensor_mode_text = if sensor_mode == 0 { 2 } else { 1 };
    let fps_mode_text = if fps_mode == 0 { 50 } else { 100 };
    let ankle_motion_detection_text = ankle_enabled != 0;
    let sensor_auto_correction_components = ["accel", "gyro", "mag"]
        .iter()
        .enumerate()
        .filter_map(|(i, &name)| {
            if (sensor_auto_correction & (1 << i)) != 0 {
                Some(name)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    let settings_data = serde_json::json!({
        "sensor_mode": sensor_mode_text,
        "fps_mode": fps_mode_text,
        "sensor_auto_correction": sensor_auto_correction_components,
        "ankle_enabled": ankle_motion_detection_text,
    });

    info!(
        "Received settings data from tracker {}: {:?}",
        tracker_name, settings_data
    );

    Ok(settings_data)
}

/// Processes connection data for a tracker.
///
/// ### Connections supported:
/// - Serial
///
/// ### Trackers supported:
/// - HaritoraX Wireless
/// - HaritoraX 2
pub fn process_connection_data(
    data: &str
) -> Result<serde_json::Value, String> {
    // data is in format 7f7f7f7f7f7f (tracker not found) OR other hex data like 284128442f30 (RSSI)
    let rssi_data = if data == "7f7f7f7f7f7f" {
        None
    } else {
        // TODO: ok this is like extremely inaccurate, no idea if this is actually RSSI or if reading wrong
        if data.len() != 12 {
            return Err(format!("Invalid RSSI hex string length: {}", data.len()));
        }

        let dongle_rssi_hex = &data[0..6];
        let tracker_rssi_hex = &data[6..12];

        let parse_rssi = |hex_string: &str| -> Result<Option<i8>, String> {
            if hex_string.len() != 6 {
                return Err(format!(
                    "Invalid RSSI hex string length: {}",
                    hex_string.len()
                ));
            }

            let bytes = (0..hex_string.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&hex_string[i..i + 2], 16))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Failed to parse RSSI hex: {}", e))?;

            if let Some(byte) = bytes.first() {
                Ok(Some(*byte as i8))
            } else {
                Ok(None)
            }
        };

        let dongle = parse_rssi(dongle_rssi_hex)?;
        let tracker = parse_rssi(tracker_rssi_hex)?;

        match (dongle, tracker) {
            (Some(dongle_val), Some(tracker_val)) => Some((dongle_val, tracker_val)),
            _ => None,
        }
    };

    let tracker_data_value = match rssi_data {
        Some((dongle, tracker)) => {
            serde_json::json!({ "dongle_rssi": dongle, "tracker_rssi": tracker })
        }
        None => serde_json::json!({ "dongle_rssi": null, "tracker_rssi": null }),
    };

    Ok(tracker_data_value)
}
