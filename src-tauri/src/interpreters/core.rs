use async_trait::async_trait;
use dashmap::{DashMap, DashSet};
use log::{error, info};
use once_cell::sync::Lazy;
use std::sync::Arc;
use tauri::AppHandle;

use super::{haritorax_2, haritorax_wired, haritorax_wireless};
use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Hash, Clone, Serialize)]
pub enum TrackerModel {
    X2,
    Wireless,
    Wired,
}

#[async_trait]
pub trait Interpreter: Send + Sync {
    async fn parse_ble(
        &self,
        app_handle: &AppHandle,
        device_id: &str,
        char_name: &str,
        data: &str,
    ) -> Result<(), String>;

    async fn parse_serial(
        &self,
        app_handle: &AppHandle,
        tracker_name: &str,
        data: &str,
    ) -> Result<(), String>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IMUData {
    pub tracker_name: String,
    pub rotation: Rotations,
    pub acceleration: Acceleration,
    pub ankle: Option<f32>,
    pub mag_status: Option<MagStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rotations {
    pub raw: Rotation,
    pub degrees: Rotation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryData {
    pub remaining: Option<u8>,
    pub voltage: Option<u16>,
    pub status: Option<ChargeStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfoData {
    pub version: String,
    pub model: String,
    pub serial: String,
    pub communication: Option<String>,
    pub communication_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rotation {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Acceleration {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MagStatus {
    Great,
    Okay,
    Bad,
    VeryBad,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChargeStatus {
    Discharging,
    Charging,
    Charged,
    Unknown,
}

pub static INTERPRETERS: Lazy<DashMap<TrackerModel, Arc<dyn Interpreter + Send + Sync>>> =
    Lazy::new(DashMap::new);
pub static ACTIVE_MODELS: Lazy<DashSet<TrackerModel>> = Lazy::new(DashSet::new);

pub fn init_interpreters() {
    info!("Initializing interpreters");

    INTERPRETERS.insert(
        TrackerModel::X2,
        Arc::new(haritorax_2::HaritoraX2) as Arc<dyn Interpreter + Send + Sync>,
    );
    INTERPRETERS.insert(
        TrackerModel::Wireless,
        Arc::new(haritorax_wireless::HaritoraXWireless) as Arc<dyn Interpreter + Send + Sync>,
    );
    INTERPRETERS.insert(
        TrackerModel::Wired,
        Arc::new(haritorax_wired::HaritoraXWired) as Arc<dyn Interpreter + Send + Sync>,
    );

    info!("Interpreters initialized");
}

pub fn start_interpreting(model: &str) -> Result<(), String> {
    if INTERPRETERS.is_empty() {
        init_interpreters();
    }

    info!("Starting interpreter for model: {}", model);

    let tracker_model = match model {
        "X2" => TrackerModel::X2,
        "Wireless" => TrackerModel::Wireless,
        "Wired" => TrackerModel::Wired,
        _ => return Err(format!("Unknown tracker model: {}", model)),
    };

    if !INTERPRETERS.contains_key(&tracker_model) {
        return Err(format!("No interpreter found for model: {}", model));
    }

    ACTIVE_MODELS.insert(tracker_model);
    info!("Interpreter started for model: {}", model);
    Ok(())
}

pub fn stop_interpreting(model: &str) -> Result<(), String> {
    info!("Stopping interpreter for model: {}", model);

    let tracker_model = match model {
        "X2" => TrackerModel::X2,
        "Wireless" => TrackerModel::Wireless,
        "Wired" => TrackerModel::Wired,
        _ => return Err(format!("Unknown tracker model: {}", model)),
    };

    ACTIVE_MODELS.remove(&tracker_model);
    info!("Interpreter stopped for model: {}", model);
    Ok(())
}

pub async fn process_serial(
    app_handle: &AppHandle,
    tracker_name: &str,
    data: &str,
) -> Result<(), String> {
    if ACTIVE_MODELS.is_empty() {
        return Err("No active interpreters".to_string());
    }

    // Try to identify the model from tracker_name if possible
    let model_hint = if tracker_name.contains("X2") {
        Some(TrackerModel::X2)
    } else if tracker_name.contains("XW") {
        Some(TrackerModel::Wireless)
    } else if tracker_name.contains("X") {
        Some(TrackerModel::Wired)
    } else {
        None
    };

    // First try the hinted model if available and active
    if let Some(model) = model_hint {
        if ACTIVE_MODELS.contains(&model) {
            if let Some(interpreter_ref) = INTERPRETERS.get(&model) {
                match interpreter_ref
                    .parse_serial(app_handle, tracker_name, data)
                    .await
                {
                    Ok(_) => return Ok(()),
                    Err(e) => error!("Hinted interpreter for {:?} failed: {}", model, e),
                }
            }
        }
    }

    // Try all active interpreters
    for active_model in ACTIVE_MODELS.iter() {
        if let Some(interpreter_ref) = INTERPRETERS.get(active_model.key()) {
            match interpreter_ref
                .parse_serial(app_handle, tracker_name, data)
                .await
            {
                Ok(_) => return Ok(()),
                Err(e) => error!(
                    "Serial Interpreter for {:?} failed: {}",
                    active_model.key(),
                    e
                ),
            }
        }
    }

    Err("No interpreter could process the data".to_string())
}

pub async fn process_ble(
    app_handle: &AppHandle,
    device_id: &str,
    char_name: &str,
    data: &str,
) -> Result<(), String> {
    if ACTIVE_MODELS.is_empty() {
        return Err("No active interpreters".to_string());
    }

    // Try to identify model from device_id if available
    if !device_id.is_empty() {
        let model = if device_id.starts_with("HaritoraX2-") {
            Some(TrackerModel::X2)
        } else if device_id.starts_with("HaritoraXW-") {
            Some(TrackerModel::Wireless)
        } else if device_id.starts_with("HaritoraX-") {
            Some(TrackerModel::Wired)
        } else {
            None
        };

        // If we identified a model and it's active, use that interpreter
        if let Some(identified_model) = model {
            if ACTIVE_MODELS.contains(&identified_model) {
                if let Some(interpreter_ref) = INTERPRETERS.get(&identified_model) {
                    return interpreter_ref
                        .parse_ble(app_handle, device_id, char_name, data)
                        .await;
                }
            }
        }
    }

    // If no specific model identified or it failed, try all active interpreters
    for active_model in ACTIVE_MODELS.iter() {
        if let Some(interpreter_ref) = INTERPRETERS.get(active_model.key()) {
            match interpreter_ref
                .parse_ble(app_handle, device_id, char_name, data)
                .await
            {
                Ok(_) => return Ok(()),
                Err(e) => error!("BLE Interpreter for {:?} failed: {}", active_model.key(), e),
            }
        }
    }

    Err("No interpreter could process the BLE data".to_string())
}
