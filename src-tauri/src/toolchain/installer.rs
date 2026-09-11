use std::path::PathBuf;
use anyhow::{Context, Result};
use log::{info, warn};
use tauri::{AppHandle, Emitter};

use super::{
    DownloadPhase, DownloadProgress, ToolchainInfo,
    cpp::manifest_for_platform,
    detector::{detect_system_compiler, make_ready_info, platform_key, test_compiler},
    downloader::{cache_path, download_and_verify},
    extractor::{extract, find_compiler_bin_dir},
};

/// Check current toolchain status.
/// On Linux: always tries system compiler first.
/// On Windows: tries system, then checks managed toolchain dir.
pub async fn check_toolchain() -> ToolchainInfo {
    info!("Checking toolchain for platform: {}", platform_key());

    // 1. Check system compiler
    if let Some((gcc, _gpp, version)) = detect_system_compiler() {
        info!("Using system compiler: {}", gcc);
        return make_ready_info("gcc", &version, &gcc);
    }

    // 2. Check if managed toolchain is already installed
    if let Some(info) = check_managed_toolchain() {
        return info;
    }

    // 3. Not found
    ToolchainInfo::not_found()
}

/// Check if a managed (downloaded) toolchain exists and is functional.
fn check_managed_toolchain() -> Option<ToolchainInfo> {
    let tc_dir = super::toolchains_dir();

    #[cfg(target_os = "windows")]
    let gcc_name = "gcc.exe";
    #[cfg(not(target_os = "windows"))]
    let gcc_name = "gcc";

    let bin_dir = find_compiler_bin_dir(&tc_dir)?;
    let gcc_path = bin_dir.join(gcc_name);

    if !gcc_path.exists() {
        return None;
    }

    match test_compiler(gcc_path.to_str()?) {
        Ok(version) => {
            info!("Managed toolchain found: {}", gcc_path.display());
            Some(make_ready_info(
                "gcc (managed)",
                &version,
                gcc_path.to_str().unwrap_or(""),
            ))
        }
        Err(e) => {
            warn!("Managed compiler test failed: {}", e);
            None
        }
    }
}

/// Install the toolchain for the current platform.
/// Emits `download-progress` events to the frontend.
pub async fn install_toolchain(app: AppHandle) -> Result<ToolchainInfo> {
    let key = platform_key();
    info!("Installing toolchain for: {}", key);

    let entry = manifest_for_platform(&key)
        .context(format!("No toolchain manifest for platform: {}", key))?;

    // Linux: prompt-based, guide user to use package manager
    if key.starts_with("linux") {
        return install_linux_toolchain(&app).await;
    }

    // Windows (and others): download portable toolchain
    install_windows_toolchain(&app, entry).await
}

async fn install_linux_toolchain(app: &AppHandle) -> Result<ToolchainInfo> {
    // On Linux, if we're here, system compiler wasn't found.
    // Try to install via package manager silently.
    use super::detector::detect_linux_distro;

    let distro = detect_linux_distro().unwrap_or_default();
    info!("Linux distro: {}", distro);

    emit_progress(
        app,
        0,
        0,
        DownloadPhase::Installing,
        "Installing GCC via package manager…",
    );

    let install_result = match distro.as_str() {
        "ubuntu" | "debian" | "linuxmint" | "pop" => {
            run_package_manager(&["apt-get", "install", "-y", "gcc", "g++"]).await
        }
        "arch" | "manjaro" | "endeavouros" => {
            run_package_manager(&["pacman", "-S", "--noconfirm", "gcc"]).await
        }
        "fedora" => {
            run_package_manager(&["dnf", "install", "-y", "gcc", "gcc-c++"]).await
        }
        "opensuse-leap" | "opensuse-tumbleweed" => {
            run_package_manager(&["zypper", "install", "-y", "gcc", "gcc-c++"]).await
        }
        _ => Err(anyhow::anyhow!(
            "Unsupported distro: {}. Please install gcc/g++ manually.",
            distro
        )),
    };

    match install_result {
        Ok(_) => {
            // Re-check
            if let Some((gcc, _gpp, version)) = detect_system_compiler() {
                emit_progress(app, 0, 0, DownloadPhase::Done, "Compiler ready!");
                return Ok(make_ready_info("gcc", &version, &gcc));
            }
            emit_progress(
                app,
                0,
                0,
                DownloadPhase::Error,
                "Installation succeeded but compiler not found.",
            );
            Ok(ToolchainInfo::not_found())
        }
        Err(e) => {
            emit_progress(
                app,
                0,
                0,
                DownloadPhase::Error,
                &format!("Installation failed: {}", e),
            );
            Err(e)
        }
    }
}

