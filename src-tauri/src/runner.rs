use std::path::PathBuf;
use std::time::{Duration, Instant};
use anyhow::Result;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::sync::Mutex;
use std::sync::Arc;

use crate::toolchain::{
    cpp::{CFlags, CppFlags},
    installer::resolve_compiler_paths,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_OUTPUT_BYTES: usize = 1 * 1024 * 1024; // 1 MB
const DEFAULT_TIMEOUT_SECS: u64 = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RunStatus {
    Success,
    ValueError,
    CompileError,
    RuntimeError,
    Timeout,
    OutputLimitExceeded,
    ProcessStartFailed,
    UnknownError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunResult {
    pub status: RunStatus,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunPayload {
    pub language: String,        // "c" | "cpp"
    pub source_code: String,
    pub stdin: String,
    pub timeout_secs: u64,
    pub cpp_standard: String,    // e.g. "c++17"
    pub c_standard: String,      // e.g. "c17"
    pub compiler_path: String,   // empty = auto
}

// ─── Process handle (for stop_process) ───────────────────────────────────────

pub type ProcessHandle = Arc<Mutex<Option<tokio::process::Child>>>;

pub fn new_process_handle() -> ProcessHandle {
    Arc::new(Mutex::new(None))
}

// ─── Main entry point ────────────────────────────────────────────────────────

pub async fn run_code(
    payload: RunPayload,
    process_handle: ProcessHandle,
) -> Result<RunResult> {
    info!(
        "run_code: language={} timeout={}s",
        payload.language, payload.timeout_secs
    );

    if payload.stdin.trim().is_empty() && source_requires_input(&payload.source_code) {
        return Ok(RunResult {
            status: RunStatus::ValueError,
            stdout: String::new(),
            stderr: String::from("Value Error: Input cannot be empty."),
            exit_code: None,
            execution_time_ms: 0,
        });
    }

    // Resolve compiler paths
    let (gcc_path, gpp_path, extra_path) =
        resolve_compiler_paths(&payload.compiler_path)?;

    let compiler = match payload.language.as_str() {
        "c" => gcc_path,
        _ => gpp_path, // default to C++
    };

    // Create temp directory
    let tmp_dir = tempfile::tempdir()?;
    let src_ext = if payload.language == "c" { "main.c" } else { "main.cpp" };
    let src_path: PathBuf = tmp_dir.path().join(src_ext);
    let bin_path: PathBuf = tmp_dir.path().join(if cfg!(windows) { "main.exe" } else { "main" });

    // Write source file
    tokio::fs::write(&src_path, &payload.source_code).await?;

    // ── Compile ────────────────────────────────────────────────────────────
    let timeout_secs = if payload.timeout_secs == 0 {
        DEFAULT_TIMEOUT_SECS
    } else {
        payload.timeout_secs
    };

    let compile_result = compile(
        &compiler,
        &src_path,
        &bin_path,
        &payload,
        extra_path.as_deref(),
    )
    .await;

    match compile_result {
        Err(e) => {
            return Ok(RunResult {
                status: RunStatus::ProcessStartFailed,
                stdout: String::new(),
                stderr: e.to_string(),
                exit_code: None,
                execution_time_ms: 0,
            });
        }
        Ok(compile_out) if !compile_out.success => {
            return Ok(RunResult {
                status: RunStatus::CompileError,
                stdout: String::new(),
                stderr: compile_out.stderr,
                exit_code: Some(compile_out.exit_code),
                execution_time_ms: 0,
            });
        }
        _ => {}
    }

    // ── Execute ────────────────────────────────────────────────────────────
    let start = Instant::now();
    let result = execute(
        &bin_path,
        &payload.stdin,
        Duration::from_secs(timeout_secs),
        extra_path.as_deref(),
        process_handle,
    )
    .await;

    let elapsed_ms = start.elapsed().as_millis() as u64;

    // Cleanup temp dir (automatic on drop, but explicit is fine)
    let _ = tmp_dir.close();

    match result {
        Ok(exec_out) => Ok(RunResult {
            status: map_exit_status(&exec_out),
            stdout: exec_out.stdout,
            stderr: exec_out.stderr,
            exit_code: Some(exec_out.exit_code),
            execution_time_ms: elapsed_ms,
        }),
        Err(ExecError::Timeout) => {
            warn!("Process timed out after {}s", timeout_secs);
            Ok(RunResult {
                status: RunStatus::Timeout,
                stdout: String::new(),
                stderr: format!("Time limit exceeded ({} seconds)", timeout_secs),
                exit_code: None,
                execution_time_ms: elapsed_ms,
            })
        }
        Err(ExecError::OutputLimit(stdout, stderr)) => {
            warn!("Output limit exceeded");
            Ok(RunResult {
                status: RunStatus::OutputLimitExceeded,
                stdout,
                stderr: format!(
                    "{}\n[Output truncated: exceeded {} KB limit]",
                    stderr,
                    MAX_OUTPUT_BYTES / 1024
                ),
                exit_code: None,
                execution_time_ms: elapsed_ms,
            })
        }
        Err(ExecError::Start(e)) => Ok(RunResult {
            status: RunStatus::ProcessStartFailed,
            stdout: String::new(),
            stderr: e,
            exit_code: None,
            execution_time_ms: elapsed_ms,
        }),
    }
}

fn source_requires_input(source: &str) -> bool {
    let compact: String = source.chars().filter(|character| !character.is_whitespace()).collect();
    let has_cin_read = compact.contains("cin>>") || compact.contains("std::cin>>");
    let input_functions = [
        "scanf(",
        "sscanf(",
        "fscanf(",
        "getline(",
        "std::getline(",
        "getchar(",
        "getc(",
        "fgets(",
        "gets(",
    ];

    has_cin_read || input_functions.iter().any(|function| compact.contains(function))
}

// ─── Compile ─────────────────────────────────────────────────────────────────

struct CompileOutput {
    success: bool,
    stderr: String,
    exit_code: i32,
}

async fn compile(
    compiler: &PathBuf,
    src: &PathBuf,
    bin: &PathBuf,
    payload: &RunPayload,
    extra_env_path: Option<&str>,
) -> Result<CompileOutput> {
    let flags = if payload.language == "c" {
        CFlags::new(&payload.c_standard).as_args()
    } else {
        CppFlags::new(&payload.cpp_standard).as_args()
    };

    let mut cmd = Command::new(compiler);
    cmd.arg(src)
        .args(&flags)
        .arg("-o")
        .arg(bin);

    // Inject toolchain bin dir into PATH for DLLs / libstdc++ resolution
    if let Some(extra) = extra_env_path {
        let existing = std::env::var("PATH").unwrap_or_default();
        let new_path = format!("{}{}{}", extra, path_sep(), existing);
        cmd.env("PATH", new_path);
    }

    // Don't inherit stdin
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let output = cmd.output().await?;
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(CompileOutput {
        success: output.status.success(),
        stderr,
        exit_code,
    })
}

// ─── Execute ─────────────────────────────────────────────────────────────────

struct ExecOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

#[derive(Debug)]
enum ExecError {
    Timeout,
    OutputLimit(String, String),
    Start(String),
}

async fn execute(
    bin: &PathBuf,
    stdin_data: &str,
    timeout: Duration,
    extra_env_path: Option<&str>,
    process_handle: ProcessHandle,
) -> std::result::Result<ExecOutput, ExecError> {
    let mut cmd = Command::new(bin);

    if let Some(extra) = extra_env_path {
        let existing = std::env::var("PATH").unwrap_or_default();
        let new_path = format!("{}{}{}", extra, path_sep(), existing);
        cmd.env("PATH", new_path);
    }

    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| ExecError::Start(e.to_string()))?;

    // Send all input up front and close stdin so programs can finish on EOF.
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(stdin_data.as_bytes()).await
            .map_err(|e| ExecError::Start(e.to_string()))?;
        stdin.shutdown().await.map_err(|e| ExecError::Start(e.to_string()))?;
    }

    // Store child for potential stop_process
    {
        let mut handle = process_handle.lock().await;
        // We can't easily store the child after taking stdout/stderr pipes,
        // so we use a separate kill mechanism below.
        let _ = handle.take();
    }

    let mut stdout_pipe = child.stdout.take().unwrap();
    let mut stderr_pipe = child.stderr.take().unwrap();

    // Collect stdout and stderr concurrently with output limit enforcement
    let stdout_limited = read_limited(&mut stdout_pipe, MAX_OUTPUT_BYTES);
    let stderr_limited = read_limited(&mut stderr_pipe, MAX_OUTPUT_BYTES);

    let collect = async {
        let (out_res, err_res) = tokio::join!(stdout_limited, stderr_limited);
        let stdout = out_res.unwrap_or_default();
        let stderr = err_res.unwrap_or_default();
        let total = stdout.len() + stderr.len();
        if total > MAX_OUTPUT_BYTES {
            return Err(ExecError::OutputLimit(
                String::from_utf8_lossy(&stdout).to_string(),
                String::from_utf8_lossy(&stderr).to_string(),
            ));
        }
        Ok((stdout, stderr))
    };

    let status = tokio::select! {
        result = collect => {
            match result {
                Err(e) => {
                    let _ = child.kill().await;
                    return Err(e);
                }
                Ok((stdout_buf, stderr_buf)) => {
                    let exit_status = child.wait().await.map_err(|e| ExecError::Start(e.to_string()))?;
                    let exit_code = exit_status.code().unwrap_or(-1);
                    (stdout_buf, stderr_buf, exit_code)
                }
            }
        }
        _ = tokio::time::sleep(timeout) => {
            let _ = child.kill().await;
            return Err(ExecError::Timeout);
        }
    };

    Ok(ExecOutput {
        stdout: String::from_utf8_lossy(&status.0).to_string(),
        stderr: String::from_utf8_lossy(&status.1).to_string(),
        exit_code: status.2,
    })
}

fn map_exit_status(out: &ExecOutput) -> RunStatus {
    if out.exit_code == 0 {
        RunStatus::Success
    } else {
        RunStatus::RuntimeError
    }
}

fn path_sep() -> &'static str {
    if cfg!(windows) { ";" } else { ":" }
}

/// Read up to `limit` bytes from an async reader.
async fn read_limited<R: AsyncReadExt + Unpin>(
    reader: &mut R,
    limit: usize,
) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(4096);
    let mut tmp = [0u8; 4096];
    loop {
        match reader.read(&mut tmp).await? {
            0 => break,
            n => {
                if buf.len() + n >= limit {
                    buf.extend_from_slice(&tmp[..n.min(limit - buf.len())]);
                    break;
                }
                buf.extend_from_slice(&tmp[..n]);
            }
        }
    }
    Ok(buf)
}
