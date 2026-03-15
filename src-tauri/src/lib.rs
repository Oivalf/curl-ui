mod commands;
pub mod logging;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Manager;
use tokio::sync::oneshot;
use tokio::sync::Mutex;

pub struct MockServerState {
    pub handles: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
}

pub struct HttpRequestState {
    pub handles: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    pub clients: Arc<Mutex<HashMap<String, reqwest::Client>>>,
    pub jars: Arc<Mutex<HashMap<String, Arc<reqwest::cookie::Jar>>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MockServerState {
            handles: Arc::new(Mutex::new(HashMap::new())),
        })
        .manage(HttpRequestState {
            handles: Arc::new(Mutex::new(HashMap::new())),
            clients: Arc::new(Mutex::new(HashMap::new())),
            jars: Arc::new(Mutex::new(HashMap::new())),
        })
        .setup(|app| {
            let handle = app.handle();

            // Initialize .curl-ui config folder in user home
            if let Ok(home_dir) = app.path().home_dir() {
                let config_dir = home_dir.join(".curl-ui");
                if !config_dir.exists() {
                    if let Ok(_) = std::fs::create_dir_all(&config_dir) {
                        rust_info!(&handle, "Created config directory: {:?}", config_dir);
                    }
                }
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let screen_size = monitor.size();
                    let width = (screen_size.width as f64 * 0.66) as u32;
                    let height = (screen_size.height as f64 * 0.66) as u32;

                    window
                        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
                        .unwrap();
                    window.center().unwrap();
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::reconstruct_request,
            commands::http_request,
            commands::git_init,
            commands::git_status,
            commands::git_add_all,
            commands::git_commit,
            commands::save_workspace,
            commands::load_workspace,
            commands::sync_project_manifest,
            commands::list_projects,
            commands::get_project_manifest,
            commands::get_user_guide_content,
            commands::delete_project,
            commands::is_git_repo,
            commands::get_git_root,
            commands::git_push,
            commands::git_add_file,
            commands::git_reset,
            commands::start_mock_server,
            commands::stop_mock_server,
            commands::cancel_http_request,
            commands::check_for_updates,
            commands::git_fetch,
            commands::git_pull,
            commands::get_conflicted_versions,
            commands::git_resolve_conflict,
            list_recent_projects
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let windows = app.webview_windows();

                // If the only remaining window is the user-guide, close it
                if windows.len() == 1 {
                    if let Some(guide_window) = windows.get("user-guide") {
                        let _ = guide_window.close();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn list_recent_projects(app: AppHandle) -> Result<Vec<String>, String> {
    let home_dir = app.path().home_dir().map_err(|e| e.to_string())?;
    let config_dir = home_dir.join(".curl-ui");
    let mut projects = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&config_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                    projects.push(name.to_string());
                }
            }
        }
    }

    projects.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(projects)
}
