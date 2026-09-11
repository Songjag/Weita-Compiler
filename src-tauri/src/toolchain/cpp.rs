/// Toolchain manifest - centralised URL / version / hash configuration.
/// To update the toolchain version, only change values here.
use super::{ArchiveType, ToolchainEntry};

/// Windows x86_64: winlibs GCC portable (no installer, no admin)
/// https://winlibs.com/ - standalone MinGW-w64 package
pub const WINDOWS_X86_64: ToolchainEntry = ToolchainEntry {
    compiler: "mingw64-gcc",
    version: "14.2.0",
    // winlibs.com standalone release (POSIX threads, UCRT, LLVM/MinGW)
    url: "https://github.com/brechtsanders/winlibs_mingw/releases/download/14.2.0posix-19.1.1-12.0.0-ucrt-r2/winlibs-x86_64-posix-seh-gcc-14.2.0-mingw-w64ucrt-12.0.0-r2.zip",
    sha256: "placeholder_update_before_use",
    archive_type: ArchiveType::ZipFile,
};

/// Windows aarch64: placeholder - expand when available
pub const WINDOWS_AARCH64: ToolchainEntry = ToolchainEntry {
    compiler: "mingw64-gcc",
    version: "14.2.0",
    url: "https://example.com/placeholder",
    sha256: "placeholder",
    archive_type: ArchiveType::ZipFile,
};

/// Linux: prefer system GCC (no download needed).
/// This is only a fallback entry description; actual detection uses `which`.
pub const LINUX_X86_64: ToolchainEntry = ToolchainEntry {
    compiler: "system-gcc",
    version: "",
    url: "",
    sha256: "",
    archive_type: ArchiveType::TarGz,
};

pub const LINUX_AARCH64: ToolchainEntry = ToolchainEntry {
    compiler: "system-gcc",
    version: "",
    url: "",
    sha256: "",
    archive_type: ArchiveType::TarGz,
};

/// Get the manifest entry for the current platform.
pub fn manifest_for_platform(platform_key: &str) -> Option<&'static ToolchainEntry> {
    match platform_key {
        "windows-x86_64" => Some(&WINDOWS_X86_64),
        "windows-aarch64" => Some(&WINDOWS_AARCH64),
        "linux-x86_64" => Some(&LINUX_X86_64),
        "linux-aarch64" => Some(&LINUX_AARCH64),
        _ => None,
    }
}

/// Compiler flags for C++
pub struct CppFlags {
    pub standard: String,
    pub extra: Vec<&'static str>,
}

impl CppFlags {
    pub fn new(standard: &str) -> Self {
        Self {
            standard: format!("-std={}", standard),
            extra: vec!["-O0", "-pipe"],
        }
    }

    pub fn as_args(&self) -> Vec<String> {
        let mut v = vec![self.standard.clone()];
        v.extend(self.extra.iter().map(|s| s.to_string()));
        v
    }
}

/// Compiler flags for C
pub struct CFlags {
    pub standard: String,
    pub extra: Vec<&'static str>,
}

impl CFlags {
    pub fn new(standard: &str) -> Self {
        Self {
            standard: format!("-std={}", standard),
            extra: vec!["-O0", "-pipe"],
        }
    }

    pub fn as_args(&self) -> Vec<String> {
        let mut v = vec![self.standard.clone()];
        v.extend(self.extra.iter().map(|s| s.to_string()));
        v
    }
}
