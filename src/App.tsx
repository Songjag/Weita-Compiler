import React, { useEffect, useCallback, useRef, useState } from "react";
import { useAppStore } from "./store/appStore";
import { Topbar } from "./components/Topbar";
import { EditorPane } from "./components/EditorPane";
import { RightPanel } from "./components/RightPanel";
import { StatusBar } from "./components/StatusBar";
import { ToolchainModal } from "./components/ToolchainModal";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  checkToolchain,
  runCode,
  stopProcess,
  installToolchain,
  listenDownloadProgress,
} from "./hooks/useTauri";
import { RunResult } from "./types";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export const App: React.FC = () => {
  const store = useAppStore();

  // ── Resizable panel width ─────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    return Number(localStorage.getItem("wc-panel-width") ?? "380");
  });
  const isDragging = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const onResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      // Width = khoảng cách từ chuột đến cạnh phải của main
      const newWidth = rect.right - e.clientX;
      const clamped = Math.min(700, Math.max(220, newWidth));
      setPanelWidth(clamped);
      localStorage.setItem("wc-panel-width", String(clamped));
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ── Boot: check toolchain ─────────────────────────────────────────────────
  useEffect(() => {
    store.updateToolchainStatus("CHECKING");
    checkToolchain()
      .then((info) => {
        store.setToolchain(info);
        if (info.status === "NOT_FOUND") store.setShowToolchainModal(true);
      })
      .catch(() => store.updateToolchainStatus("ERROR"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Download progress listener ────────────────────────────────────────────
  useEffect(() => {
    const unlisten = listenDownloadProgress((progress) => {
      store.setDownloadProgress(progress);
      if (progress.phase === "done") {
        checkToolchain().then((info) => {
          store.setToolchain(info);
          store.setDownloadProgress(null);
        });
      } else if (progress.phase === "error") {
        store.updateToolchainStatus("ERROR");
        store.setDownloadProgress(null);
      }
    });
    return unlisten;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Run ───────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    store.clearConsole();
    store.setIsRunning(true);
    try {
      const result: RunResult = await runCode({
        language: store.language,
        source_code: store.code,
        stdin: store.stdin,
        timeout_secs: store.settings.timeoutSecs,
        cpp_standard: store.settings.cppStandard,
        c_standard: store.settings.cStandard,
        compiler_path: store.settings.compilerPath,
      });
      store.setRunResult(result);
      let out = "";
      if (result.stdout) out += result.stdout;
      if (result.stderr && result.status === "COMPILE_ERROR")
        out += (out ? "\n" : "") + result.stderr;
      store.setConsoleOutput(out);
    } catch (err) {
      const msg = String(err);
      store.setConsoleOutput("Error: " + msg);
      store.setRunResult({
        status: "UNKNOWN_ERROR", stdout: "", stderr: msg,
        exit_code: null, execution_time_ms: 0,
      });
    } finally {
      store.setIsRunning(false);
    }
  }, [store]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    try { await stopProcess(); } catch { /* ignore */ }
    store.setIsRunning(false);
  }, [store]);

  // ── Save (Ctrl+S) ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const defaultName = store.language === "cpp" ? "main.cpp" : "main.c";
    try {
      const filePath = await save({
        title: "Save file",
        defaultPath: defaultName,
        filters: store.language === "cpp"
          ? [{ name: "C++ Source", extensions: ["cpp", "cc", "cxx", "h", "hpp"] }]
          : [{ name: "C Source",   extensions: ["c", "h"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, store.code);
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [store.language, store.code]);

  // ── Install toolchain ─────────────────────────────────────────────────────
  const handleInstallToolchain = useCallback(async () => {
    store.updateToolchainStatus("DOWNLOADING");
    store.setDownloadProgress({ downloaded_bytes: 0, total_bytes: 0, phase: "downloading", message: "Starting…" });
    try {
      await installToolchain();
    } catch {
      store.updateToolchainStatus("ERROR");
      store.setDownloadProgress(null);
    }
  }, [store]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <Topbar
        language={store.language}
        onLanguageChange={store.changeLanguage}
        isRunning={store.isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onSettings={() => store.setShowSettings(true)}
        toolchain={store.toolchain}
        theme={store.theme}
        onToggleTheme={store.toggleTheme}
        uiLang={store.uiLang}
      />

      <main className="app-main" ref={mainRef}>
        <EditorPane
          language={store.language}
          code={store.code}
          onChange={store.setCode}
          onRun={handleRun}
          onStop={handleStop}
          onSave={handleSave}
          isRunning={store.isRunning}
          theme={store.theme}
          fontSize={store.fontSize}
        />

        <div
          className="resizer"
          onMouseDown={onResizerMouseDown}
          title="Kéo để thay đổi kích thước"
        />

        <RightPanel
          activeTab={store.activeRightTab}
          onTabChange={store.setActiveRightTab}
          stdin={store.stdin}
          onStdinChange={store.setStdin}
          runResult={store.runResult}
          consoleOutput={store.consoleOutput}
          isRunning={store.isRunning}
          onClear={store.clearConsole}
          problemImage={store.problemImage}
          onSetProblemImage={store.setProblemImage}
          uiLang={store.uiLang}
          width={panelWidth}
        />
      </main>

      <StatusBar
        toolchain={store.toolchain}
        runResult={store.runResult}
        isRunning={store.isRunning}
        onToolchainClick={() => store.setShowToolchainModal(true)}
        uiLang={store.uiLang}
      />

      {store.showToolchainModal && (
        <ToolchainModal
          toolchain={store.toolchain}
          downloadProgress={store.downloadProgress}
          onInstall={handleInstallToolchain}
          onClose={() => store.setShowToolchainModal(false)}
          uiLang={store.uiLang}
        />
      )}

      {store.showSettings && (
        <SettingsPanel
          settings={store.settings}
          onChange={store.setSettings}
          onClose={() => store.setShowSettings(false)}
          theme={store.theme}
          onToggleTheme={store.toggleTheme}
          uiLang={store.uiLang}
          onSetUiLang={store.setUiLang}
          fontSize={store.fontSize}
          onSetFontSize={store.setFontSize}
        />
      )}
    </div>
  );
};
