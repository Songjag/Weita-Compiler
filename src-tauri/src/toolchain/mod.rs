pub mod detector;
pub mod downloader;
pub mod extractor;
pub mod installer;
pub mod cpp;

use serde::{Deserialize, Serialize};

/// Public toolchain status reported to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ToolchainStatus {
    Checking,
    Ready,
    NotFound,
    Downloading,
    Installing,
    Error,
}

/// Information about the active toolchain reported to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolchainInfo {
    pub status: ToolchainStatus,
    pub compiler: String,
    pub version: String,
    pub location: String,
}

impl ToolchainInfo {
    pub fn checking() -> Self {
        Self {
            status: ToolchainStatus::Checking,
            compiler: String::new(),
            version: String::new(),
            location: String::new(),
        }
    }

    pub fn not_found() -> Self {
        Self {
            status: ToolchainStatus::NotFound,
            compiler: String::new(),
            version: String::new(),
            location: String::new(),
        }
    }

    pub fn error(msg: &str) -> Self {
        Self {
            status: ToolchainStatus::Error,
            compiler: msg.to_string(),
            version: String::new(),
            location: String::new(),
        }
    }
}

/// Download progress event payload sent to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub phase: DownloadPhase,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadPhase {
    Downloading,
    Verifying,
    Extracting,
    Installing,
    Testing,
    Done,
    Error,
}

/// Static manifest of available toolchains per platform.
#[derive(Debug, Clone)]
pub struct ToolchainEntry {
    pub compiler: &'static str,
    pub version: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub archive_type: ArchiveType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchiveType {
    ZipFile,
    TarXz,
    TarGz,
    TarBz2,
}

/// App data directory for storing toolchains.
/// Windows: %LOCALAPPDATA%\WCompiler
/// Linux:   ~/.local/share/WCompiler
pub fn app_data_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("WCompiler")
    }
    #[cfg(not(target_os = "windows"))]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .unwrap_or_else(|| std::path::PathBuf::from("."))
                    .join(".local")
                    .join("share")
            })
            .join("WCompiler")
    }
}

pub fn toolchains_dir() -> std::path::PathBuf {
    app_data_dir().join("toolchains")
}
