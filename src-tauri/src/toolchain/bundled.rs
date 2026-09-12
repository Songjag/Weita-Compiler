/// Bundled toolchain support (feature = "bundled-toolchain", Windows only).
///
/// When the app is built with `--features bundled-toolchain`, the CI workflow
/// places a pre-downloaded MinGW-w64 zip into `src-tauri/resources/toolchain/`
/// before calling `tauri build`. Tauri then embeds those resources into the
/// installer/bundle. On first launch the app extracts them once into the user's
/// app-data directory and uses that for all subsequent compilations.
///
/// Layout inside resources/:
///   resources/toolchain/mingw64.zip   ← the MinGW-w64 portable archive
///   resources/toolchain/mingw64.zip.sha256  ← hex SHA-256 of the zip
///
/// After extraction the toolchain lives at:
///   Windows: %LOCALAPPDATA%\WCompiler\toolchains\mingw64\
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use log::info;
use tauri::{AppHandle, Manager};

use super::{
    downloader::verify_sha256,
    extractor::{extract, find_compiler_bin_dir},
    detector::{make_ready_info, test_compiler},
    ToolchainInfo, ArchiveType,
};

/// Sentinel file written after a successful extraction.
/// Its presence means "bundled toolchain already set up — skip extraction".
fn sentinel_path() -> PathBuf {
    super::toolchains_dir().join(".bundled-ready")
}

/// Destination directory for the extracted toolchain.
fn dest_dir() -> PathBuf {
    super::toolchains_dir().join("mingw64")
}

/// Return the path to the bundled zip inside the Tauri resource dir.
fn bundled_zip_path(app: &AppHandle) -> Result<PathBuf> {
    let resource_dir = app
        .path()
        .resource_dir()
        .context("Cannot resolve Tauri resource directory")?;
    Ok(resource_dir.join("toolchain").join("mingw64.zip"))
}

/// Return the path to the bundled sha256 file inside the Tauri resource dir.
fn bundled_sha256_path(app: &AppHandle) -> Result<PathBuf> {
    let resource_dir = app
        .path()
        .resource_dir()
        .context("Cannot resolve Tauri resource directory")?;
    Ok(resource_dir.join("toolchain").join("mingw64.zip.sha256"))
}

/// Read expected SHA-256 from the .sha256 sidecar file (hex string, one line).
fn read_expected_sha256(sha_file: &Path) -> Result<String> {
    let raw = std::fs::read_to_string(sha_file)
        .context("Cannot read bundled sha256 file")?;
    // Format may be "HASH  filename" (sha256sum output) or just "HASH"
    let hash = raw
        .split_whitespace()
        .next()
        .context("sha256 file is empty")?
        .to_lowercase();
    Ok(hash)
}

/// Check if the bundled toolchain has already been extracted and is working.
#[allow(dead_code)]
pub fn is_ready() -> bool {
    sentinel_path().exists()
}

/// Check the already-extracted managed toolchain and return its info.
pub fn check_extracted() -> Option<ToolchainInfo> {
    let bin_dir = find_compiler_bin_dir(&dest_dir())?;
    let gcc_path = bin_dir.join("gcc.exe");
    if !gcc_path.exists() {
        return None;
    }
    match test_compiler(gcc_path.to_str()?) {
        Ok(version) => {
            info!("Bundled toolchain found: {}", gcc_path.display());
            Some(make_ready_info(
                "gcc (bundled)",
                &version,
                gcc_path.to_str().unwrap_or(""),
            ))
        }
        Err(e) => {
            log::warn!("Bundled compiler test failed: {}", e);
            None
        }
    }
}

/// Extract the bundled MinGW-w64 zip into the app-data directory.
/// Called once on first launch (or when the sentinel is missing).
/// Emits no Tauri events — caller is responsible for progress feedback.
pub async fn extract_bundled(app: &AppHandle) -> Result<ToolchainInfo> {
    let zip_path = bundled_zip_path(app)?;
    let sha_path = bundled_sha256_path(app)?;

    // Verify integrity
    info!("Verifying bundled toolchain archive: {}", zip_path.display());
    if sha_path.exists() {
        let expected = read_expected_sha256(&sha_path)?;
        verify_sha256(&zip_path, &expected)
            .await
            .context("Bundled toolchain SHA-256 mismatch — the installer may be corrupted")?;
    } else {
        log::warn!("No sha256 sidecar found — skipping integrity check");
    }

    // Extract
    let dest = dest_dir();
    info!("Extracting bundled toolchain to: {}", dest.display());
    extract(&zip_path, &dest, ArchiveType::ZipFile)
        .await
        .context("Failed to extract bundled toolchain")?;

    // Locate gcc
    let bin_dir = find_compiler_bin_dir(&dest)
        .context("Could not find gcc.exe in extracted bundled toolchain")?;
    let gcc_path = bin_dir.join("gcc.exe");

    let version = test_compiler(gcc_path.to_str().context("Invalid gcc path")?)
        .map_err(|e| anyhow::anyhow!("Bundled compiler test failed: {}", e))?;

    info!("Bundled toolchain ready: {} ({})", gcc_path.display(), version);

    // Write sentinel so we skip extraction next time
    std::fs::create_dir_all(super::toolchains_dir())
        .context("Cannot create toolchains dir")?;
    std::fs::write(sentinel_path(), version.as_bytes())
        .context("Cannot write bundled-ready sentinel")?;

    Ok(make_ready_info(
        "gcc (bundled)",
        &version,
        gcc_path.to_str().unwrap_or(""),
    ))
}
