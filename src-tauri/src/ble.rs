use crate::util::log;
use futures::stream::StreamExt;
use tauri_plugin_btleplug::{
    btleplug::{
        api::{bleuuid::BleUuid, Central, CentralEvent, Manager as _, Peripheral, ScanFilter},
        platform::Manager,
    },
    BtleplugExt,
};

pub async fn start(app_handle: tauri::AppHandle) {
    log("Started BLE connection");
    let _ = app_handle
        .btleplug()
        .btleplug_context_spawn(async move {
            let manager = Manager::new().await.map_err(|e| e.to_string())?;
            let adapters = manager.adapters().await.map_err(|e| e.to_string())?;
            if adapters.is_empty() {
                return Err("No Bluetooth adapters found".to_string());
            }
            log(&format!("Found {} Bluetooth adapters", adapters.len()));

            let central = adapters.into_iter().nth(0).unwrap();
            let central_state = central.adapter_state().await.map_err(|e| e.to_string())?;
            println!("Central state: {:?}", central_state);

            let mut events = central.events().await.map_err(|e| e.to_string())?;

            let _ = central
                .start_scan(ScanFilter::default())
                .await
                .map_err(|e| e.to_string())?;

            while let Some(event) = events.next().await {
                match event {
                    CentralEvent::DeviceDiscovered(device) => {
                        let peripheral = central
                            .peripheral(&device)
                            .await
                            .map_err(|e| e.to_string())?;
                        let properties = peripheral
                            .properties()
                            .await
                            .map_err(|e| e.to_string())
                            .clone()?;
                        peripheral.is_connected().await.map_err(|e| e.to_string())?;

                        let name = properties.as_ref().and_then(|p| p.local_name.clone());
                        if let Some(name) = name {
                            // TODO: pass to a function that checks name, and if it matches, connect to the device
                            println!("Device discovered: {:?}", name);
                        }
                    }
                    CentralEvent::DeviceUpdated(id) => {
                        println!("DeviceUpdated: {:?}", id);
                        let peripheral =
                            central.peripheral(&id).await.map_err(|e| e.to_string())?;
                        let properties = peripheral
                            .properties()
                            .await
                            .map_err(|e| e.to_string())
                            .clone()?;
                        let name = properties.as_ref().and_then(|p| p.local_name.clone());
                        if let Some(name) = name {
                            // TODO: pass to a function that checks name, and if it matches, connect to the device
                            println!("Device updated: {:?}", name);
                        }
                    }
                    CentralEvent::StateUpdate(state) => {
                        println!("AdapterStatusUpdate {:?}", state);
                    }
                    CentralEvent::DeviceConnected(id) => {
                        println!("DeviceConnected: {:?}", id);
                    }
                    CentralEvent::DeviceDisconnected(id) => {
                        println!("DeviceDisconnected: {:?}", id);
                    }
                    CentralEvent::ManufacturerDataAdvertisement {
                        id,
                        manufacturer_data,
                    } => {
                        println!(
                            "ManufacturerDataAdvertisement: {:?}, {:?}",
                            id, manufacturer_data
                        );
                    }
                    CentralEvent::ServiceDataAdvertisement { id, service_data } => {
                        println!("ServiceDataAdvertisement: {:?}, {:?}", id, service_data);
                    }
                    CentralEvent::ServicesAdvertisement { id, services } => {
                        let services: Vec<String> =
                            services.into_iter().map(|s| s.to_short_string()).collect();
                        println!("ServicesAdvertisement: {:?}, {:?}", id, services);
                    }
                    _ => {}
                }
            }
            Ok(())
        })
        .await
        .expect("error during btleplug task");
}
