#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod hooks;
mod tracker;
mod power;
mod browser_host;
mod security;

use serde::{Serialize, Deserialize};
use sysinfo::{System, SystemExt, CpuExt};
use std::sync::Mutex;
use std::path::PathBuf;
use lazy_static::lazy_static;

lazy_static! {
    static ref SYS_INFO: Mutex<System> = Mutex::new(System::new_all());
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TelemetryPayload {
    pub keyboard_clicks: usize,
    pub mouse_clicks: usize,
    pub mouse_moved: bool,
    pub active_window: Option<tracker::WindowSnapshot>,
    pub active_browser_tab: Option<browser_host::BrowserEvent>,
    pub monitors: Vec<tracker::MonitorMetadata>,
    pub power_status: power::PowerStatusSnapshot,
    pub cpu_usage_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
}

// Command: Fetch complete hardware and input activity telemetry snapshot
#[tauri::command]
fn get_native_telemetry() -> TelemetryPayload {
    let (keyboard_clicks, mouse_clicks, mouse_moved) = hooks::fetch_and_reset_activity();
    let active_window = tracker::get_active_window();
    let active_browser_tab = browser_host::get_latest_browser_activity();
    let monitors = tracker::detect_monitors();
    let power_status = power::fetch_power_status();

    let mut sys = SYS_INFO.lock().unwrap();
    sys.refresh_all();
    
    let cpus = sys.cpus();
    let cpu_sum: f32 = cpus.iter().map(|cpu| cpu.cpu_usage()).sum();
    let cpu_usage_percent = if !cpus.is_empty() { cpu_sum / cpus.len() as f32 } else { 0.0 };

    let memory_used_mb = sys.used_memory() / 1024 / 1024;
    let memory_total_mb = sys.total_memory() / 1024 / 1024;

    TelemetryPayload {
        keyboard_clicks,
        mouse_clicks,
        mouse_moved,
        active_window,
        active_browser_tab,
        monitors,
        power_status,
        cpu_usage_percent,
        memory_used_mb,
        memory_total_mb,
    }
}

#[tauri::command]
fn trigger_power_event(event: String) {
    power::update_power_state(&event);
}

fn get_app_dir(handle: &tauri::AppHandle) -> PathBuf {
    handle.path_resolver().app_data_dir().unwrap_or_else(|| PathBuf::from("."))
}

#[tauri::command]
fn get_device_fingerprint() -> String {
    security::generate_hardware_fingerprint()
}

#[tauri::command]
fn sign_agent_request(handle: tauri::AppHandle, method: String, endpoint: String, timestamp: String, nonce: String, body: String) -> Result<String, String> {
    let app_dir = get_app_dir(&handle);
    if let Ok(config) = security::load_secure_config(app_dir) {
        Ok(security::sign_request_payload(&config.hmac_secret, &method, &endpoint, &timestamp, &nonce, &body))
    } else {
        Err("Vault is not configured / device is unregistered.".to_string())
    }
}

#[tauri::command]
fn save_agent_credentials(handle: tauri::AppHandle, token: String, refresh_token: String, secret: String) -> Result<(), String> {
    let app_dir = get_app_dir(&handle);
    
    // Attempt to read current config to preserve consent status
    let consent_info = security::load_secure_config(app_dir.clone()).unwrap_or(security::SecurityConfig {
        device_uuid: security::generate_hardware_fingerprint(),
        hmac_secret: String::new(),
        consent_granted: false,
        consent_timestamp: String::new(),
    });

    let config = security::SecurityConfig {
        device_uuid: consent_info.device_uuid,
        hmac_secret: secret,
        consent_granted: consent_info.consent_granted,
        consent_timestamp: consent_info.consent_timestamp,
    };

    // Serialize access and refresh tokens and save them inside the DPAPI context
    let creds = serde_json::json!({
        "token": token,
        "refresh_token": refresh_token
    });
    let serialized = serde_json::to_vec(&creds).map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    let encrypted = security::win_dpapi::encrypt(&serialized)?;
    
    #[cfg(not(target_os = "windows"))]
    let encrypted = security::win_dpapi::encrypt(&serialized)?; // calls non-win encryption fallback

    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    std::fs::write(app_dir.join("session_creds.dat"), encrypted).map_err(|e| e.to_string())?;

    security::save_secure_config(&config, app_dir)
}

#[tauri::command]
fn load_agent_credentials(handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_dir = get_app_dir(&handle);
    let filepath = app_dir.join("session_creds.dat");
    if !filepath.exists() {
        return Err("No active credentials found.".to_string());
    }
    
    let encrypted = std::fs::read(filepath).map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    let decrypted = security::win_dpapi::decrypt(&encrypted)?;
    
    #[cfg(not(target_os = "windows"))]
    let decrypted = security::win_dpapi::decrypt(&encrypted)?; // calls non-win decryption fallback

    let creds: serde_json::Value = serde_json::from_slice(&decrypted).map_err(|e| e.to_string())?;
    Ok(creds)
}

#[tauri::command]
fn check_consent_status(handle: tauri::AppHandle) -> bool {
    let app_dir = get_app_dir(&handle);
    if let Ok(config) = security::load_secure_config(app_dir) {
        config.consent_granted
    } else {
        false
    }
}

#[tauri::command]
fn grant_consent_approval(handle: tauri::AppHandle) -> Result<(), String> {
    let app_dir = get_app_dir(&handle);
    let mut config = security::load_secure_config(app_dir.clone()).unwrap_or(security::SecurityConfig {
        device_uuid: security::generate_hardware_fingerprint(),
        hmac_secret: String::new(),
        consent_granted: false,
        consent_timestamp: String::new(),
    });

    let now_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string();

    config.consent_granted = true;
    config.consent_timestamp = now_epoch;

    security::save_secure_config(&config, app_dir)
}

fn main() {
    hooks::initialize_hooks();
    browser_host::start_native_messaging_host();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_native_telemetry,
            trigger_power_event,
            get_device_fingerprint,
            sign_agent_request,
            save_agent_credentials,
            load_agent_credentials,
            check_consent_status,
            grant_consent_approval
        ])
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                hooks::shutdown_hooks();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
