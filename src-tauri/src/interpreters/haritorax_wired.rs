use crate::interpreters::core::Interpreter;
use async_trait::async_trait;
use tauri::AppHandle;

pub struct HaritoraXWired;

#[async_trait]
impl Interpreter for HaritoraXWired {
    async fn parse_ble(
        &self,
        app_handle: &AppHandle,
        device_id: &str,
        char_name: &str,
        data: &str,
    ) -> Result<(), String> {
        // Implement BLE parsing logic for HaritoraX Wired
        Ok(())
    }

    async fn parse_serial(
        &self,
        app_handle: &AppHandle,
        tracker_name: &str,
        data: &str,
    ) -> Result<(), String> {
        // Implement serial parsing logic for Haritora X Wired
        Ok(())
    }
}
