use log::warn;
use uuid::Uuid;

/// normalizes a uuid string to the standard format
pub fn normalize_uuid(input: &str) -> Result<Uuid, uuid::Error> {
    if input.contains('-') {
        match Uuid::parse_str(input) {
            Ok(uuid) => Ok(uuid),
            Err(e) => {
                warn!("Failed to parse UUID with dashes: `${input}`: {e}");
                Err(e)
            }
        }
    } else if input.len() == 4 && input.chars().all(|c| c.is_ascii_hexdigit()) {
        let formatted = format!("0000{}-0000-1000-8000-00805f9b34fb", input);
        match Uuid::parse_str(&formatted) {
            Ok(uuid) => Ok(uuid),
            Err(e) => {
                warn!("Failed to parse 4-char Bluetooth UUID `${input}` as `${formatted}`: {e}");
                Err(e)
            }
        }
    } else {
        match Uuid::parse_str(input) {
            Ok(uuid) => Ok(uuid),
            Err(e) => {
                warn!("Failed to parse UUID without dashes: `${input}`: {e}");
                Err(e)
            }
        }
    }
}
