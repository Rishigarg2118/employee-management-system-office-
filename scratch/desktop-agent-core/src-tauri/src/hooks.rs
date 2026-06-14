use std::sync::atomic::{AtomicUsize, AtomicBool, Ordering, AtomicIsize};
use std::thread;
use lazy_static::lazy_static;

#[cfg(target_os = "windows")]
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
        MSG, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
        WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_MBUTTONDOWN, WM_MOUSEMOVE
    }
};

lazy_static! {
    static ref KEYBOARD_COUNT: AtomicUsize = AtomicUsize::new(0);
    static ref MOUSE_COUNT: AtomicUsize = AtomicUsize::new(0);
    static ref MOUSE_MOVED: AtomicBool = AtomicBool::new(false);
}

#[cfg(target_os = "windows")]
static KBD_HOOK: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
static MSE_HOOK: AtomicIsize = AtomicIsize::new(0);

// Keyboard callback hook handler
#[cfg(target_os = "windows")]
unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if code >= 0 {
        let event = w_param as u32;
        if event == WM_KEYDOWN || event == WM_SYSKEYDOWN {
            KEYBOARD_COUNT.fetch_add(1, Ordering::SeqCst);
        }
    }
    CallNextHookEx(0, code, w_param, l_param)
}

// Mouse callback hook handler
#[cfg(target_os = "windows")]
unsafe extern "system" fn low_level_mouse_proc(
    code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if code >= 0 {
        let event = w_param as u32;
        if event == WM_LBUTTONDOWN || event == WM_RBUTTONDOWN || event == WM_MBUTTONDOWN {
            MOUSE_COUNT.fetch_add(1, Ordering::SeqCst);
        } else if event == WM_MOUSEMOVE {
            MOUSE_MOVED.store(true, Ordering::SeqCst);
        }
    }
    CallNextHookEx(0, code, w_param, l_param)
}

// Exposes commands to gather current input logs and reset counters
pub fn fetch_and_reset_activity() -> (usize, usize, bool) {
    let kbd = KEYBOARD_COUNT.swap(0, Ordering::SeqCst);
    let mse = MOUSE_COUNT.swap(0, Ordering::SeqCst);
    let moved = MOUSE_MOVED.swap(false, Ordering::SeqCst);
    (kbd, mse, moved)
}

pub fn initialize_hooks() {
    #[cfg(target_os = "windows")]
    {
        thread::spawn(|| unsafe {
            let instance = std::ptr::null_mut();
            let k_hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                instance,
                0,
            );
            KBD_HOOK.store(k_hook, Ordering::SeqCst);

            let m_hook = SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(low_level_mouse_proc),
                instance,
                0,
            );
            MSE_HOOK.store(m_hook, Ordering::SeqCst);

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}
        });
        println!("[Hooks Engine] Low-level global Windows input hooks registered.");
    }
}

pub fn shutdown_hooks() {
    #[cfg(target_os = "windows")]
    unsafe {
        let k_hook = KBD_HOOK.swap(0, Ordering::SeqCst);
        if k_hook != 0 {
            UnhookWindowsHookEx(k_hook);
        }
        let m_hook = MSE_HOOK.swap(0, Ordering::SeqCst);
        if m_hook != 0 {
            UnhookWindowsHookEx(m_hook);
        }
        println!("[Hooks Engine] OS input hooks released successfully.");
    }
}
