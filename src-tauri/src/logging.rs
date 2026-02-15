use serde::Serialize;
use tauri::Emitter;

#[derive(Clone, Serialize)]
pub struct RustLogPayload {
    pub level: String,
    pub message: String,
}

/// Emit a log event to the frontend app console.
/// Falls back to eprintln if emitting fails.
pub fn emit_log<R: tauri::Runtime>(app: &tauri::AppHandle<R>, level: &str, message: &str) {
    let payload = RustLogPayload {
        level: level.to_string(),
        message: message.to_string(),
    };
    if let Err(e) = app.emit("rust-log", &payload) {
        eprintln!(
            "[rust-log emit error] {}: {} (emit err: {})",
            level, message, e
        );
    }
}

/// Convenience macros for logging with an AppHandle.
/// Usage: rust_info!(app_handle, "message {} {}", arg1, arg2);
#[macro_export]
macro_rules! rust_info {
    ($app:expr, $($arg:tt)*) => {
        $crate::logging::emit_log($app, "info", &format!($($arg)*))
    };
}

#[macro_export]
macro_rules! rust_warn {
    ($app:expr, $($arg:tt)*) => {
        $crate::logging::emit_log($app, "warn", &format!($($arg)*))
    };
}

#[macro_export]
macro_rules! rust_error {
    ($app:expr, $($arg:tt)*) => {
        $crate::logging::emit_log($app, "error", &format!($($arg)*))
    };
}
