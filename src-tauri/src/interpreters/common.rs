use super::core::ChargeStatus;
use crate::interpreters::core::{
    Acceleration, BatteryData, IMUData, InfoData, Rotation, Rotations,
};
use crate::log;
use base64::Engine;
use byteorder::{LittleEndian, ReadBytesExt};
use dashmap::DashMap;
use nalgebra::{Quaternion, UnitQuaternion};
use once_cell::sync::Lazy;
use std::io::Cursor;
use std::time::Instant;
use tracker_emulation_rs::EmulatedTracker;

pub static CONNECTED_TRACKERS: Lazy<DashMap<String, Option<EmulatedTracker>>> =
    Lazy::new(DashMap::new);

const ROTATION_SCALAR: f32 = 0.01 / 180.0;
const GRAVITY_SCALAR: f32 = 1.0 / 256.0;
const GRAVITY_CONSTANT: f32 = 9.81;
const GRAVITY_ADJUSTMENT: f32 = 1.2;

// map of tracker name and button presses int
static BUTTON_MAP: Lazy<DashMap<&'static str, u8>> = Lazy::new(|| {
    let map = DashMap::new();
    map.insert("main", 0);
    map.insert("sub", 0);
    map.insert("tertiary", 0);
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
    )); // changed rotation to rotation_obj
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
) -> Result<BatteryData, String> {
    if tracker_name.is_empty() || data.is_empty() {
        return Err("Tracker name or data is empty".to_string());
    }

    let mut battery_data = BatteryData {
        remaining: None,
        voltage: None,
        status: None,
    };

    if let Some(characteristic) = characteristic {
        let buffer = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

        match characteristic {
            "BatteryLevel" => {
                let remaining = u8::from_str_radix(&hex::encode(&buffer), 16)
                    .map_err(|e| format!("Failed to parse battery level: {}", e))?;
                battery_data.remaining = Some(remaining);
            }
            "BatteryVoltage" => {
                let voltage =
                    i16::from_le_bytes(buffer[..2].try_into().map_err(|_| "Invalid voltage data")?)
                        as f64;
                battery_data.voltage = Some(voltage as u16);
            }
            "ChargeStatus" => {
                let status = buffer[0];
                battery_data.status = match status {
                    0 => Some(ChargeStatus::Discharging),
                    1 => Some(ChargeStatus::Charging),
                    2 => Some(ChargeStatus::Charged),
                    _ => None,
                };

                if battery_data.status.is_none() {
                    return Err(format!("Unknown charge status: {}", status));
                }
            }
            _ => return Err(format!("Unknown characteristic: {}", characteristic)),
        }

        log!(
            "Processed battery data for tracker \"{}\": {:?}",
            tracker_name,
            battery_data
        );
    } else {
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
    }

    log!(
        "Processed battery data for tracker \"{}\": remaining: {:?}%, voltage: {:?}, status: {:?}",
        tracker_name,
        battery_data.remaining,
        battery_data.voltage,
        battery_data.status
    );
    Ok(battery_data)
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
    static LAST_PRESS_TIMES: Lazy<DashMap<&'static str, Instant>> =
        Lazy::new(DashMap::new);

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

    log!(
        "Button pressed from tracker {}: {}",
        tracker_name,
        button_pressed
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

    log!(
        "Received info data: {:?} requested by tracker: {}",
        info_data,
        tracker_name
    );

    Ok(info_data)
}
