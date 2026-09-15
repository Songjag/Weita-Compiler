// ─── Language ────────────────────────────────────────────────────────────────

export type Language = "c" | "cpp";

export const LANGUAGE_LABELS: Record<Language, string> = {
  c: "C",
  cpp: "C++",
};

export const MONACO_LANGUAGE: Record<Language, string> = {
  c: "c",
  cpp: "cpp",
};

// ─── Compiler settings ───────────────────────────────────────────────────────

export type CppStandard = "c++17" | "c++20" | "c++23";
export type CStandard = "c11" | "c17";
export type CompilerChoice = "auto" | "gcc" | "clang";
export type TimeoutSetting = 1 | 3 | 5 | number;

export interface CompilerSettings {
  compilerChoice: CompilerChoice;
  cppStandard: CppStandard;
  cStandard: CStandard;
  timeoutSecs: number;
  compilerPath: string; // empty = auto
}

export const DEFAULT_SETTINGS: CompilerSettings = {
  compilerChoice: "auto",
  cppStandard: "c++17",
  cStandard: "c17",
  timeoutSecs: 3,
  compilerPath: "",
};

// ─── Run result ──────────────────────────────────────────────────────────────

export type RunStatus =
  | "SUCCESS"
  | "VALUE_ERROR"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PROCESS_START_FAILED"
  | "UNKNOWN_ERROR";

export interface RunResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  execution_time_ms: number;
}

// ─── Toolchain ───────────────────────────────────────────────────────────────

export type ToolchainStatus =
  | "CHECKING"
  | "READY"
  | "NOT_FOUND"
  | "DOWNLOADING"
  | "INSTALLING"
  | "ERROR";

export interface ToolchainInfo {
  status: ToolchainStatus;
  compiler: string;    // e.g. "gcc" or path
  version: string;
  location: string;
}

export interface DownloadProgress {
  downloaded_bytes: number;
  total_bytes: number;
  phase: "downloading" | "verifying" | "extracting" | "testing" | "done" | "error";
  message: string;
}

// ─── Tauri command payloads ───────────────────────────────────────────────────

export interface RunCodePayload {
  language: Language;
  source_code: string;
  stdin: string;
  timeout_secs: number;
  cpp_standard: string;
  c_standard: string;
  compiler_path: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  relativePath: string;
  kind: "file" | "directory";
}

export interface BuildResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

// ─── App error ───────────────────────────────────────────────────────────────

export type AppErrorType =
  | "COMPILER_NOT_FOUND"
  | "DOWNLOAD_FAILED"
  | "HASH_MISMATCH"
  | "EXTRACT_FAILED"
  | "COMPILER_TEST_FAILED"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PROCESS_START_FAILED"
  | "UNKNOWN_ERROR";

export interface AppError {
  type: AppErrorType;
  message: string;
  details: string;
}
