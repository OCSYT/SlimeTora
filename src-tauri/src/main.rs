// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use log::{error, info};
use tauri::path::BaseDirectory;
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

use crate::connection::ble::TrackerDevice;

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

    let logs_path = dirs::config_dir()
        .expect("Failed to find config dir")
        .join(&identifier)
        .join("logs");
    let langs_path = dirs::config_dir()
        .expect("Failed to find config dir")
        .join(&identifier)
        .join("langs");

    let current_date = chrono::Local::now().format("%Y%m%d").to_string();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_blec::init())
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
        .plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal) // use local time instead of UTC
                .rotation_strategy(RotationStrategy::KeepAll)
                .max_file_size(8_000_000) // bytes - 8mb
                .level(log::LevelFilter::Info)
                .level_for("slimetora", log::LevelFilter::Trace)
                .format(|out, message, record| {
                    let source = if record.target().starts_with("webview") {
                        "Webview"
                    } else {
                        "Rust"
                    };
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
                        path: logs_path,
                        file_name: Some("slimetora_".to_string() + &current_date),
                    }),
                ])
                .build(),
        )
        .setup(move |app: &mut tauri::App| {
            // only copy language files if the langs_path directory does not exist
            if !langs_path.exists() {
                let resource_path = app
                    .path()
                    .resolve("resources/lang/", BaseDirectory::Resource)?;

                // for every language in folder, copy to lang/ in langs_path
                if let Ok(entries) = std::fs::read_dir(&resource_path) {
                    info!("Copying language files to {}", langs_path.display());
                    // Ensure the langs_path directory exists before copying
                    if let Err(e) = std::fs::create_dir_all(&langs_path) {
                        error!("Failed to create langs directory: {}", e);
                    }
                    for entry in entries.flatten() {
                        println!("Processing entry: {}", entry.path().display());
                        if let Some(file_name) = entry.file_name().to_str() {
                            let lang_path = langs_path.join(file_name);
                            if !lang_path.exists() {
                                std::fs::copy(entry.path(), lang_path).expect(&format!(
                                    "Failed to copy language file: {}",
                                    file_name
                                ));
                                info!("Copied language file: {}", file_name);
                            }
                        }
                    }
                } else {
                    error!("Failed to read resource path for languages");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // utilities
            get_serial_ports,
            filter_ports,
            // general commands
            open_logs_folder,
            // tracker commands
            start_connection,
            stop_connection,
            cleanup_connections,
            start_heartbeat,
            // ble commands
            start_ble_scanning,
            stop_ble_scanning,
            stop_ble_connections,
            disconnect_device,
            write_ble,
            read_ble,
            // serial commands
            write_serial,
            read_serial,
            get_tracker_id,
            get_tracker_port,
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
async fn start_connection(
    app_handle: AppHandle,
    model: String,
    modes: Vec<String>,
    ports: Option<Vec<String>>,
    mac_addresses: Option<Vec<String>>,
) -> Result<(), String> {
    // TODO: maybe we want to merge ports and mac_addesses into one "identifiers"?
    if ports.as_ref().map_or(true, |p| p.is_empty())
        && mac_addresses.as_ref().map_or(true, |m| m.is_empty())
    {
        return Err("No device identifiers (MAC addresses/serial ports) provided".to_string());
    }

    if !modes.contains(&"ble".to_string()) && !modes.contains(&"serial".to_string()) {
        return Err("No valid connection type provided".to_string());
    }

    info!(
        "Starting connection with modes: {:?}, ports: {:?}, mac_addresses: {:?}",
        modes, ports, mac_addresses
    );

    crate::interpreters::core::start_interpreting(&model)?;

    let mut tasks: Vec<task::JoinHandle<Result<(), String>>> = vec![];

    let app_handle_ble = app_handle.clone();
    let app_handle_serial = app_handle.clone();

    // BLE
    if modes.contains(&"ble".to_string()) {
        if let Some(mac_addresses) = mac_addresses.clone() {
            if !mac_addresses.is_empty() {
                let ble_task = task::spawn(async move {
                    ble::start_connections(app_handle_ble, mac_addresses)
                        .await
                        .map_err(|e| {
                            error!("Failed to start BLE connections: {}", e);
                            "Failed to start BLE connections".to_string()
                        })
                });
                tasks.push(ble_task);
                info!("Starting BLE connection");
            } else {
                error!("No MAC addresses provided for BLE mode");
            }
        } else {
            error!("No MAC addresses provided for BLE mode");
        }
    }

    // Serial
    if modes.contains(&"serial".to_string()) {
        if let Some(ports) = ports.clone() {
            if !ports.is_empty() {
                let serial_task =
                    task::spawn(async move { serial::start(app_handle_serial, ports).await });
                tasks.push(serial_task);
                info!("Starting serial connection");
            } else {
                error!("No ports provided for serial mode");
            }
        } else {
            error!("No ports provided for serial mode");
        }
    }

    if tasks.is_empty() {
        return Err("No valid device identifiers provided for the selected modes".to_string());
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
async fn stop_connection(
    _app_handle: AppHandle,
    models: Vec<String>,
    modes: Vec<String>,
) -> Result<(), String> {
    let mut tasks: Vec<task::JoinHandle<Result<(), String>>> = vec![];

    // stop connections
    if modes.contains(&"serial".to_string()) {
        let serial_task = task::spawn(async move { serial::stop().await });
        tasks.push(serial_task);
        info!("Stopping serial connections");
    }

    if modes.contains(&"ble".to_string()) {
        let ble_task = task::spawn(async move {
            if let Err(e) = ble::stop_scanning().await {
                error!("Failed to stop BLE scanning: {}", e);
            }
            ble::stop_connections().await
        });
        tasks.push(ble_task);
        info!("Stopping BLE connections");
    }

    info!("Stopping all connections");
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

    // stop interpreting data
    for m in models {
        crate::interpreters::core::stop_interpreting(&m)?;
        info!("Stopping interpreter for model: {}", m);
    }

    // clear tasks and trackers
    connection::slimevr::cancel_all_tasks().await;
    connection::slimevr::clear_trackers().await;

    info!("Stopped connection");
    Ok(())
}

#[tauri::command]
async fn start_heartbeat(app_handle: AppHandle) -> Result<(), String> {
    info!("Starting heartbeat tracker");

    connection::slimevr::start_heartbeat(&app_handle).await;
    Ok(())
}

/*
 * BLE commands
 */

#[tauri::command]
async fn start_ble_scanning(app_handle: AppHandle) -> Result<Vec<TrackerDevice>, String> {
    match ble::start_scanning(app_handle, None).await {
        Ok(devices) => Ok(devices),
        Err(e) => {
            error!("Failed to start BLE scanning: {}", e);
            Err(format!("Failed to start BLE scanning: {}", e))
        }
    }
}

#[tauri::command]
async fn stop_ble_scanning() -> Result<(), String> {
    match ble::stop_scanning().await {
        Ok(_) => {
            info!("Successfully stopped BLE scanning");
            Ok(())
        }
        Err(e) => {
            error!("Failed to stop BLE scanning: {}", e);
            Err(format!("Failed to stop BLE scanning: {}", e))
        }
    }
}

#[tauri::command]
async fn stop_ble_connections() -> Result<(), String> {
    info!("Stopping all BLE connections");

    match ble::stop_connections().await {
        Ok(_) => {
            info!("Successfully stopped all BLE connections");
            Ok(())
        }
        Err(e) => {
            error!("Failed to stop BLE connections: {}", e);
            Err(format!("Failed to stop BLE connections: {}", e))
        }
    }
}

#[tauri::command]
async fn disconnect_device(mac_address: String) -> Result<(), String> {
    info!("Disconnecting BLE device with MAC address: {}", mac_address);

    match ble::disconnect_device(&mac_address).await {
        Ok(_) => {
            info!("Successfully disconnected device: {}", mac_address);
            Ok(())
        }
        Err(e) => {
            error!("Failed to disconnect device {}: {}", mac_address, e);
            Err(format!("Failed to disconnect device: {}", e))
        }
    }
}

#[tauri::command]
async fn write_ble(
    mac_address: String,
    characteristic_uuid: String,
    data: Vec<u8>,
    expecting_response: bool,
) -> Result<Option<Vec<u8>>, String> {
    let response = ble::write(&mac_address, &characteristic_uuid, data, expecting_response).await;

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
async fn read_ble(mac_address: String, characteristic_uuid: String) -> Result<Vec<u8>, String> {
    let response = ble::read(&mac_address, &characteristic_uuid).await;

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

/*
 * Serial commands
 */

#[tauri::command]
async fn write_serial(port_path: String, data: String) -> Result<(), String> {
    let port_path_clone = port_path.clone();
    let data_clone = data.clone();
    let response = serial::write(port_path, format!("\n{}\n", data_clone)).await;

    match response {
        Ok(_) => {
            info!("Successfully wrote to serial port {} with data: {}", port_path_clone, data_clone);
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
    let port_path_clone = port_path.clone();
    let response = serial::read(port_path).await;

    match response {
        Ok(result) => {
            info!("Successfully read from serial port {}", port_path_clone);
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
    Ok(filtered_ports)
}

#[tauri::command]
fn get_tracker_id(tracker_name: String) -> Result<String, String> {
    serial::get_tracker_id(&tracker_name)
}

#[tauri::command]
fn get_tracker_port(tracker_name: String) -> Result<String, String> {
    serial::get_tracker_port(&tracker_name)
}

#[tauri::command]
async fn cleanup_connections() -> Result<(), String> {
    if let Err(e) = serial::stop().await {
        error!("Error stopping serial connections: {}", e);
    }

    if let Err(e) = ble::stop_scanning().await {
        error!("Error stopping BLE scanning: {}", e);
    }

    if let Err(e) = ble::stop_connections().await {
        error!("Error stopping BLE connections: {}", e);
    }

    // cancel all tasks and clear trackers
    connection::slimevr::cancel_all_tasks().await;
    connection::slimevr::clear_trackers().await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    info!("Cleaned up all connections");
    Ok(())
}
