use tauri::{AppHandle, State};
use log::info;
use serde::Serialize;
use std::path::Path;
use tokio::process::Command;

use crate::{
    runner::{run_code, RunPayload, RunResult},
    toolchain::{installer, ToolchainInfo},
    AppState,
};

/// Check the current toolchain status (called on app startup).
#[tauri::command]
pub async fn check_toolchain(app: AppHandle) -> Result<ToolchainInfo, String> {
    info!("Command: check_toolchain");
    Ok(installer::check_toolchain(&app).await)
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
pub async fn get_toolchain_status(app: AppHandle) -> Result<ToolchainInfo, String> {
    info!("Command: get_toolchain_status");
    Ok(installer::check_toolchain(&app).await)
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

#[derive(Debug, Serialize)]
pub struct BuildResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub async fn build_project(workspace_path: String) -> Result<BuildResult, String> {
    let workspace = Path::new(&workspace_path);
    if !workspace.is_dir() {
        return Err("Workspace folder does not exist".to_string());
    }

    let (program, args) = if workspace.join("CMakeLists.txt").is_file() {
        let build_dir = workspace.join("build");
        tokio::fs::create_dir_all(&build_dir).await.map_err(|e| e.to_string())?;
        let configure = Command::new("cmake")
            .args(["-S", ".", "-B", "build"])
            .current_dir(workspace)
            .output()
            .await
            .map_err(|e| e.to_string())?;
        if !configure.status.success() {
            return Ok(BuildResult {
                success: false,
                stdout: String::from_utf8_lossy(&configure.stdout).to_string(),
                stderr: String::from_utf8_lossy(&configure.stderr).to_string(),
            });
        }
        ("cmake", vec!["--build", "build"])
    } else if workspace.join("main.cpp").is_file() {
        ("g++", vec!["main.cpp", "-std=c++17", "-o", "main"])
    } else if workspace.join("main.c").is_file() {
        ("gcc", vec!["main.c", "-std=c17", "-o", "main"])
    } else {
        return Err("No CMakeLists.txt, main.cpp, or main.c found".to_string());
    };

    let output = Command::new(program)
        .args(args)
        .current_dir(workspace)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(BuildResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}
