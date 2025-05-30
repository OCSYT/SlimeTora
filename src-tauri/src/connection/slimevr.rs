use crate::interpreters::common::CONNECTED_TRACKERS;
use firmware_protocol::{
    ActionType, BoardType, ImuType, McuType, SensorDataType, SensorStatus, SlimeQuaternion,
};
use log::{error, info};
use tauri::AppHandle;
use tracker_emulation_rs::EmulatedTracker;

/*
 * Tracker management
*/

pub async fn start_heartbeat(app_handle: &AppHandle) {
    if !CONNECTED_TRACKERS.contains_key("(HEARTBEAT)") {
        add_tracker(app_handle, "(HEARTBEAT)", [0, 0, 0, 0, 0, 0])
            .await
            .expect("Failed to add heartbeat tracker");
    }

    // check if heartbeat is connected after we start a connection in the app, if not, warn user that it couldn't find slimevr server (at time of starting connection)
    // this would be ran as soon as app is open

    // TODO: figure out why tf pings/heartbeats arent being sent to and from server
    // likely a bug with slimevr server actually...
}

pub async fn add_tracker(
    app_handle: &AppHandle,
    tracker_name: &str,
    mac_address: [u8; 6],
) -> Result<(), String> {
    if CONNECTED_TRACKERS.contains_key(tracker_name) {
        return Err(format!("Tracker {} already exists", tracker_name));
    }

    // insert without EmulatedTracker so we know its already being initialized
    CONNECTED_TRACKERS.insert(tracker_name.to_string(), None);

    let version = &app_handle.package_info().version;
    let mut tracker = EmulatedTracker::new(
        mac_address,
        format!("SlimeTora {}", version.clone()),
        Some(BoardType::Haritora),
        Some(McuType::Haritora),
        Some("255.255.255.255".to_string()), // TODO: get this from the app settings
        Some(6969), // TODO: get this from the app settings
        Some(5000), // TODO: get this from the app settings
        Some(false), // TODO: get this from the app settings
    )
    .await
    .expect("Failed to create tracker");

    tracker
        .init()
        .await
        .map_err(|e| format!("Failed to initialize tracker: {}", e))?;

    // NOW insert the EmulatedTracker instance after it's been initialized
    CONNECTED_TRACKERS.insert(tracker_name.to_string(), Some(tracker));

    add_sensor(tracker_name)
        .await
        .expect("Failed to add sensor");

    // Set up status monitoring
    if let Some(tracker_option) = CONNECTED_TRACKERS.get(tracker_name) {
        if let Some(tracker) = tracker_option.value() {
            let mut status_rx = tracker.subscribe_status();
            tokio::spawn(async move {
                while status_rx.changed().await.is_ok() {
                    let status = status_rx.borrow().clone();
                    info!("Tracker status changed: {status}");

                    if status == "initialized" {
                        info!("Disconnected from server.");
                    }
                }
            });
        }
    }

    Ok(())
}

pub async fn add_sensor(tracker_name: &str) -> Result<(), String> {
    if CONNECTED_TRACKERS.contains_key(tracker_name) {
        let mut tracker_ref = CONNECTED_TRACKERS.get_mut(tracker_name).unwrap();
        let mut tracker = tracker_ref.take().unwrap();

        tracker
            .add_sensor(ImuType::Unknown(0), SensorStatus::Ok)
            .await
            .map_err(|e| e.to_string())?;

        *tracker_ref = Some(tracker);

        Ok(())
    } else {
        Err(format!("Tracker {tracker_name} not found"))
    }
}

pub async fn remove_tracker(tracker_name: &str) -> Result<(), String> {
    if !CONNECTED_TRACKERS.contains_key(tracker_name) {
        return Err(format!("Tracker {} not found", tracker_name));
    }

    if let Some(mut tracker_ref) = CONNECTED_TRACKERS.get_mut(tracker_name) {
        if let Some(mut tracker) = tracker_ref.take() {
            tracker
                .deinit()
                .await
                .expect("Failed to deinitialize tracker");
        }
    }

    CONNECTED_TRACKERS.remove(tracker_name);
    info!("Removed tracker: {}", tracker_name);
    Ok(())
}

pub async fn clear_trackers() {
    for tracker_ref in CONNECTED_TRACKERS.iter() {
        let tracker_name = tracker_ref.key();
        if let Err(e) = remove_tracker(tracker_name).await {
            error!("Failed to remove tracker {}: {}", tracker_name, e);
        }
    }

    CONNECTED_TRACKERS.clear();
    info!("Cleared all trackers");
}

/*
 * Tracking data management
*/

pub async fn send_rotation(
    tracker_name: &str,
    sensor_id: u8,
    rotation: [f32; 4],
) -> Result<(), String> {
    if let Some(tracker_ref) = CONNECTED_TRACKERS.get(tracker_name) {
        if let Some(tracker) = tracker_ref.value() {
            // Normalize the quaternion
            let magnitude = (rotation[0] * rotation[0]
                + rotation[1] * rotation[1]
                + rotation[2] * rotation[2]
                + rotation[3] * rotation[3])
                .sqrt();
            let i = rotation[0] / magnitude;
            let j = rotation[1] / magnitude;
            let k = rotation[2] / magnitude;
            let w = rotation[3] / magnitude;

            let quaternion = SlimeQuaternion { i, j, k, w };

            tracker
                .send_rotation(sensor_id, SensorDataType::Normal, quaternion, 1)
                .await
                .map_err(|e| e.to_string())?;

            Ok(())
        } else {
            Err(format!("Tracker {} has no value", tracker_name))
        }
    } else {
        Err(format!("Tracker {} not found", tracker_name))
    }
}

pub async fn send_accel(
    tracker_name: &str,
    sensor_id: u8,
    acceleration: [f32; 3],
) -> Result<(), String> {
    if let Some(tracker_ref) = CONNECTED_TRACKERS.get(tracker_name) {
        if let Some(tracker) = tracker_ref.value() {
            tracker
                .send_acceleration(sensor_id, acceleration.into())
                .await
                .map_err(|e| e.to_string())?;

            Ok(())
        } else {
            Err(format!("Tracker {} has no value", tracker_name))
        }
    } else {
        Err(format!("Tracker {} not found", tracker_name))
    }
}

pub async fn send_battery(tracker_name: &str, percentage: f32, voltage: f32) -> Result<(), String> {
    if let Some(tracker_ref) = CONNECTED_TRACKERS.get(tracker_name) {
        if let Some(tracker) = tracker_ref.value() {
            tracker
                .send_battery_level(percentage, voltage)
                .await
                .map_err(|e| e.to_string())?;

            Ok(())
        } else {
            Err(format!("Tracker {} has no value", tracker_name))
        }
    } else {
        Err(format!("Tracker {} not found", tracker_name))
    }
}

pub async fn send_user_action(tracker_name: &str, action: ActionType) -> Result<(), String> {
    if let Some(tracker_ref) = CONNECTED_TRACKERS.get(tracker_name) {
        if let Some(tracker) = tracker_ref.value() {
            tracker
                .send_user_action(action)
                .await
                .map_err(|e| e.to_string())?;

            Ok(())
        } else {
            Err(format!("Tracker {} has no value", tracker_name))
        }
    } else {
        Err(format!("Tracker {} not found", tracker_name))
    }
}
