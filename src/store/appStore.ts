import { useState, useCallback, useEffect } from "react";
import {
  Language,
  CompilerSettings,
  DEFAULT_SETTINGS,
  ToolchainInfo,
  ToolchainStatus,
  RunResult,
  DownloadProgress,
} from "../types";
import { UILang } from "../i18n/useI18n";

export type Theme = "dark" | "light";
export type { UILang };

const DEFAULT_CPP_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
`;

const DEFAULT_C_CODE = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`;

export function useAppStore() {
  // ── Editor state ──────────────────────────────────────────
  const [language, setLanguage] = useState<Language>("cpp");
  const [code, setCode] = useState<string>(DEFAULT_CPP_CODE);

  const [stdin, setStdin] = useState<string>("");
  const [activeRightTab, setActiveRightTab] = useState<"console" | "io">("console");

  // ── Run state ─────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string>("");

  // ── Toolchain state ───────────────────────────────────────
  const [toolchain, setToolchain] = useState<ToolchainInfo>({
    status: "CHECKING",
    compiler: "",
    version: "",
    location: "",
  });
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // ── Settings ─────────────────────────────────────────────
  const [settings, setSettings] = useState<CompilerSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showToolchainModal, setShowToolchainModal] = useState<boolean>(false);

  // ── Problem image ─────────────────────────────────────────
  // Lưu base64 vào localStorage để giữ qua restart
  const [problemImage, setProblemImageState] = useState<string | null>(() => {
    return localStorage.getItem("wc-problem-image") ?? null;
  });

  const setProblemImage = useCallback((src: string | null) => {
    setProblemImageState(src);
    if (src) localStorage.setItem("wc-problem-image", src);
    else localStorage.removeItem("wc-problem-image");
  }, []);

  // ── UI Language ───────────────────────────────────────────
  const [uiLang, setUiLangState] = useState<UILang>(() => {
    const saved = localStorage.getItem("wc-lang");
    return (saved === "en" || saved === "vi") ? saved : "en";
  });
  const setUiLang = useCallback((lang: UILang) => {
    setUiLangState(lang);
    localStorage.setItem("wc-lang", lang);
  }, []);

  // ── Font size ─────────────────────────────────────────────
  const [fontSize, setFontSizeState] = useState<number>(() => {
    return Number(localStorage.getItem("wc-fontsize") ?? "14");
  });
  const setFontSize = useCallback((size: number) => {
    setFontSizeState(size);
    localStorage.setItem("wc-fontsize", String(size));
  }, []);

  // ── Theme ─────────────────────────────────────────────────
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("lc-theme") as Theme) ?? "dark";
  });

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("lc-theme", next);
      return next;
    });
  }, []);

  // Apply theme class to <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ── Actions ───────────────────────────────────────────────
  const changeLanguage = useCallback(
    (lang: Language) => {
      setLanguage(lang);
      if (lang === "cpp" && code === DEFAULT_C_CODE) {
        setCode(DEFAULT_CPP_CODE);
      } else if (lang === "c" && code === DEFAULT_CPP_CODE) {
        setCode(DEFAULT_C_CODE);
      }
    },
    [code]
  );

  const updateToolchainStatus = useCallback(
    (status: ToolchainStatus, extra?: Partial<ToolchainInfo>) => {
      setToolchain((prev) => ({ ...prev, status, ...extra }));
    },
    []
  );

  const appendConsole = useCallback((text: string) => {
    setConsoleOutput((prev) => prev + text);
  }, []);

  const clearConsole = useCallback(() => {
    setConsoleOutput("");
    setRunResult(null);
  }, []);

  return {
    // editor
    language,
    setLanguage,
    changeLanguage,
    code,
    setCode,
    // io
    stdin,
    setStdin,
    activeRightTab,
    setActiveRightTab,
    // run
    isRunning,
    setIsRunning,
    runResult,
    setRunResult,
    consoleOutput,
    setConsoleOutput,
    appendConsole,
    clearConsole,
    // toolchain
    toolchain,
    setToolchain,
    updateToolchainStatus,
    downloadProgress,
    setDownloadProgress,
    // settings
    settings,
    setSettings,
    showSettings,
    setShowSettings,
    showToolchainModal,
    setShowToolchainModal,
    // problem image
    problemImage,
    setProblemImage,
    // theme
    theme,
    toggleTheme,
    // ui language
    uiLang,
    setUiLang,
    // font size
    fontSize,
    setFontSize,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
