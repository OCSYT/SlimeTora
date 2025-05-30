use once_cell::sync::Lazy;
use serialport::SerialPort;
use std::{
    collections::HashMap,
    io::ErrorKind,
    sync::Mutex,
    thread::{self, sleep},
    time::Duration,
};

use log::{error, info, warn};

static PORTS: Mutex<Vec<Box<dyn SerialPort + Send>>> = Mutex::new(Vec::new());

static STOP_CHANNELS: Lazy<Mutex<Vec<std::sync::mpsc::Sender<()>>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

// tracker part, [tracker id, port, port id]
// update: i think i was thinking too much about trying to make it like the TS version, i should probably make this more efficient
static TRACKER_ASSIGNMENT: Lazy<Mutex<HashMap<&'static str, [String; 3]>>> = Lazy::new(|| {
    let entries = [
        ("DONGLE", "0"),
        ("chest", "1"),
        ("leftKnee", "2"),
        ("leftAnkle", "3"),
        ("rightKnee", "4"),
        ("rightAnkle", "5"),
        ("hip", "6"),
        ("leftElbow", "7"),
        ("rightElbow", "8"),
        ("leftWrist", "9"),
        ("rightWrist", "a"),
        ("head", "b"),
        ("leftFoot", "c"),
        ("rightFoot", "d"),
    ];

    let map = entries
        .into_iter()
        .map(|(key, id)| (key, [id.to_string(), "".to_string(), "".to_string()]))
        .collect();

    Mutex::new(map)
});

pub async fn start(app_handle: tauri::AppHandle, port_paths: Vec<String>) -> Result<(), String> {
    info!("Starting serial connection on ports {:?}", &port_paths);

    let mut ports = PORTS.lock().unwrap();
    for port_path in &port_paths {
        let port = serialport::new(port_path, 500000)
            .timeout(Duration::from_secs(2))
            .open()
            .map_err(|e| format!("Failed to open port {}: {}", port_path, e))?;
        ports.push(port);
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
        thread::spawn(move || {
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
                            accumulator.extend_from_slice(&buffer[..bytes_read]);

                            // process complete messages
                            while let Some(delimiter_index) =
                                accumulator.iter().position(|&b| b == b'\n')
                            {
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
                                        // try to find find tracker name via assignments map
                                        let mut tracker_name = None;
                                        {
                                            let tracker_assignment_ref =
                                                TRACKER_ASSIGNMENT.lock().unwrap();
                                            for (key, value) in tracker_assignment_ref.iter() {
                                                if value[1] == port_path && value[2] == port_id {
                                                    tracker_name = Some(*key);
                                                    break;
                                                }
                                            }
                                        }

                                        // silently listen and see if we can assign any missing trackers
                                        if identifier.starts_with('r') {
                                            let mut tracker_assignment =
                                                TRACKER_ASSIGNMENT.lock().unwrap();
                                            for (key, value) in tracker_assignment.iter_mut() {
                                                if value[1].is_empty() {
                                                    if let Some(tracker_id_char) =
                                                        port_data.chars().nth(4)
                                                    {
                                                        if let Ok(tracker_id) = tracker_id_char
                                                            .to_string()
                                                            .parse::<i32>()
                                                        {
                                                            if value[0].parse::<i32>().unwrap_or(0)
                                                                == tracker_id
                                                                && tracker_id != 0
                                                            {
                                                                value[1] = port_path.clone();
                                                                value[2] = port_id.clone();
                                                                info!("Setting {} to port {} with port ID {}", key, port_path, port_id);

                                                                tracker_name = Some(*key);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Call the interpreter
                                        let result = crate::interpreters::core::process_serial(
                                            &app_handle_clone,
                                            tracker_name.unwrap_or(""),
                                            &message,
                                        ).await;
                                        if let Err(e) = result {
                                            error!(
                                                "Failed to parse serial data: {}",
                                                e
                                            );
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
    }

    Ok(())
}

pub async fn stop() -> Result<(), String> {
    {
        let mut stop_channels = STOP_CHANNELS.lock().unwrap();
        for tx in stop_channels.drain(..) {
            let _ = tx.send(());
        }
    }

    sleep(Duration::from_millis(100));

    let mut ports = PORTS.lock().unwrap();
    info!("Clearing {} ports", ports.len());
    ports.clear();

    info!("Stopped serial connection");
    Ok(())
}

pub async fn write(port_path: String, data: String) -> Result<(), String> {
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
