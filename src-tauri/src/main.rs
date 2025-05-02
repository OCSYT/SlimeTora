// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
use tauri::AppHandle;
use tauri_plugin_prevent_default::Flags;
use tokio::task;

static DONGLES: Lazy<Vec<HashMap<&'static str, &'static str>>> = Lazy::new(|| {
    vec![
        HashMap::from([("name", "GX2"), ("vid", "1915"), ("pid", "520F")]),
        HashMap::from([("name", "GX6"), ("vid", "04DA"), ("pid", "3F18")]),
    ]
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_prevent_default::Builder::new()
                .with_flags(Flags::all().difference(Flags::RELOAD))
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_btleplug::init())
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
            // commands
            start,
            stop,
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
 * Tauri commands
 */

#[tauri::command]
async fn start(
    app_handle: AppHandle,
    model: String,
    modes: Vec<String>,
    ports: Vec<String>,
) -> Result<(), String> {
    log!("Starting connection with modes: {:?}", modes);

    crate::interpreters::core::start_interpreting(&model)?;

    let mut tasks = vec![];

    // Start connections based on modes
    if modes.contains(&"ble".to_string()) {
        let ble_task = task::spawn(async move { ble::start(app_handle.clone()).await });
        tasks.push(ble_task);
        log!("Starting BLE connection");
    } else if modes.contains(&"serial".to_string()) {
        if ports.is_empty() {
            return Err("No serial ports provided".to_string());
        }

        let serial_task =
            task::spawn(async move { serial::start(app_handle.clone(), ports).await });
        tasks.push(serial_task);
        log!("Starting serial connection");
    } else {
        return Err("No valid connection type provided".to_string());
    }

    for result in future::join_all(tasks).await {
        match result {
            Ok(inner_result) => inner_result.map_err(|e| {
                log!("Failed to start connection: {}", e);
                "Failed to start connection".to_string()
            })?,
            Err(join_error) => {
                log!("Task join error: {}", join_error);
                return Err("Failed to start connection".to_string());
            }
        }
    }

    log!("Started connection");
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
                log!("Failed to stop connection: {}", e);
                "Failed to stop connection".to_string()
            })?,
            Err(join_error) => {
                log!("Task join error: {}", join_error);
                return Err("Failed to stop connection".to_string());
            }
        }
    }

    log!("Stopped connection");
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
            log!("Successfully wrote to BLE device");
            if expecting_response {
                log!("Received response from BLE device: {:?}", result);
                Ok(result)
            } else {
                Ok(None)
            }
        }
        Err(e) => {
            log!("Failed to write to BLE device: {}", e);
            Err("Failed to write to BLE device".to_string())
        }
    }
}

#[tauri::command]
async fn read_ble(device_name: String, characteristic_uuid: String) -> Result<Vec<u8>, String> {
    let response = ble::read(&device_name, &characteristic_uuid).await;

    match response {
        Ok(result) => {
            log!("Successfully read from BLE device");
            log!("Received data from BLE device: {:?}", result);
            Ok(result)
        }
        Err(e) => {
            log!("Failed to read from BLE device: {}", e);
            Err("Failed to read from BLE device".to_string())
        }
    }
}

#[tauri::command]
async fn write_serial(port_path: String, data: String) -> Result<(), String> {
    let response = serial::write(port_path, data).await;

    match response {
        Ok(_) => {
            log!("Successfully wrote to serial port");
            Ok(())
        }
        Err(e) => {
            log!("Failed to write to serial port: {}", e);
            Err("Failed to write to serial port".to_string())
        }
    }
}

#[tauri::command]
async fn read_serial(port_path: String) -> Result<String, String> {
    let response = serial::read(port_path).await;

    match response {
        Ok(result) => {
            log!("Successfully read from serial port");
            log!("Received data from serial port: {}", result);
            Ok(result)
        }
        Err(e) => {
            log!("Failed to read from serial port: {}", e);
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
    log!("Available serial ports: {:?}", ports);
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
    log!("Filtered Haritora ports: {:?}", filtered_ports);
    Ok(filtered_ports)
}

#[tauri::command]
async fn cleanup_connections() -> Result<(), String> {
    if let Err(e) = serial::stop().await {
        log!("Error stopping serial connections: {}", e);
    }

    connection::slimevr::clear_trackers().await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    log!("Cleaned up all connections");
    Ok(())
}
