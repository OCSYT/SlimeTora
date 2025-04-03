use crate::util::log;

pub fn start(app_handle: tauri::AppHandle) -> impl std::future::Future<Output = ()> {
    log("Started serial connection");
    async {
    }
}