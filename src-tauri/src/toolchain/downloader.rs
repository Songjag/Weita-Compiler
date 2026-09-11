use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use log::info;
use sha2::{Sha256, Digest};
use tokio::io::AsyncWriteExt;

/// Progress callback type: (downloaded_bytes, total_bytes)
pub type ProgressFn = Box<dyn Fn(u64, u64) + Send + Sync>;

/// Download a file from `url` to `dest`, calling `on_progress` during download.
/// After download, verifies SHA-256 against `expected_sha256` (hex string).
pub async fn download_and_verify(
    url: &str,
    dest: &Path,
    expected_sha256: &str,
    on_progress: ProgressFn,
) -> Result<()> {
    info!("Downloading {} → {}", url, dest.display());

    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context("Failed to create download directory")?;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .context("Failed to build HTTP client")?;

    let response = client
        .get(url)
        .send()
        .await
        .context("HTTP request failed")?;

    if !response.status().is_success() {
        anyhow::bail!("HTTP {} for {}", response.status(), url);
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = tokio::fs::File::create(dest)
        .await
        .context("Failed to create destination file")?;

    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("Error reading response chunk")?;
        file.write_all(&chunk).await.context("Failed to write chunk")?;
        downloaded += chunk.len() as u64;
        on_progress(downloaded, total);
    }

    file.flush().await.context("Failed to flush file")?;
    drop(file);

    info!("Download complete: {} bytes", downloaded);

    // Verify SHA-256
    verify_sha256(dest, expected_sha256).await?;

    Ok(())
}

/// Verify file SHA-256 against expected hex string.
pub async fn verify_sha256(path: &Path, expected: &str) -> Result<()> {
    info!("Verifying SHA-256 of {}", path.display());

    let bytes = tokio::fs::read(path)
        .await
        .context("Failed to read file for SHA-256 verification")?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual = hex::encode(hasher.finalize());

    if actual.to_lowercase() != expected.to_lowercase() {
        anyhow::bail!(
            "SHA-256 mismatch: expected {}, got {}",
            expected,
            actual
        );
    }

    info!("SHA-256 verified OK");
    Ok(())
}

/// Return default cache file path for a download.
pub fn cache_path(filename: &str) -> PathBuf {
    super::app_data_dir().join("cache").join(filename)
}
