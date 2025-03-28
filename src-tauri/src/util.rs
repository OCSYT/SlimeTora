use std::io::{self, Write};

pub fn log(message: &str) {
    let formatted_message = format!("[rust] {}", message);
    if let Err(e) = writeln!(io::stdout(), "{}", formatted_message) {
        eprintln!("Failed to write log message: {}", e);
    }
}