use std::sync::atomic::{AtomicBool, Ordering};
use lazy_static::lazy_static;
use serde::{Serialize, Deserialize};

lazy_static! {
    static ref SYSTEM_LOCKED: AtomicBool = AtomicBool::new(false);
    static ref SYSTEM_ASLEEP: AtomicBool = AtomicBool::new(false);
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PowerStatusSnapshot {
    pub is_locked: bool,
    pub is_asleep: bool,
}

// Check current lock and sleep state flags
pub fn fetch_power_status() -> PowerStatusSnapshot {
    PowerStatusSnapshot {
        is_locked: SYSTEM_LOCKED.load(Ordering::SeqCst),
        is_asleep: SYSTEM_ASLEEP.load(Ordering::SeqCst),
    }
}

// Tauri helper windproc wrapper to simulate or catch native alerts
pub fn update_power_state(event_type: &str) {
    match event_type {
        "lock" => {
            SYSTEM_LOCKED.store(true, Ordering::SeqCst);
            println!("[Power Service] Workstation Session LOCKED.");
        }
        "unlock" => {
            SYSTEM_LOCKED.store(false, Ordering::SeqCst);
            println!("[Power Service] Workstation Session UNLOCKED.");
        }
        "sleep" => {
            SYSTEM_ASLEEP.store(true, Ordering::SeqCst);
            println!("[Power Service] System entered SLEEP mode.");
        }
        "wake" => {
            SYSTEM_ASLEEP.store(false, Ordering::SeqCst);
            println!("[Power Service] System RESUMED / WOKE up.");
        }
        _ => {}
    }
}