async fn run_package_manager(args: &[&str]) -> Result<()> {
    let (cmd, rest) = args.split_first().context("Empty command")?;
    let output = tokio::process::Command::new(cmd)
        .args(rest)
        .output()
        .await
        .context("Failed to run package manager")?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(anyhow::anyhow!("Package manager failed: {}", stderr))
    }
}

async fn install_windows_toolchain(
    app: &AppHandle,
    entry: &super::ToolchainEntry,
) -> Result<ToolchainInfo> {
    // Determine archive filename from URL
    let filename = entry
        .url
        .split('/')
        .last()
        .unwrap_or("toolchain.zip")
        .to_string();

    let cache_file = cache_path(&filename);
    let tc_dir = super::toolchains_dir().join("mingw64");

    // Check if already cached and valid
    let need_download = if cache_file.exists() && !entry.sha256.starts_with("placeholder") {
        super::downloader::verify_sha256(&cache_file, entry.sha256)
            .await
            .is_err()
    } else {
        true
    };

    if need_download {
        if entry.url.is_empty() || entry.sha256.starts_with("placeholder") {
            anyhow::bail!(
                "Toolchain download URL or SHA-256 not configured for this platform. \
                 Please install GCC manually and restart the app."
            );
        }

        let app_clone = app.clone();
        let on_progress = Box::new(move |downloaded: u64, total: u64| {
            let pct = if total > 0 {
                format!("{:.0}%", downloaded as f64 / total as f64 * 100.0)
            } else {
                "…".to_string()
            };
            emit_progress(
                &app_clone,
                downloaded,
                total,
                DownloadPhase::Downloading,
                &format!("Downloading GCC toolchain… {}", pct),
            );
        });

        emit_progress(app, 0, 0, DownloadPhase::Downloading, "Starting download…");

        download_and_verify(entry.url, &cache_file, entry.sha256, on_progress)
            .await
            .context("Download failed")?;
    }

    // Extract
    emit_progress(app, 0, 0, DownloadPhase::Extracting, "Extracting toolchain…");
    extract(&cache_file, &tc_dir, entry.archive_type)
        .await
        .context("Extraction failed")?;

    // Find gcc binary
    emit_progress(app, 0, 0, DownloadPhase::Testing, "Testing compiler…");
    let bin_dir = find_compiler_bin_dir(&tc_dir)
        .context("Could not find gcc in extracted toolchain")?;

    #[cfg(target_os = "windows")]
    let gcc_path = bin_dir.join("gcc.exe");
    #[cfg(not(target_os = "windows"))]
    let gcc_path = bin_dir.join("gcc");

    let version = test_compiler(gcc_path.to_str().context("Invalid path")?)
        .map_err(|e| anyhow::anyhow!("Compiler test failed: {}", e))?;

    info!("Toolchain installed: {} ({})", gcc_path.display(), version);

    emit_progress(app, 0, 0, DownloadPhase::Done, "Compiler ready!");

    Ok(make_ready_info(
        "gcc (managed)",
        &version,
        gcc_path.to_str().unwrap_or(""),
    ))
}

fn emit_progress(
    app: &AppHandle,
    downloaded: u64,
    total: u64,
    phase: DownloadPhase,
    message: &str,
) {
    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            downloaded_bytes: downloaded,
            total_bytes: total,
            phase,
            message: message.to_string(),
        },
    );
}

/// Resolve the actual gcc/g++ paths to use for compilation.
/// Returns (gcc_path, gpp_path, extra_env_path).
pub fn resolve_compiler_paths(
    custom_path: &str,
) -> Result<(PathBuf, PathBuf, Option<String>)> {
    // Custom path takes priority
    if !custom_path.is_empty() {
        let gcc = PathBuf::from(custom_path);
        let gpp = gcc
            .parent()
            .map(|d| d.join(if cfg!(windows) { "g++.exe" } else { "g++" }))
            .unwrap_or_else(|| PathBuf::from(if cfg!(windows) { "g++.exe" } else { "g++" }));
        return Ok((gcc, gpp, None));
    }

    // System compiler
    if let Some((gcc, gpp, _)) = detect_system_compiler() {
        return Ok((PathBuf::from(gcc), PathBuf::from(gpp), None));
    }

    // Managed toolchain
    let tc_dir = super::toolchains_dir();

    #[cfg(target_os = "windows")]
    let (gcc_name, gpp_name) = ("gcc.exe", "g++.exe");
    #[cfg(not(target_os = "windows"))]
    let (gcc_name, gpp_name) = ("gcc", "g++");

    if let Some(bin_dir) = find_compiler_bin_dir(&tc_dir) {
        let gcc = bin_dir.join(gcc_name);
        let gpp = bin_dir.join(gpp_name);
        let env_path = bin_dir.to_string_lossy().into_owned();
        return Ok((gcc, gpp, Some(env_path)));
    }

    anyhow::bail!("No compiler found. Please install GCC or configure a compiler path in Settings.")
}
