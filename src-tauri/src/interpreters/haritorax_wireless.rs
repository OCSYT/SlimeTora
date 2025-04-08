use crate::{interpreters::core::Interpreter, util::log};
use tauri::AppHandle;

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

    fn parse_serial(app_handle: &AppHandle, device_id: Option<&str>, data: &str) -> Result<(), String> {
        // Implement serial parsing logic for HaritoraX Wireless

        let (identifier, data) = data.split_once(':').unwrap_or(("", ""));

        log(&format!("Device: {:?}, identifier: {}, data: {}", device_id, identifier, data));

        Ok(())
    }
}