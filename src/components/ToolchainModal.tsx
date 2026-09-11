import React from "react";
import { ToolchainInfo, DownloadProgress } from "../types";
import { makeT, UILang } from "../i18n/useI18n";

interface ToolchainModalProps {
  toolchain: ToolchainInfo;
  downloadProgress: DownloadProgress | null;
  onInstall: () => void;
  onClose: () => void;
  uiLang: UILang;
}

export const ToolchainModal: React.FC<ToolchainModalProps> = ({
  toolchain,
  downloadProgress,
  onInstall,
  onClose,
  uiLang,
}) => {
  const T = makeT(uiLang);

  const pct =
    downloadProgress && downloadProgress.total_bytes > 0
      ? Math.round((downloadProgress.downloaded_bytes / downloadProgress.total_bytes) * 100)
      : 0;

  const isInstalling = toolchain.status === "DOWNLOADING" || toolchain.status === "INSTALLING";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{T("toolchainTitle")}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {toolchain.status === "READY" && (
            <div className="tc-ready">
              <div className="tc-ready-icon">✓</div>
              <div className="tc-info">
                <div className="tc-info-row">
                  <span className="tc-label">{T("toolchainCompiler")}</span>
                  <span className="tc-value">{toolchain.compiler}</span>
                </div>
                {toolchain.version && (
                  <div className="tc-info-row">
                    <span className="tc-label">{T("toolchainVersion")}</span>
                    <span className="tc-value">{toolchain.version}</span>
                  </div>
                )}
                {toolchain.location && (
                  <div className="tc-info-row">
                    <span className="tc-label">{T("toolchainLocation")}</span>
                    <span className="tc-value tc-path">{toolchain.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {toolchain.status === "NOT_FOUND" && !isInstalling && (
            <div className="tc-missing">
              <p className="tc-warn-text">{T("toolchainMissingMsg")}</p>
              <p className="tc-sub-text">{T("toolchainMissingHint")}</p>
              <button className="btn btn-run btn-install" onClick={onInstall}>
                {T("toolchainInstallBtn")}
              </button>
            </div>
          )}

          {isInstalling && downloadProgress && (
            <div className="tc-downloading">
              <div className="dl-phase">{downloadProgress.message}</div>
              {downloadProgress.phase === "downloading" ? (
                <>
                  <div className="dl-bar-wrap">
                    <div className="dl-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="dl-pct">{pct}%</div>
                </>
              ) : (
                <div className="dl-spinner-wrap"><span className="spinner" /></div>
              )}
            </div>
          )}

          {toolchain.status === "ERROR" && (
            <div className="tc-error">
              <p className="tc-error-text">{T("toolchainFailedMsg")}</p>
              <button className="btn btn-run btn-install" onClick={onInstall}>
                {T("toolchainRetryBtn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
