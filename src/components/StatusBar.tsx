import React from "react";
import { ToolchainInfo, RunResult } from "../types";
import { makeT, UILang } from "../i18n/useI18n";

interface StatusBarProps {
  toolchain: ToolchainInfo;
  runResult: RunResult | null;
  isRunning: boolean;
  onToolchainClick: () => void;
  uiLang: UILang;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  toolchain,
  runResult,
  isRunning,
  onToolchainClick,
  uiLang,
}) => {
  const T = makeT(uiLang);

  const tcLabel = () => {
    switch (toolchain.status) {
      case "CHECKING":    return `⟳ ${T("toolchainChecking")}`;
      case "READY":       return `✓ ${toolchain.compiler}${toolchain.version ? " " + toolchain.version : ""}`;
      case "NOT_FOUND":   return `⚠ ${T("toolchainNotFound")}`;
      case "DOWNLOADING": return `⬇ ${T("toolchainDownloading")}`;
      case "INSTALLING":  return `⚙ ${T("toolchainInstalling")}`;
      case "ERROR":       return `✗ ${T("toolchainError")}`;
    }
  };

  const tcClass = () => {
    switch (toolchain.status) {
      case "READY":                return "status-ok";
      case "NOT_FOUND":
      case "ERROR":                return "status-error";
      default:                     return "status-info";
    }
  };

  return (
    <footer className="status-bar">
      <button
        className={`status-item ${tcClass()} clickable`}
        onClick={onToolchainClick}
        title="Click to manage toolchain"
      >
        {tcLabel()}
      </button>

      <div className="status-spacer" />

      {isRunning && <span className="status-item status-info">● {T("running")}</span>}

      {runResult && !isRunning && (
        <>
          <span className="status-item status-dim">⏱ {runResult.execution_time_ms} {T("executionTime")}</span>
          <span className={`status-item ${runResult.status === "SUCCESS" ? "status-ok" : "status-error"}`}>
            {T("exitCode")} {runResult.exit_code ?? "–"}
          </span>
        </>
      )}
    </footer>
  );
};
