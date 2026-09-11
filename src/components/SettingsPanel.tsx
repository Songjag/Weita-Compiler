import React from "react";
import { CompilerSettings, CppStandard, CStandard, CompilerChoice } from "../types";
import { Select, SelectOption } from "./Select";
import { makeT, UILang } from "../i18n/useI18n";
import { Theme } from "../store/appStore";

interface SettingsPanelProps {
  settings: CompilerSettings;
  onChange: (s: CompilerSettings) => void;
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  uiLang: UILang;
  onSetUiLang: (l: UILang) => void;
  fontSize: number;
  onSetFontSize: (n: number) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChange,
  onClose,
  theme,
  onToggleTheme,
  uiLang,
  onSetUiLang,
  fontSize,
  onSetFontSize,
}) => {
  const T = makeT(uiLang);
  const set = <K extends keyof CompilerSettings>(key: K, val: CompilerSettings[K]) =>
    onChange({ ...settings, [key]: val });

  // ── Option lists ────────────────────────────────────────────────────────
  const compilerOpts: SelectOption[] = [
    { value: "auto",  label: T("compilerAuto") },
    { value: "gcc",   label: "GCC" },
    { value: "clang", label: "Clang" },
  ];
  const cppStdOpts: SelectOption[] = [
    { value: "c++17", label: "C++17" },
    { value: "c++20", label: "C++20" },
    { value: "c++23", label: "C++23" },
  ];
  const cStdOpts: SelectOption[] = [
    { value: "c11", label: "C11" },
    { value: "c17", label: "C17" },
  ];
  const timeoutOpts: SelectOption[] = [
    { value: 1,  label: "1s" },
    { value: 3,  label: "3s" },
    { value: 5,  label: "5s" },
    { value: 10, label: "10s" },
    { value: 30, label: "30s" },
  ];
  const themeOpts: SelectOption[] = [
    { value: "dark",  label: T("themeDark") },
    { value: "light", label: T("themeLight") },
  ];
  const langOpts: SelectOption[] = [
    { value: "en", label: "English" },
    { value: "vi", label: "Tiếng Việt" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-title">{T("settingsTitle")}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body settings-body">

          {/* ── Appearance ── */}
          <div className="settings-section">
            <div className="settings-section-title">{T("sectionAppearance")}</div>

            <div className="settings-row">
              <label>{T("labelTheme")}</label>
              <Select
                value={theme}
                options={themeOpts}
                onChange={(v) => { if (v !== theme) onToggleTheme(); }}
                minWidth={110}
              />
            </div>

            <div className="settings-row">
              <label>{T("labelLanguage")}</label>
              <Select
                value={uiLang}
                options={langOpts}
                onChange={(v) => onSetUiLang(v as UILang)}
                minWidth={130}
              />
            </div>
          </div>

          {/* ── Editor ── */}
          <div className="settings-section">
            <div className="settings-section-title">{T("sectionEditor")}</div>

            <div className="settings-row">
              <label>{T("labelFontSize")} — {fontSize}px</label>
              <div className="font-size-control">
                <button
                  className="fs-btn"
                  onClick={() => onSetFontSize(Math.max(10, fontSize - 1))}
                  title="-1"
                >－</button>
                <input
                  type="range"
                  min={10}
                  max={24}
                  value={fontSize}
                  onChange={(e) => onSetFontSize(Number(e.target.value))}
                  className="fs-slider"
                />
                <button
                  className="fs-btn"
                  onClick={() => onSetFontSize(Math.min(24, fontSize + 1))}
                  title="+1"
                >＋</button>
              </div>
            </div>
          </div>

          {/* ── Compiler ── */}
          <div className="settings-section">
            <div className="settings-section-title">{T("sectionCompiler")}</div>

            <div className="settings-row">
              <label>{T("labelCompiler")}</label>
              <Select
                value={settings.compilerChoice}
                options={compilerOpts}
                onChange={(v) => set("compilerChoice", v as CompilerChoice)}
                minWidth={110}
              />
            </div>

            <div className="settings-row">
              <label>{T("labelCompilerPath")}</label>
              <input
                type="text"
                value={settings.compilerPath}
                onChange={(e) => set("compilerPath", e.target.value)}
                placeholder={T("labelCompilerPathPlaceholder")}
                className="settings-input"
              />
            </div>
          </div>

          {/* ── Standards ── */}
          <div className="settings-section">
            <div className="settings-section-title">{T("sectionStandards")}</div>

            <div className="settings-row">
              <label>{T("labelCppStd")}</label>
              <Select
                value={settings.cppStandard}
                options={cppStdOpts}
                onChange={(v) => set("cppStandard", v as CppStandard)}
                minWidth={100}
              />
            </div>

            <div className="settings-row">
              <label>{T("labelCStd")}</label>
              <Select
                value={settings.cStandard}
                options={cStdOpts}
                onChange={(v) => set("cStandard", v as CStandard)}
                minWidth={100}
              />
            </div>
          </div>

          {/* ── Execution ── */}
          <div className="settings-section">
            <div className="settings-section-title">{T("sectionExecution")}</div>

            <div className="settings-row">
              <label>{T("labelTimeout")}</label>
              <Select
                value={settings.timeoutSecs}
                options={timeoutOpts}
                onChange={(v) => set("timeoutSecs", Number(v))}
                minWidth={80}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
