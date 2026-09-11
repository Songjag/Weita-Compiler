use tauri::{AppHandle, State};
use log::info;

use crate::{
    runner::{run_code, RunPayload, RunResult},
    toolchain::{installer, ToolchainInfo},
    AppState,
};

/// Check the current toolchain status (called on app startup).
#[tauri::command]
pub async fn check_toolchain() -> Result<ToolchainInfo, String> {
    info!("Command: check_toolchain");
    Ok(installer::check_toolchain().await)
}

/// Install the toolchain (download, extract, test).
#[tauri::command]
pub async fn install_toolchain(app: AppHandle) -> Result<ToolchainInfo, String> {
    info!("Command: install_toolchain");
    installer::install_toolchain(app)
        .await
        .map_err(|e| e.to_string())
}

/// Get the current toolchain status (same as check, kept for symmetry).
#[tauri::command]
pub async fn get_toolchain_status() -> Result<ToolchainInfo, String> {
    info!("Command: get_toolchain_status");
    Ok(installer::check_toolchain().await)
}

/// Compile and run source code.
#[tauri::command]
pub async fn run_code_cmd(
    payload: RunPayload,
    state: State<'_, AppState>,
) -> Result<RunResult, String> {
    info!("Command: run_code language={}", payload.language);

    let handle = state.process_handle.clone();
    run_code(payload, handle)
        .await
        .map_err(|e| e.to_string())
}

/// Kill the currently running process.
#[tauri::command]
pub async fn stop_process(state: State<'_, AppState>) -> Result<(), String> {
    info!("Command: stop_process");
    let mut guard = state.process_handle.lock().await;
    if let Some(child) = guard.as_mut() {
        child.kill().await.map_err(|e| e.to_string())?;
        *guard = None;
    }
    Ok(())
}
