// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod util;

#[tauri::command]
fn start() {
    util::log("Started connection");
}

#[tauri::command]
fn stop() {
    util::log("Stopped connection");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_prevent_default::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_serialplugin::init())
        .plugin(tauri_plugin_blec::init())
        .invoke_handler(tauri::generate_handler![start, stop])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
