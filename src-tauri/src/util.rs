#[macro_export]
macro_rules! log {
    ($($arg:tt)*) => {{
        let formatted_message = format!("[rust] {}", format!($($arg)*));
        if let Err(e) = std::io::Write::write_fmt(&mut std::io::stdout(), format_args!("{}\n", formatted_message)) {
            eprintln!("Failed to write log message: {}", e);
        }
        ()
    }};
}
