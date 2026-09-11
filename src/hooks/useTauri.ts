import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ToolchainInfo,
  RunResult,
  RunCodePayload,
  DownloadProgress,
} from "../types";

/** Check toolchain availability */
export async function checkToolchain(): Promise<ToolchainInfo> {
  return invoke<ToolchainInfo>("check_toolchain");
}

/** Trigger toolchain installation (download + verify + extract + test) */
export async function installToolchain(): Promise<void> {
  return invoke<void>("install_toolchain");
}

/** Get current toolchain status */
export async function getToolchainStatus(): Promise<ToolchainInfo> {
  return invoke<ToolchainInfo>("get_toolchain_status");
}

/** Run source code */
export async function runCode(payload: RunCodePayload): Promise<RunResult> {
  return invoke<RunResult>("run_code_cmd", { payload });
}

/** Kill currently running process */
export async function stopProcess(): Promise<void> {
  return invoke<void>("stop_process");
}

/** Listen to download progress events from backend */
export function listenDownloadProgress(
  cb: (progress: DownloadProgress) => void
): () => void {
  let unlisten: (() => void) | null = null;

  listen<DownloadProgress>("download-progress", (event) => {
    cb(event.payload);
  }).then((fn) => {
    unlisten = fn;
  });

  return () => {
    if (unlisten) unlisten();
  };
}
