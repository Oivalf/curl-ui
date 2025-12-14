// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem, Submenu};
            use tauri::Manager;

            let handle = app.handle();

            // Create Menu Items
            let new_project_i =
                MenuItem::with_id(handle, "new_project", "New Project", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;
            let about_i = MenuItem::with_id(handle, "about", "About", true, None::<&str>)?;

            // Create Submenus
            let recent_projects_menu = Submenu::with_items(handle, "Recent Projects", true, &[])?;
            let file_menu = Submenu::with_items(
                handle,
                "File",
                true,
                &[&new_project_i, &recent_projects_menu, &quit_i],
            )?;
            let help_menu = Submenu::with_items(handle, "?", true, &[&about_i])?;

            // Create and Set Menu
            let menu = Menu::with_items(handle, &[&file_menu, &help_menu])?;
            app.set_menu(menu)?;

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
        .on_menu_event(|app, event| {
            if event.id() == "quit" {
                app.exit(0);
            }
            if event.id() == "new_project" {
                use tauri::Emitter;
                let _ = app.emit("open-new-project", ());
            }
            if event.id() == "about" {
                use tauri::Emitter;
                let _ = app.emit("open-about", ());
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
            commands::load_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
