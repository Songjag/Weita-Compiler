// Prevents an additional console window on Windows
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod commands;
mod runner;
mod toolchain;

use runner::{new_process_handle, ProcessHandle};

/// Shared application state stored in Tauri's managed state.
pub struct AppState {
    /// Handle to the currently running user process (for kill support).
    pub process_handle: ProcessHandle,
}

fn main() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .init();

    log::info!("Starting WCompiler");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            process_handle: new_process_handle(),
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_toolchain,
            commands::install_toolchain,
            commands::get_toolchain_status,
            commands::run_code_cmd,
            commands::stop_process,
            commands::build_project,
        ])
        // Note: run_code_cmd is exposed as "run_code_cmd" to frontend
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
