use std::io::{self, Read};
use std::thread;
use std::sync::Mutex;
use lazy_static::lazy_static;
use serde::{Serialize, Deserialize};

lazy_static! {
    static ref LATEST_BROWSER_ACTIVITY: Mutex<Option<BrowserEvent>> = Mutex::new(None);
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BrowserEvent {
    pub domain: String,
    pub url: String,
    pub title: String,
    pub is_incognito: bool,
    pub tab_focus: bool,
    pub tab_change: bool,
    pub tab_duration_ms: u64,
    pub browser_name: String,
    pub window_focus: bool,
    pub timestamp: String,
}

pub fn get_latest_browser_activity() -> Option<BrowserEvent> {
    let opt = LATEST_BROWSER_ACTIVITY.lock().unwrap();
    opt.clone()
}

// Spawns a background worker reading Chrome/Firefox length-prefixed messaging packets from stdin
pub fn start_native_messaging_host() {
    thread::spawn(|| {
        let mut stdin = io::stdin();
        println!("[Browser Host] Native Messaging stdin reader thread spawned.");
        
        loop {
            let mut length_buf = [0u8; 4];
            if stdin.read_exact(&mut length_buf).is_err() {
                // Pipe closed
                break;
            }
            
            // Native Messaging protocol defines 32-bit Native Endian length prefixes
            let length = u32::from_ne_bytes(length_buf) as usize;
            if length == 0 {
                continue;
            }
            
            let mut payload_buf = vec![0u8; length];
            if stdin.read_exact(&mut payload_buf).is_err() {
                break;
            }
            
            if let Ok(json_str) = String::from_utf8(payload_buf) {
                if let Ok(event) = serde_json::from_str::<BrowserEvent>(&json_str) {
                    let mut latest = LATEST_BROWSER_ACTIVITY.lock().unwrap();
                    *latest = Some(event);
                }
            }
        }
    });
}
