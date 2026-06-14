use serde::{Serialize, Deserialize};
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use aes_gcm::{Aes256Gcm, KeyInit, aead::Aead};
use rand::{Rng, thread_rng};
use std::process::Command;
use std::fs;
use std::path::PathBuf;

type HmacSha256 = Hmac<Sha256>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SecurityConfig {
    pub device_uuid: String,
    pub hmac_secret: String,
    pub consent_granted: bool,
    pub consent_timestamp: String,
}

// Windows-specific DPAPI bindings
#[cfg(target_os = "windows")]
mod win_dpapi {
    use std::ptr;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN
    };
    use windows_sys::Win32::Foundation::LocalFree;

    pub fn encrypt(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut data_in = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        unsafe {
            let success = CryptProtectData(
                &mut data_in,
                ptr::null(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            );

            if success != 0 {
                let result = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec();
                LocalFree(data_out.pbData as isize);
                Ok(result)
            } else {
                Err(format!("DPAPI CryptProtectData failed with code: {}", std::io::Error::last_os_error()))
            }
        }
    }

    pub fn decrypt(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut data_in = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        unsafe {
            let success = CryptUnprotectData(
                &mut data_in,
                ptr::null_mut(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            );

            if success != 0 {
                let result = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec();
                LocalFree(data_out.pbData as isize);
                Ok(result)
            } else {
                Err(format!("DPAPI CryptUnprotectData failed with code: {}", std::io::Error::last_os_error()))
            }
        }
    }
}

// Fallback encryption for non-Windows operating systems
#[cfg(not(target_os = "windows"))]
mod win_dpapi {
    pub fn encrypt(data: &[u8]) -> Result<Vec<u8>, String> {
        // Fallback obfuscation for non-Windows platforms in UAT/dev
        let obfuscated: Vec<u8> = data.iter().map(|b| b ^ 0xAA).collect();
        Ok(obfuscated)
    }

    pub fn decrypt(data: &[u8]) -> Result<Vec<u8>, String> {
        let deobfuscated: Vec<u8> = data.iter().map(|b| b ^ 0xAA).collect();
        Ok(deobfuscated)
    }
}

/// Natively queries hardware metrics to generate a consistent SHA-256 fingerprint of the endpoint.
pub fn generate_hardware_fingerprint() -> String {
    let mut hardware_string = String::new();

    // 1. Motherboard BIOS UUID (Windows-specific check)
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("wmic")
            .args(&["path", "win32_computersystemproduct", "get", "uuid"])
            .output() 
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let clean = line.trim();
                if !clean.is_empty() && clean != "UUID" {
                    hardware_string.push_str(clean);
                    break;
                }
            }
        }
    }

    // Fallback/Supplement with CPU features
    let mut sys = sysinfo::System::new();
    sys.refresh_cpu();
    if let Some(cpu) = sys.cpus().first() {
        hardware_string.push_str(cpu.brand());
    }

    let mut hasher = Sha256::new();
    hasher.update(hardware_string.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Stores secret configuration bytes securely in an encrypted local appdata configuration file
pub fn save_secure_config(config: &SecurityConfig, app_dir: PathBuf) -> Result<(), String> {
    let serialized = serde_json::to_vec(config)
        .map_err(|e| format!("Failed to serialize secure config: {}", e))?;
    
    // Encrypt the serialized structure using the DPAPI credential wrapper
    let encrypted = win_dpapi::encrypt(&serialized)?;
    
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    let filepath = app_dir.join("security_vault.dat");
    fs::write(filepath, encrypted)
        .map_err(|e| format!("Failed to write secure vault: {}", e))?;
    
    Ok(())
}

/// Reads and decrypts secret config from the AppData vault.
pub fn load_secure_config(app_dir: PathBuf) -> Result<SecurityConfig, String> {
    let filepath = app_dir.join("security_vault.dat");
    if !filepath.exists() {
        return Err("Vault does not exist.".to_string());
    }

    let encrypted = fs::read(filepath)
        .map_err(|e| format!("Failed to read secure vault: {}", e))?;
    
    let decrypted = win_dpapi::decrypt(&encrypted)?;
    
    let config: SecurityConfig = serde_json::from_slice(&decrypted)
        .map_err(|e| format!("Failed to parse config: {}", e))?;
    
    Ok(config)
}

/// Signs api requests using HMAC-SHA256
pub fn sign_request_payload(secret_key: &str, method: &str, endpoint: &str, timestamp: &str, nonce: &str, body: &str) -> String {
    let message = format!("{}:{}:{}:{}:{}", method, endpoint, timestamp, nonce, body);
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes())
        .expect("HMAC key setup failed");
    mac.update(message.as_bytes());
    let result = mac.finalize();
    format!("{:x}", result.into_bytes())
}

/// Encrypts offline queues locally using AES-256-GCM.
pub fn encrypt_local_queue(encryption_key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(encryption_key.into());
    let mut nonce_bytes = [0u8; 12];
    thread_rng().fill(&mut nonce_bytes);
    
    let ciphertext = cipher.encrypt(&nonce_bytes.into(), plaintext)
        .map_err(|e| format!("AES local queue encryption failure: {}", e))?;
    
    // Append nonce to the ciphertext for storage
    let mut payload = nonce_bytes.to_vec();
    payload.extend(ciphertext);
    Ok(payload)
}

/// Decrypts local queues.
pub fn decrypt_local_queue(encryption_key: &[u8; 32], raw_bytes: &[u8]) -> Result<Vec<u8>, String> {
    if raw_bytes.len() < 12 {
        return Err("Payload is too small, missing encryption metadata".to_string());
    }
    
    let (nonce_bytes, ciphertext) = raw_bytes.split_at(12);
    let cipher = Aes256Gcm::new(encryption_key.into());
    
    let decrypted = cipher.decrypt(nonce_bytes.into(), ciphertext)
        .map_err(|e| format!("AES local queue decryption failure: {}", e))?;
    
    Ok(decrypted)
}
