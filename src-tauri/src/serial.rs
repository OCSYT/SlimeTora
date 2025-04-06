use std::sync::Mutex;
use once_cell::sync::Lazy;
use tokio::sync::broadcast;

use serialport::SerialPort;

use crate::util::log;

static PORTS: Mutex<Vec<Box<dyn SerialPort + Send>>> = Mutex::new(Vec::new());

static CLOSE_SIGNAL: Lazy<broadcast::Sender<()>> = Lazy::new(|| {
    let (tx, _) = broadcast::channel(1);
    tx
});

static STOP_CHANNELS: Lazy<Mutex<Vec<std::sync::mpsc::Sender<()>>>> = Lazy::new(|| {
    Mutex::new(Vec::new())
});

pub async fn start(port_paths: Vec<String>) -> Result<(), String> {
    log(&format!(
        "Starting serial connection on ports {:?}",
        &port_paths
    ));

    let mut ports = PORTS.lock().unwrap();
    for port_path in &port_paths {
        let port = serialport::new(port_path, 500000)
            .timeout(std::time::Duration::from_secs(2))
            .open()
            .map_err(|e| format!("Failed to open port {}: {}", port_path, e))?;
        ports.push(port);
    }

    log(&format!("Opened ports: {:?}", &port_paths));

    // listen to ports
    for port in ports.iter_mut() {
        let mut buffer = [0u8; 1024];
        let mut port_clone = port
            .try_clone()
            .map_err(|e| format!("Failed to clone port: {}", e))?;
        
        // channel for stop signals
        let (stop_tx, stop_rx) = std::sync::mpsc::channel();
        STOP_CHANNELS.lock().unwrap().push(stop_tx);
        
        std::thread::spawn(move || {
            let mut accumulator = Vec::new();
            
            loop {
                if stop_rx.try_recv().is_ok() {
                    break;
                }
                
                match port_clone.read(&mut buffer) {
                    Ok(bytes_read) => {
                        if bytes_read > 0 {
                            accumulator.extend_from_slice(&buffer[..bytes_read]);
                            
                            // Process complete messages
                            while let Some(delimiter_index) = accumulator.iter().position(|&b| b == b'\n') {
                                let message_bytes = accumulator.drain(..delimiter_index).collect::<Vec<u8>>();
                                accumulator.remove(0);
                                
                                match String::from_utf8(message_bytes) {
                                    Ok(message) => {
                                        log(&format!("Received message: {}", message));
                                    }
                                    Err(e) => log(&format!("Failed to convert message to UTF-8: {}", e))
                                }
                            }
                        }
                    }
                    Err(e) => {
                        if e.kind() == std::io::ErrorKind::TimedOut {
                            continue;
                        } else {
                            log(&format!("Error reading from port: {}", e));
                            break;
                        }
                    }
                }
            }
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
    
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    let mut ports = PORTS.lock().unwrap();
    log(&format!("Clearing {} ports", ports.len()));
    ports.clear();
    
    log("Stopped serial connection");
    Ok(())
}