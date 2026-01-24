mod commands;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            // Initialize .curl-ui config folder in user home
            if let Ok(home_dir) = app.path().home_dir() {
                let config_dir = home_dir.join(".curl-ui");
                if !config_dir.exists() {
                    if let Ok(_) = std::fs::create_dir_all(&config_dir) {
                        println!("Created config directory: {:?}", config_dir);
                    }
                }
            }

            update_recent_projects_menu(app.handle())?;

            if let Some(window) = app.get_webview_window("main") {
                // Check if we should show the menu immediately (only if projectName is present)
                let url = window.url().unwrap();
                if url
                    .query()
                    .map(|q| q.contains("projectName="))
                    .unwrap_or(false)
                {
                    let menu = create_app_menu(handle)?;
                    window.set_menu(menu)?;
                }
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
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "quit" {
                app.exit(0);
            } else if id == "new_project" {
                let _ = app.emit("open-new-project", ());
            } else if id == "save" {
                let _ = app.emit("trigger-save", ());
            } else if id == "save_all" {
                let _ = app.emit("trigger-save-all", ());
            } else if id == "about" {
                let _ = app.emit("open-about", ());
            } else if id == "user_guide" {
                let _ = app.emit("open-user-guide", ());
            } else if id.starts_with("project:") {
                let project_name = &id[8..];
                let _ = app.emit("switch-project", project_name);
            }
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
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
            refresh_projects_menu,
            enable_window_menu
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

fn create_app_menu<R: tauri::Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // Create Menu Items
    let new_project_i =
        MenuItem::with_id(handle, "new_project", "New Project", true, None::<&str>)?;
    let save_i = MenuItem::with_id(handle, "save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_all_i = MenuItem::with_id(
        handle,
        "save_all",
        "Save All",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let quit_i = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;
    let about_i = MenuItem::with_id(handle, "about", "About", true, None::<&str>)?;
    let user_guide_i = MenuItem::with_id(handle, "user_guide", "User Guide", true, None::<&str>)?;

    // Create Submenus
    let recent_projects_menu =
        Submenu::with_id(handle, "recent_projects", "Recent Projects", true)?;
    let file_menu = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &new_project_i,
            &save_i,
            &save_all_i,
            &recent_projects_menu,
            &quit_i,
        ],
    )?;
    let help_menu = Submenu::with_items(handle, "?", true, &[&user_guide_i, &about_i])?;

    // Create and Set Menu
    Menu::with_items(handle, &[&file_menu, &help_menu])
}

fn update_recent_projects_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // Note: Since we set the menu per window, we might need to iterate windows or just rely on global menu if we had one.
    // In Tauri 2.0, if we set it per window, we need to update each window's menu.
    for window in app.webview_windows().values() {
        if let Some(menu) = window.menu() {
            update_menu_internal(app, &menu)?;
        }
    }
    Ok(())
}

fn update_menu_internal<R: tauri::Runtime>(
    app: &AppHandle<R>,
    menu: &Menu<R>,
) -> tauri::Result<()> {
    println!("Searching for recent_projects submenu...");
    if let Some(recent_submenu) = find_submenu_recursive(menu, "recent_projects") {
        println!("Found recent_projects submenu. Clearing items...");
        // Clear existing items
        while !recent_submenu.items()?.is_empty() {
            recent_submenu.remove_at(0)?;
        }

        // List projects
        let mut projects = Vec::new();
        if let Ok(home_dir) = app.path().home_dir() {
            let config_dir = home_dir.join(".curl-ui");
            println!("Searching for projects in {:?}", config_dir);
            if let Ok(entries) = std::fs::read_dir(config_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                        if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                            println!("Found project: {}", name);
                            projects.push(name.to_string());
                        }
                    }
                }
            }
        }

        // Sort alphabetically
        projects.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        println!("Total discovered projects: {}", projects.len());

        if projects.is_empty() {
            let item =
                MenuItem::with_id(app, "no_projects", "No Projects Found", false, None::<&str>)?;
            recent_submenu.append(&item)?;
        } else {
            for project in projects {
                let id = format!("project:{}", project);
                let item = MenuItem::with_id(app, id, &project, true, None::<&str>)?;
                recent_submenu.append(&item)?;
            }
        }
    } else {
        println!("CRITICAL: recent_projects submenu NOT FOUND in menu structure.");
    }
    Ok(())
}

fn find_submenu_recursive<R: tauri::Runtime>(
    menu: &Menu<R>,
    target_id: &str,
) -> Option<Submenu<R>> {
    for item in menu.items().ok()? {
        if let Some(submenu) = item.as_submenu() {
            if submenu.id() == target_id {
                return Some(submenu.clone());
            }
            if let Some(found) = find_submenu_in_submenu_recursive(submenu, target_id) {
                return Some(found);
            }
        }
    }
    None
}

fn find_submenu_in_submenu_recursive<R: tauri::Runtime>(
    submenu: &Submenu<R>,
    target_id: &str,
) -> Option<Submenu<R>> {
    for item in submenu.items().ok()? {
        if let Some(sub) = item.as_submenu() {
            if sub.id() == target_id {
                return Some(sub.clone());
            }
            if let Some(found) = find_submenu_in_submenu_recursive(sub, target_id) {
                return Some(found);
            }
        }
    }
    None
}

#[tauri::command]
async fn refresh_projects_menu(app: AppHandle) -> Result<(), String> {
    update_recent_projects_menu(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn enable_window_menu(window: tauri::Window) -> Result<(), String> {
    let handle = window.app_handle();
    let menu = create_app_menu(handle).map_err(|e| e.to_string())?;
    window.set_menu(menu).map_err(|e| e.to_string())?;
    update_recent_projects_menu(handle).map_err(|e| e.to_string())?;
    Ok(())
}
