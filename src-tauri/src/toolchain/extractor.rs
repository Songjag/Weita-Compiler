use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use log::info;

use super::ArchiveType;

/// Extract an archive to `dest_dir`.
/// Automatically handles zip, tar.xz, tar.gz, tar.bz2.
pub async fn extract(
    archive_path: &Path,
    dest_dir: &Path,
    archive_type: ArchiveType,
) -> Result<()> {
    info!(
        "Extracting {:?} → {}",
        archive_path.file_name().unwrap_or_default(),
        dest_dir.display()
    );

    tokio::fs::create_dir_all(dest_dir)
        .await
        .context("Failed to create extraction directory")?;

    // Do the extraction in a blocking thread to avoid blocking async runtime
    let archive = archive_path.to_path_buf();
    let dest = dest_dir.to_path_buf();

    tokio::task::spawn_blocking(move || match archive_type {
        ArchiveType::ZipFile => extract_zip(&archive, &dest),
        ArchiveType::TarXz | ArchiveType::TarGz | ArchiveType::TarBz2 => {
            extract_tar(&archive, &dest, archive_type)
        }
    })
    .await
    .context("Extraction task panicked")??;

    info!("Extraction complete");
    Ok(())
}

fn extract_zip(archive: &Path, dest: &Path) -> Result<()> {
    let file = std::fs::File::open(archive)
        .context("Failed to open zip archive")?;
    let mut zip = zip::ZipArchive::new(file)
        .context("Failed to read zip archive")?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)
            .context("Failed to read zip entry")?;

        let out_path = dest.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .context("Failed to create directory")?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .context("Failed to create parent directory")?;
            }
            let mut out_file = std::fs::File::create(&out_path)
                .context("Failed to create output file")?;
            std::io::copy(&mut entry, &mut out_file)
                .context("Failed to copy file contents")?;

            // Preserve executable permissions on unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry.unix_mode() {
                    std::fs::set_permissions(
                        &out_path,
                        std::fs::Permissions::from_mode(mode),
                    )
                    .ok();
                }
            }
        }
    }

    Ok(())
}

fn extract_tar(archive: &Path, dest: &Path, archive_type: ArchiveType) -> Result<()> {
    let file = std::fs::File::open(archive)
        .context("Failed to open tar archive")?;

    match archive_type {
        ArchiveType::TarXz => {
            let decoder = xz2::read::XzDecoder::new(file);
            let mut tar = tar::Archive::new(decoder);
            tar.unpack(dest).context("Failed to unpack tar.xz")?;
        }
        ArchiveType::TarGz => {
            let decoder = flate2::read::GzDecoder::new(file);
            let mut tar = tar::Archive::new(decoder);
            tar.unpack(dest).context("Failed to unpack tar.gz")?;
        }
        ArchiveType::TarBz2 => {
            let decoder = bzip2::read::BzDecoder::new(file);
            let mut tar = tar::Archive::new(decoder);
            tar.unpack(dest).context("Failed to unpack tar.bz2")?;
        }
        _ => unreachable!(),
    }

    Ok(())
}

/// Search for gcc / g++ executables recursively inside `search_root`.
/// Returns path to the directory containing them.
pub fn find_compiler_bin_dir(search_root: &Path) -> Option<PathBuf> {
    find_bin_recursive(search_root, 0)
}

fn find_bin_recursive(dir: &Path, depth: usize) -> Option<PathBuf> {
    if depth > 6 {
        return None;
    }

    let gcc_name = if cfg!(target_os = "windows") { "gcc.exe" } else { "gcc" };
    let gpp_name = if cfg!(target_os = "windows") { "g++.exe" } else { "g++" };

    let has_gcc = dir.join(gcc_name).exists();
    let has_gpp = dir.join(gpp_name).exists();

    if has_gcc && has_gpp {
        return Some(dir.to_path_buf());
    }

    // Search subdirectories
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(found) = find_bin_recursive(&path, depth + 1) {
                    return Some(found);
                }
            }
        }
    }

    None
}
