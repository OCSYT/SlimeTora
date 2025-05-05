// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use log::{error, info};
use tauri_plugin_log::RotationStrategy;
use tauri_plugin_log::{Target, TargetKind};

mod connection {
    pub mod ble;
    pub mod serial;
    pub mod slimevr;
}
mod interpreters {
    pub mod common;
    pub mod core;
    pub mod haritorax_2;
    pub mod haritorax_wired;
    pub mod haritorax_wireless;
}
mod util;

use connection::ble;
use connection::serial;
use futures::future::{self};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use tauri_plugin_prevent_default::{Flags, WindowsOptions};
use tokio::task;

static DONGLES: Lazy<Vec<HashMap<&'static str, &'static str>>> = Lazy::new(|| {
    vec![
        HashMap::from([("name", "GX2"), ("vid", "1915"), ("pid", "520F")]),
        HashMap::from([("name", "GX6"), ("vid", "04DA"), ("pid", "3F18")]),
    ]
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    // grab identifier for path of log file
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let identifier = context.config().identifier.clone();

    let path = dirs::config_dir()
        .expect("Failed to find config dir")
        .join(identifier)
        .join("logs");

    let current_date = chrono::Local::now().format("%Y%m%d").to_string();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_prevent_default::Builder::new()
                .with_flags(Flags::all().difference(Flags::RELOAD | Flags::DEV_TOOLS))
                .platform(WindowsOptions {
                    // Whether general form information should be saved and autofilled.
                    general_autofill: false,
                    // Whether password information should be autosaved.
                    password_autosave: false,
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_btleplug::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal) // use local time instead of UTC
                .rotation_strategy(RotationStrategy::KeepAll)
                .max_file_size(8_000_000) // bytes - 8mb
                .format(|out, message, record| {
                    let source = if record.target().starts_with("webview") {
                        "Webview"
                    } else {
                        "Rust"
                    };
                    println!("{}", record.target().to_string());
                    out.finish(format_args!(
                        "{} [{}, {}]: {}",
                        chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                        source,
                        record.level(),
                        message
                    ))
                })
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Folder {
                        path,
                        file_name: Some("slimetora_".to_string() + &current_date),
                    }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .setup(|_app: &mut tauri::App| {
            #[cfg(mobile)]
            _app.btleplug()
                .request_permissions(tauri_plugin_btleplug::permission::RequestPermission {
                    bluetooth: true,
                    bluetooth_admin: true,
                    bluetooth_advertise: true,
                    bluetooth_connect: true,
                    bluetooth_scan: true,
                })
                .expect("error while requesting permissions");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // utilities
            get_serial_ports,
            filter_ports,
            // general commands
            open_logs_folder,
            // tracker commands
            start,
            stop,
            start_heartbeat,
            write_ble,
            read_ble,
            write_serial,
            read_serial,
            cleanup_connections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/*
 * General commands
*/

#[tauri::command]
fn open_logs_folder(app_handle: tauri::AppHandle) {
    let path_result = app_handle.path().app_data_dir();

    match path_result {
        Ok(dir) => {
            let logs_path = dir.join("logs");
            if let Err(e) = open::that(logs_path) {
                error!("Failed to open logs folder: {}", e);
            } else {
                info!("Opened logs folder");
            }
        }
        Err(e) => {
            error!("Failed to get app data directory: {}", e);
        }
    }
}

/*
 * Tracker management commands
 */

#[tauri::command]
async fn start(
    app_handle: AppHandle,
    model: String,
    modes: Vec<String>,
    ports: Vec<String>,
) -> Result<(), String> {
    info!("Starting connection with modes: {:?}", modes);

    crate::interpreters::core::start_interpreting(&model)?;

    let mut tasks = vec![];

    // Start connections based on modes
    if modes.contains(&"ble".to_string()) {
        let ble_task = task::spawn(async move { ble::start(app_handle.clone()).await });
        tasks.push(ble_task);
        info!("Starting BLE connection");
    } else if modes.contains(&"serial".to_string()) {
        if ports.is_empty() {
            return Err("No serial ports provided".to_string());
        }

        let serial_task =
            task::spawn(async move { serial::start(app_handle.clone(), ports).await });
        tasks.push(serial_task);
        info!("Starting serial connection");
    } else {
        return Err("No valid connection type provided".to_string());
    }

    for result in future::join_all(tasks).await {
        match result {
            Ok(inner_result) => inner_result.map_err(|e| {
                error!("Failed to start connection: {}", e);
                "Failed to start connection".to_string()
            })?,
            Err(join_error) => {
                error!("Task join error: {}", join_error);
                return Err("Failed to start connection".to_string());
            }
        }
    }

    info!("Started connection");
    Ok(())
}

#[tauri::command]
async fn stop(
    app_handle: AppHandle,
    models: Vec<String>,
    modes: Vec<String>,
) -> Result<(), String> {
    let mut tasks: Vec<task::JoinHandle<Result<(), String>>> = vec![];

    for m in models {
        crate::interpreters::core::stop_interpreting(&m)?;
    }

    connection::slimevr::clear_trackers().await;

    if modes.contains(&"ble".to_string()) {
        let ble_task = task::spawn(async move { ble::stop(app_handle.clone()).await });
        tasks.push(ble_task);
    } else if modes.contains(&"serial".to_string()) {
        let serial_task = task::spawn(async move { serial::stop().await });
        tasks.push(serial_task);
    } else {
        return Err("No valid connection type provided".to_string());
    }

    for result in future::join_all(tasks).await {
        match result {
            Ok(inner_result) => inner_result.map_err(|e| {
                error!("Failed to stop connection: {}", e);
                "Failed to stop connection".to_string()
            })?,
            Err(join_error) => {
                error!("Task join error: {}", join_error);
                return Err("Failed to stop connection".to_string());
            }
        }
    }

    info!("Stopped connection");
    Ok(())
}

#[tauri::command]
async fn start_heartbeat(app_handle: AppHandle) -> Result<(), String> {
    info!("Starting heartbeat tracker");

    connection::slimevr::start_heartbeat(&app_handle).await;
    Ok(())
}

#[tauri::command]
async fn write_ble(
    device_name: String,
    characteristic_uuid: String,
    data: Vec<u8>,
    expecting_response: bool,
) -> Result<Option<Vec<u8>>, String> {
    let response = ble::write(&device_name, &characteristic_uuid, data, expecting_response).await;

    match response {
        Ok(result) => {
            info!("Successfully wrote to BLE device");
            if expecting_response {
                info!("Received response from BLE device: {:?}", result);
                Ok(result)
            } else {
                Ok(None)
            }
        }
        Err(e) => {
            error!("Failed to write to BLE device: {}", e);
            Err("Failed to write to BLE device".to_string())
        }
    }
}

#[tauri::command]
async fn read_ble(device_name: String, characteristic_uuid: String) -> Result<Vec<u8>, String> {
    let response = ble::read(&device_name, &characteristic_uuid).await;

    match response {
        Ok(result) => {
            info!("Successfully read from BLE device");
            info!("Received data from BLE device: {:?}", result);
            Ok(result)
        }
        Err(e) => {
            error!("Failed to read from BLE device: {}", e);
            Err("Failed to read from BLE device".to_string())
        }
    }
}

#[tauri::command]
async fn write_serial(port_path: String, data: String) -> Result<(), String> {
    let response = serial::write(port_path, data).await;

    match response {
        Ok(_) => {
            info!("Successfully wrote to serial port");
            Ok(())
        }
        Err(e) => {
            error!("Failed to write to serial port: {}", e);
            Err("Failed to write to serial port".to_string())
        }
    }
}

#[tauri::command]
async fn read_serial(port_path: String) -> Result<String, String> {
    let response = serial::read(port_path).await;

    match response {
        Ok(result) => {
            info!("Successfully read from serial port");
            info!("Received data from serial port: {}", result);
            Ok(result)
        }
        Err(e) => {
            error!("Failed to read from serial port: {}", e);
            Err("Failed to read from serial port".to_string())
        }
    }
}

#[tauri::command]
fn get_serial_ports() -> Result<Vec<String>, String> {
    let ports = serialport::available_ports()
        .map_err(|e| format!("Failed to list serial ports: {}", e))?
        .into_iter()
        .filter_map(|port| port.port_name.into())
        .collect::<Vec<String>>();
    if ports.is_empty() {
        return Err("No serial ports available".to_string());
    }
    info!("Available serial ports: {:?}", ports);
    Ok(ports)
}

#[tauri::command]
fn filter_ports(ports: Vec<String>) -> Result<Vec<String>, String> {
    let filtered_ports: Vec<String> = ports
        .into_iter()
        .filter_map(|port| {
            let port_info = serialport::available_ports()
                .map_err(|e| format!("Failed to list serial ports: {}", e))
                .ok()?
                .into_iter()
                .find(|p| p.port_name == port)?;

            if let serialport::SerialPortType::UsbPort(usb_info) = port_info.port_type {
                if DONGLES.iter().any(|dongle| {
                    usb_info.vid == u16::from_str_radix(dongle["vid"], 16).unwrap()
                        && usb_info.pid == u16::from_str_radix(dongle["pid"], 16).unwrap()
                }) {
                    return Some(port);
                }
            }
            None
        })
        .collect();

    if filtered_ports.is_empty() {
        return Err("No Haritora ports found".to_string());
    }
    info!("Filtered Haritora ports: {:?}", filtered_ports);
    Ok(filtered_ports)
}

#[tauri::command]
async fn cleanup_connections() -> Result<(), String> {
    if let Err(e) = serial::stop().await {
        error!("Error stopping serial connections: {}", e);
    }

    connection::slimevr::clear_trackers().await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    info!("Cleaned up all connections");
    Ok(())
}
