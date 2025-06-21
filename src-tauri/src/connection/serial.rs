use once_cell::sync::Lazy;
use serde_json;
use serialport::SerialPort;
use std::{
    collections::HashSet,
    io::ErrorKind,
    sync::Mutex,
    thread::{self, sleep},
    time::Duration,
};

use crate::interpreters::{common::get_assignment_by_id, core::TrackerModel};
use log::{error, info, warn};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct TrackerInfo {
    serial_number: String,
    port: String,
    port_id: String,
    assignment: String,
    tracker_type: Option<TrackerModel>,
}

static PORTS: Mutex<Vec<Box<dyn SerialPort + Send>>> = Mutex::new(Vec::new());

static STOP_CHANNELS: Lazy<Mutex<Vec<std::sync::mpsc::Sender<()>>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

static THREAD_HANDLES: Lazy<Mutex<Vec<std::thread::JoinHandle<()>>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

static TRACKER_INFO: Lazy<Mutex<HashSet<TrackerInfo>>> = Lazy::new(|| Mutex::new(HashSet::new()));

// TODO: update logic for HX2 as the "extension" trackers will have same port/port id and serial number
pub async fn start(app_handle: tauri::AppHandle, port_paths: Vec<String>) -> Result<(), String> {
    info!("Starting serial connection on ports {:?}", &port_paths);

    let mut ports = PORTS.lock().unwrap();
    for port_path in &port_paths {
        let port = serialport::new(port_path, 500000)
            .timeout(Duration::from_secs(2))
            .open()
            .map_err(|e| format!("Failed to open port {}: {}", port_path, e))?;
        ports.push(port);

        let initial_commands = [
            "r0:", "r1:", "r:", "o:", "i:", "i0:", "i1:", "o0:", "o1:", "v0:", "v1:",
        ];
        for cmd in &initial_commands {
            let command = format!("\n{}\n", cmd);
            if let Err(e) = ports.last_mut().unwrap().write_all(command.as_bytes()) {
                error!(
                    "Failed to write initial command '{}' to port {}: {}",
                    cmd, port_path, e
                );
            }
        }
    }

    info!("Opened ports: {:?}", &port_paths);

    // listen to ports
    for port in ports.iter_mut() {
        let mut buffer = [0u8; 1024];
        let mut port_clone = port
            .try_clone()
            .map_err(|e| format!("Failed to clone port: {}", e))?;
        let port_path = port_clone.name().unwrap_or("Unknown".to_string());

        // channel for stop signals
        let (stop_tx, stop_rx) = std::sync::mpsc::channel();
        STOP_CHANNELS.lock().unwrap().push(stop_tx);

        let app_handle_clone = app_handle.clone();
        let handle = thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let mut accumulator = Vec::new();

                loop {
                if stop_rx.try_recv().is_ok() {
                    break;
                }

                match port_clone.read(&mut buffer) {
                    Ok(bytes_read) => {
                        if bytes_read > 0 {
                            if stop_rx.try_recv().is_ok() {
                                return;
                            }

                            accumulator.extend_from_slice(&buffer[..bytes_read]);

                            // process complete messages
                            while let Some(delimiter_index) =
                                accumulator.iter().position(|&b| b == b'\n')
                            {
                                if stop_rx.try_recv().is_ok() {
                                    return;
                                }

                                let message_bytes =
                                    accumulator.drain(..delimiter_index).collect::<Vec<u8>>();
                                accumulator.remove(0);

                                match String::from_utf8(message_bytes) {
                                    Ok(message) => {
                                        // split identifier and data
                                        let parts: Vec<&str> = message.splitn(2, ':').collect();
                                        if parts.len() < 2 {
                                            // not enough parts.. somehow
                                            continue;
                                        }

                                        let identifier = parts[0].to_lowercase();
                                        let port_id = identifier
                                            .chars()
                                            .find(|c| c.is_digit(10))
                                            .unwrap_or('0')
                                            .to_string();
                                        let port_data = parts[1];
                                        
                                        // handle "i" identifier to grab serial number
                                        if identifier.starts_with('i') && identifier.len() == 2 {
                                            if let Ok(json_data) = serde_json::from_str::<serde_json::Value>(port_data) {
                                                info!("Received JSON data: {}", port_data);
                                                if let Some(serial) = json_data.get("serial no").and_then(|s| s.as_str()) {
                                                    if serial != "A00000" {
                                                        info!("Found serial number: {}", serial);
                                                        
                                                        let tracker_type = json_data.get("model")
                                                            .and_then(|m| m.as_str())
                                                            .and_then(|model| {
                                                                info!("Found model: {}", model);
                                                                get_tracker_type_from_model(model)
                                                            });
                                                        
                                                        let mut tracker_info = TRACKER_INFO.lock().unwrap();
                                                        info!("Adding tracker info for serial: {} on port {} with port ID {}", serial, port_path, port_id);
                                                        tracker_info.insert(TrackerInfo {
                                                            serial_number: serial.to_string(),
                                                            port: port_path.clone(),
                                                            port_id: port_id.clone(),
                                                            assignment: String::new(), // filled later
                                                            tracker_type,
                                                        });
                                                        info!("Created tracker info entry for serial: {} on port {} with port ID {}", serial, port_path, port_id);
                                                    }
                                                } else {
                                                    info!("No 'serial no' field found in JSON: {}", port_data);
                                                }
                                            } else {
                                                info!("Failed to parse JSON: {}", port_data);
                                            }
                                        }

                                        // handle "r" identifier to get assignment and complete tracker info
                                        if identifier.starts_with('r') {
                                            if let Some(tracker_id_char) = port_data.chars().nth(4) {
                                                if let Ok(tracker_id) = tracker_id_char.to_string().parse::<i32>() {
                                                    let assignment_name = get_assignment_by_id(&tracker_id.to_string());
                                                    if let Some(assignment) = assignment_name {
                                                        let mut tracker_info = TRACKER_INFO.lock().unwrap();
                                                        if let Some(mut info) = tracker_info
                                                            .iter()
                                                            .find(|info| info.port == port_path && info.port_id == port_id && info.assignment.is_empty())
                                                            .cloned()
                                                        {
                                                            tracker_info.remove(&info);
                                                            info.assignment = assignment.to_string();
                                                            tracker_info.insert(info.clone());
                                                            info!("Updated tracker assignment: {} for serial {} on port {} with port ID {}", assignment, info.serial_number, port_path, port_id);
                                                        }
                                                    }
                                                }
                                            }
                                            info!("'r' identifier received with data: {}", port_data);
                                        }
                                        
                                        let tracker_assignment = {
                                            let tracker_info = TRACKER_INFO.lock().unwrap();
                                            tracker_info
                                                .iter()
                                                .find(|info| info.port == port_path && info.port_id == port_id && !info.assignment.is_empty())
                                                .map(|info| info.assignment.clone())
                                                .unwrap_or_default()
                                        };

                                        let (tracker_id, tracker_type) = {
                                            let tracker_info = TRACKER_INFO.lock().unwrap();
                                            tracker_info
                                                .iter()
                                                .find(|info| info.port == port_path && info.port_id == port_id)
                                                .map(|info| (info.serial_number.clone(), info.tracker_type.clone()))
                                                .unwrap_or_default()
                                        };

                                        if let (Some(tracker_type), assignment) = (tracker_type.clone(), tracker_assignment.clone()) {
                                            if !assignment.is_empty() {
                                                let result = crate::interpreters::core::process_serial(
                                                    &app_handle_clone,
                                                    &tracker_id,
                                                    &assignment,
                                                    &tracker_type,
                                                    &message,
                                                ).await;
                                                if let Err(e) = result {
                                                    error!(
                                                        "Failed to parse serial data: {}",
                                                        e
                                                    );
                                                }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        error!("Failed to convert message to UTF-8: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        if e.kind() == ErrorKind::TimedOut {
                            warn!("Read timed out, continuing...");
                            continue;
                        } else {
                            error!("Error reading from port: {}", e);
                            break;
                        }
                    }
                }
            }
        });
        });
        THREAD_HANDLES.lock().unwrap().push(handle);
    }

    // in 5 seconds, print out the tracker info
    thread::spawn(move || {
        sleep(Duration::from_secs(5));
        let tracker_info = TRACKER_INFO.lock().unwrap();
        info!("Tracker Info after 5 seconds: {:?}", *tracker_info);
    });

    Ok(())
}

pub async fn stop() -> Result<(), String> {
    {
        let mut stop_channels = STOP_CHANNELS.lock().unwrap();
        for tx in stop_channels.drain(..) {
            let _ = tx.send(());
        }
    }

    {
        let mut handles = THREAD_HANDLES.lock().unwrap();
        for handle in handles.drain(..) {
            if let Err(e) = handle.join() {
                error!("Failed to join serial thread: {:?}", e);
            }
        }
    }
    sleep(Duration::from_millis(100)); // explicitly drop each port to ensure proper cleanup
    {
        let mut ports = PORTS.lock().unwrap();
        info!("Closing and clearing {} ports", ports.len());

        for port in ports.drain(..) {
            if let Some(name) = port.name() {
                info!("Closing port: {}", name);
            }
            drop(port);
        }
    }

    // Clear tracker info
    {
        let mut tracker_info = TRACKER_INFO.lock().unwrap();
        tracker_info.clear();
        info!("Cleared tracker info");
    }

    info!("Stopped serial connection");
    Ok(())
}

pub async fn write(port_path: String, data: String) -> Result<(), String> {
    info!("Writing to port: {}", port_path);
    let mut ports = PORTS.lock().unwrap();
    for port in ports.iter_mut() {
        if let Some(name) = port.name() {
            if name == port_path {
                let data_bytes = data.as_bytes();
                port.write_all(data_bytes)
                    .map_err(|e| format!("Failed to write to port {}: {}", port_path, e))?;
                return Ok(());
            }
        }
    }
    Err(format!("Port {} not found", port_path))
}

pub async fn read(port_path: String) -> Result<String, String> {
    let mut ports = PORTS.lock().unwrap();
    for port in ports.iter_mut() {
        if let Some(name) = port.name() {
            if name == port_path {
                let mut buffer = [0u8; 1024];
                match port.read(&mut buffer) {
                    Ok(bytes_read) => {
                        if bytes_read > 0 {
                            return String::from_utf8(buffer[..bytes_read].to_vec())
                                .map_err(|e| format!("Failed to convert message to UTF-8: {}", e));
                        }
                    }
                    Err(e) => {
                        return Err(format!("Error reading from port: {}", e));
                    }
                }
            }
        }
    }
    Err(format!("Port {} not found or no data available", port_path))
}

pub fn get_tracker_id(tracker_name: &str) -> Result<String, String> {
    let tracker_info = TRACKER_INFO.lock().unwrap();
    if let Some(info) = tracker_info
        .iter()
        .find(|info| info.assignment == tracker_name)
    {
        Ok(info.port_id.clone())
    } else {
        Err(format!(
            "Tracker {} not found in tracker info",
            tracker_name
        ))
    }
}

pub fn get_tracker_port(tracker_name: &str) -> Result<String, String> {
    let tracker_info = TRACKER_INFO.lock().unwrap();
    if let Some(info) = tracker_info
        .iter()
        .find(|info| info.assignment == tracker_name)
    {
        Ok(info.port.clone())
    } else {
        Err(format!(
            "Tracker {} not found in tracker info",
            tracker_name
        ))
    }
}

fn get_tracker_type_from_model(model: &str) -> Option<TrackerModel> {
    match model.to_uppercase().as_str() {
        "MC1S" => Some(TrackerModel::Wired), // HaritoraX 1.0
        "MC2S" => Some(TrackerModel::Wired), // HaritoraX 1.1
        "MC2BS" => Some(TrackerModel::Wired), // HaritoraX 1.1B
        "MC3S" => Some(TrackerModel::Wireless), // HaritoraX Wireless
        "AF01SB" => Some(TrackerModel::X2), // HaritoraX 2
        _ => None,
    }
}
