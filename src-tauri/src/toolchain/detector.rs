/// Detect the current OS and CPU architecture.
use std::process::Command;
use log::info;

use super::{ToolchainInfo, ToolchainStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    Windows,
    Linux,
    MacOs,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Arch {
    X86_64,
    Aarch64,
    Unknown,
}

pub fn detect_os() -> Os {
    #[cfg(target_os = "windows")]
    return Os::Windows;
    #[cfg(target_os = "linux")]
    return Os::Linux;
    #[cfg(target_os = "macos")]
    return Os::MacOs;
    #[allow(unreachable_code)]
    Os::Unknown
}

pub fn detect_arch() -> Arch {
    #[cfg(target_arch = "x86_64")]
    return Arch::X86_64;
    #[cfg(target_arch = "aarch64")]
    return Arch::Aarch64;
    #[allow(unreachable_code)]
    Arch::Unknown
}

/// Platform key string used in the toolchain manifest (e.g. "linux-x86_64").
pub fn platform_key() -> String {
    let os = match detect_os() {
        Os::Windows => "windows",
        Os::Linux => "linux",
        Os::MacOs => "macos",
        Os::Unknown => "unknown",
    };
    let arch = match detect_arch() {
        Arch::X86_64 => "x86_64",
        Arch::Aarch64 => "aarch64",
        Arch::Unknown => "unknown",
    };
    format!("{}-{}", os, arch)
}

/// Check whether GCC or G++ is available as a system command.
/// Returns (gcc_path, gpp_path, version) on success.
pub fn detect_system_compiler() -> Option<(String, String, String)> {
    // Try gcc first, then cc
    let gcc = find_compiler(&["gcc", "cc"])?;
    let gpp = find_compiler(&["g++", "c++"])?;
    let version = query_version(&gcc).unwrap_or_default();
    info!("Detected system compiler: {} ({})", gcc, version);
    Some((gcc, gpp, version))
}

fn find_compiler(candidates: &[&str]) -> Option<String> {
    for name in candidates {
        if let Ok(path) = which::which(name) {
            return Some(path.to_string_lossy().into_owned());
        }
    }
    None
}

/// Get compiler version string from `compiler --version`.
pub fn query_version(compiler: &str) -> Option<String> {
    let output = Command::new(compiler)
        .arg("--version")
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    // First non-empty line
    let line = stdout.lines().find(|l| !l.trim().is_empty())?;
    Some(line.trim().to_string())
}

/// Check whether a specific binary at `path` works (returns version).
pub fn test_compiler(compiler_path: &str) -> Result<String, String> {
    let output = Command::new(compiler_path)
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let line = stdout
            .lines()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("")
            .trim()
            .to_string();
        Ok(line)
    } else {
        Err(format!(
            "Compiler test failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

/// Detect Linux distribution from /etc/os-release.
#[cfg(target_os = "linux")]
pub fn detect_linux_distro() -> Option<String> {
    let content = std::fs::read_to_string("/etc/os-release").ok()?;
    for line in content.lines() {
        if let Some(val) = line.strip_prefix("ID=") {
            return Some(val.trim_matches('"').to_lowercase());
        }
    }
    None
}

#[cfg(not(target_os = "linux"))]
pub fn detect_linux_distro() -> Option<String> {
    None
}

/// Build a ToolchainInfo for a found system compiler.
pub fn make_ready_info(compiler: &str, version: &str, location: &str) -> ToolchainInfo {
    ToolchainInfo {
        status: ToolchainStatus::Ready,
        compiler: compiler.to_string(),
        version: version.to_string(),
        location: location.to_string(),
    }
}
