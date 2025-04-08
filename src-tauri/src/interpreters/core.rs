use crate::util::log;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

use super::{haritorax_2, haritorax_wired, haritorax_wireless};

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum TrackerModel {
    X2,
    Wireless,
    Wired,
}

pub trait Interpreter {
    fn parse_ble(
        app_handle: &AppHandle,
        device_id: Option<&str>,
        characteristic_uuid: &str,
        data: &str,
    ) -> Result<(), String>;

    fn parse_serial(app_handle: &AppHandle, device_id: Option<&str>, data: &str) -> Result<(), String>;
}

// Function signature for interpreter functions
type InterpreterBLEFn =
    fn(&AppHandle, Option<&str>, &str, &str) -> Result<(), String>;

type InterpreterSerialFn =
    fn(&AppHandle, Option<&str>, &str) -> Result<(), String>;

#[derive(Debug, Clone)]
pub struct IMUData {
    pub tracker_name: String,
    pub rotation: Rotation,
    pub acceleration: Acceleration,
    pub ankle: Option<f32>,
    pub mag_status: Option<MagStatus>,
}

#[derive(Debug, Clone)]
pub struct Rotation {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

#[derive(Debug, Clone)]
pub struct Acceleration {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone)]
pub enum MagStatus {
    Great,
    Okay,
    Bad,
    VeryBad,
    Unknown,
}

static INTERPRETER_MAP_BLE: Lazy<HashMap<TrackerModel, InterpreterBLEFn>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(TrackerModel::X2, haritorax_2::HaritoraX2::parse_ble as InterpreterBLEFn);
    map.insert(TrackerModel::Wireless, haritorax_wireless::HaritoraXWireless::parse_ble as InterpreterBLEFn);
    map.insert(TrackerModel::Wired, haritorax_wired::HaritoraXWired::parse_ble as InterpreterBLEFn);
    map
});

static INTERPRETER_MAP_SERIAL: Lazy<HashMap<TrackerModel, InterpreterSerialFn>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(TrackerModel::X2, haritorax_2::HaritoraX2::parse_serial as InterpreterSerialFn);
    map.insert(TrackerModel::Wireless, haritorax_wireless::HaritoraXWireless::parse_serial as InterpreterSerialFn);
    map.insert(TrackerModel::Wired, haritorax_wired::HaritoraXWired::parse_serial as InterpreterSerialFn);
    map
});

// Track active interpreters
static ACTIVE_MODELS: Lazy<Arc<Mutex<Vec<TrackerModel>>>> =
    Lazy::new(|| Arc::new(Mutex::new(Vec::new())));

pub fn start_interpreting(app_handle: &AppHandle, model: &str) -> Result<(), String> {
    log(&format!("Starting interpreter for model: {}", model));

    // Convert string to enum
    let tracker_model = match model {
        "X2" => TrackerModel::X2,
        "Wireless" => TrackerModel::Wireless,
        "Wired" => TrackerModel::Wired,
        _ => return Err(format!("Unknown tracker model: {}", model)),
    };

    // Add the model to active models if not already active
    {
        let mut active_models = ACTIVE_MODELS.lock().unwrap();
        if !active_models.contains(&tracker_model) {
            active_models.push(tracker_model.clone());
        }
    }

    log(&format!("Interpreter started for model: {}", model));
    Ok(())
}

pub fn stop_interpreting(app_handle: &AppHandle, model: &str) -> Result<(), String> {
    log(&format!("Stopping interpreter for model: {}", model));

    // Convert string to enum
    let tracker_model = match model {
        "X2" => TrackerModel::X2,
        "Wireless" => TrackerModel::Wireless,
        "Wired" => TrackerModel::Wired,
        _ => return Err(format!("Unknown tracker model: {}", model)),
    };

    // Remove the model from active models
    {
        let mut active_models = ACTIVE_MODELS.lock().unwrap();
        if let Some(pos) = active_models.iter().position(|x| *x == tracker_model) {
            active_models.remove(pos);
        }
    }
    log(&format!("Interpreter stopped for model: {}", model));

    Ok(())
}

// Process data with all active interpreters or a specific one if device ID can be matched
pub fn process_serial(
    app_handle: &AppHandle,
    device_id: Option<&str>,
    data: &str,
) -> Result<(), String> {
    if let Some(id) = device_id {
        // Here you would match device_id to a specific model
        // This requires keeping track of which devices belong to which model
        // For now, let's continue with a simple implementation
    }

    let active_models = {
        let models = ACTIVE_MODELS.lock().unwrap();
        models.clone()
    };

    if active_models.is_empty() {
        return Err("No active interpreters".to_string());
    }

    // Try all active interpreters or use device_id to determine which one to use
    for model in active_models {
        if let Some(interpreter_fn) = INTERPRETER_MAP_SERIAL.get(&model) {
            match interpreter_fn(app_handle, device_id, data) {
                Ok(_) => return Ok(()), // Successfully processed by this interpreter
                Err(e) => log(&format!("Interpreter for {:?} failed: {}", model, e)),
            }
        }
    }

    // If we get here, none of the interpreters could handle the data
    Err("No interpreter could process the data".to_string())
}

pub fn process_ble(
    app_handle: &AppHandle,
    device_id: Option<&str>,
    characteristic_uuid: &str,
    data: &str,
) -> Result<(), String> {
    if let Some(id) = device_id {
        // Here you would match device_id to a specific model
        // This requires keeping track of which devices belong to which model
        // For now, let's continue with a simple implementation
    }

    let active_models = {
        let models = ACTIVE_MODELS.lock().unwrap();
        models.clone()
    };

    if active_models.is_empty() {
        return Err("No active interpreters".to_string());
    }

    // Try all active interpreters or use device_id to determine which one to use
    for model in active_models {
        if let Some(interpreter_fn) = INTERPRETER_MAP_BLE.get(&model) {
            match interpreter_fn(app_handle, device_id, characteristic_uuid, data) {
                Ok(_) => return Ok(()), // Successfully processed by this interpreter
                Err(e) => log(&format!("Interpreter for {:?} failed: {}", model, e)),
            }
        }
    }

    // If we get here, none of the interpreters could handle the data
    Err("No interpreter could process the data".to_string())
}