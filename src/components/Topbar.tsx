import React from "react";
import { Language, LANGUAGE_LABELS, ToolchainInfo } from "../types";
import { Theme } from "../store/appStore";
import { makeT, UILang } from "../i18n/useI18n";

interface TopbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onSettings: () => void;
  toolchain: ToolchainInfo;
  theme: Theme;
  onToggleTheme: () => void;
  uiLang: UILang;
}

export const Topbar: React.FC<TopbarProps> = ({
  language,
  onLanguageChange,
  isRunning,
  onRun,
  onStop,
  onSettings,
  toolchain,
  theme,
  onToggleTheme,
  uiLang,
}) => {
  const T = makeT(uiLang);
  const canRun = toolchain.status === "READY" && !isRunning;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="app-logo">
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="12" fill="var(--blue)" />
            <text y="78" x="6" fontSize="68" fill="#fff" fontFamily="monospace" fontWeight="bold">{"</>"}</text>
          </svg>
          <span className="app-name">{T("appName")}</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="lang-selector">
          {(["c", "cpp"] as Language[]).map((lang) => (
            <button
              key={lang}
              className={`lang-btn ${language === lang ? "active" : ""}`}
              onClick={() => onLanguageChange(lang)}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        {isRunning ? (
          <button className="btn btn-stop" onClick={onStop} title="Stop (Ctrl+C)">
            <span>■</span> {T("stop")}
          </button>
        ) : (
          <button
            className={`btn btn-run ${!canRun ? "disabled" : ""}`}
            onClick={canRun ? onRun : undefined}
            title="Run (Ctrl+Enter)"
            disabled={!canRun}
          >
            <span>▶</span> {T("run")}
          </button>
        )}

        <button className="btn-theme" onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}>
          {theme === "dark" ? "☀" : "🌙"}
        </button>

        <button className="btn btn-icon-only" onClick={onSettings} title={T("settings")}>⚙</button>
      </div>
    </header>
  );
};
