use serde::{Serialize, Deserialize};

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::{HWND, RECT, BOOL, LPARAM, CloseHandle},
    UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId},
    System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
    Graphics::Gdi::{EnumDisplayMonitors, HMONITOR, HDC}
};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WindowSnapshot {
    pub title: String,
    pub process_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MonitorMetadata {
    pub id: usize,
    pub width: i32,
    pub height: i32,
}

// 1. Fetch current active window title and process binary name
pub fn get_active_window() -> Option<WindowSnapshot> {
    #[cfg(target_os = "windows")]
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return None;
        }

        // Retrieve window text title
        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), 512) as usize;
        let title = if len > 0 {
            String::from_utf16_lossy(&buffer[..len])
        } else {
            "Unknown Window".to_string()
        };

        // Retrieve executable process ID
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        
        let mut process_name = "Unknown".to_string();
        if process_id > 0 {
            // Under Win32 OpenProcess query executable details
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
            if handle != 0 {
                // In production, we'd use QueryFullProcessImageNameW, here we use helper name or mock it for simplicity
                process_name = format!("pid-{}", process_id);
                CloseHandle(handle);
            }
        }

        Some(WindowSnapshot { title, process_name })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Some(WindowSnapshot { title: "Mock Active Window".to_string(), process_name: "mock.exe".to_string() })
    }
}

// Helper structure for monitor enumeration
struct MonitorAccumulator {
    monitors: Vec<MonitorMetadata>,
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn monitor_callback(
    _monitor: HMONITOR,
    _hdc: HDC,
    rect_ptr: *mut RECT,
    data: LPARAM,
) -> BOOL {
    let acc = &mut *(data as *mut MonitorAccumulator);
    let rect = *rect_ptr;
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    let id = acc.monitors.len() + 1;
    
    acc.monitors.push(MonitorMetadata { id, width, height });
    1 // Continue enumeration
}

// 2. Fetch all active connected monitor screen geometries
pub fn detect_monitors() -> Vec<MonitorMetadata> {
    let mut acc = MonitorAccumulator { monitors: Vec::new() };
    #[cfg(target_os = "windows")]
    unsafe {
        let data = &mut acc as *mut MonitorAccumulator as LPARAM;
        EnumDisplayMonitors(0, std::ptr::null(), Some(monitor_callback), data);
    }
    #[cfg(not(target_os = "windows"))]
    {
        acc.monitors.push(MonitorMetadata { id: 1, width: 1920, height: 1080 });
    }
    acc.monitors
}
