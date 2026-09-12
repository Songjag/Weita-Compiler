import React from "react";
import { RunResult, RunStatus } from "../types";
import { ProblemImage, ProblemDropZone } from "./ProblemImage";
import { makeT, UILang } from "../i18n/useI18n";

interface RightPanelProps {
  activeTab: "console" | "io";
  onTabChange: (tab: "console" | "io") => void;
  stdin: string;
  onStdinChange: (val: string) => void;
  runResult: RunResult | null;
  consoleOutput: string;
  isRunning: boolean;
  onClear: () => void;
  problemImage: string | null;
  onSetProblemImage: (src: string | null) => void;
  uiLang: UILang;
  width: number;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  activeTab,
  onTabChange,
  stdin,
  onStdinChange,
  runResult,
  consoleOutput,
  isRunning,
  onClear,
  problemImage,
  onSetProblemImage,
  uiLang,
  width,
}) => {
  const T = makeT(uiLang);
  const hasImage = problemImage !== null;

  return (
    <div className="right-panel" style={{ width, minWidth: width, maxWidth: width }}>

      {/* ── Image frame ── */}
      {hasImage && (
        <ProblemImage
          image={problemImage}
          onRemove={() => onSetProblemImage(null)}
          uiLang={uiLang}
        />
      )}

      {/* ── Console/IO section ── */}
      <div className={`panel-bottom ${hasImage ? "has-frame" : ""}`}>
        <div className="panel-tabs">
          <button
            className={`panel-tab ${activeTab === "console" ? "active" : ""}`}
            onClick={() => onTabChange("console")}
          >
            {T("console")}
          </button>
          <button
            className={`panel-tab ${activeTab === "io" ? "active" : ""}`}
            onClick={() => onTabChange("io")}
          >
            {T("io")}
          </button>
          <div className="panel-tabs-spacer" />

          {/* DropZone — hiện khi chưa có ảnh */}
          {!hasImage && (
            <ProblemDropZone
              onImage={onSetProblemImage}
              uiLang={uiLang}
            />
          )}

          <button className="panel-clear-btn" onClick={onClear}>
            ✕ {T("clear")}
          </button>
        </div>

        {activeTab === "console" ? (
          <ConsoleView
            runResult={runResult}
            consoleOutput={consoleOutput}
            isRunning={isRunning}
            uiLang={uiLang}
          />
        ) : (
          <IOView
            stdin={stdin}
            onStdinChange={onStdinChange}
            runResult={runResult}
            uiLang={uiLang}
          />
        )}
      </div>
    </div>
  );
};

// ─── Console ──────────────────────────────────────────────────────────────────

interface ConsoleViewProps {
  runResult: RunResult | null;
  consoleOutput: string;
  isRunning: boolean;
  uiLang: UILang;
}

const ConsoleView: React.FC<ConsoleViewProps> = ({ runResult, consoleOutput, isRunning, uiLang }) => {
  const T = makeT(uiLang);

  const BADGE: Record<RunStatus, { label: () => string; cls: string }> = {
    SUCCESS:               { label: () => T("badgeSuccess"),       cls: "badge-success" },
    COMPILE_ERROR:         { label: () => T("badgeCompileError"),  cls: "badge-error"   },
    RUNTIME_ERROR:         { label: () => T("badgeRuntimeError"),  cls: "badge-error"   },
    TIMEOUT:               { label: () => T("badgeTimeout"),       cls: "badge-warn"    },
    OUTPUT_LIMIT_EXCEEDED: { label: () => T("badgeOutputLimit"),   cls: "badge-warn"    },
    PROCESS_START_FAILED:  { label: () => T("badgeProcessFailed"), cls: "badge-error"   },
    UNKNOWN_ERROR:         { label: () => T("badgeError"),         cls: "badge-error"   },
    VALUE_ERROR:           { label: () => T("badgeError"),         cls: "badge-error"   },
  };

  const badge = runResult ? BADGE[runResult.status] : null;

  return (
    <div className="console-view">
      {isRunning && (
        <div className="running-indicator">
          <span className="spinner" /> {T("running")}
        </div>
      )}
      {(consoleOutput || runResult?.stdout) && (
        <section className="output-section">
          <div className="output-label">{T("output")}</div>
          <pre className="output-pre stdout">{consoleOutput || runResult?.stdout}</pre>
        </section>
      )}
      {runResult?.stderr && (
        <section className="output-section">
          <div className="output-label error-label">
            {runResult.status === "COMPILE_ERROR" ? T("compileError") : T("stderr")}
          </div>
          <pre className="output-pre stderr">{runResult.stderr}</pre>
        </section>
      )}
      {runResult && badge && (
        <div className="console-footer">
          <span className={`badge ${badge.cls}`}>{badge.label()}</span>
          {runResult.exit_code !== null && runResult.status === "SUCCESS" && (
            <span className="meta">{T("exitCode")} {runResult.exit_code}</span>
          )}
          <span className="meta">{runResult.execution_time_ms} {T("executionTime")}</span>
        </div>
      )}
      {!isRunning && !runResult && !consoleOutput && (
        <div className="console-empty">{T("pressRunHint")}</div>
      )}
    </div>
  );
};

// ─── I/O ──────────────────────────────────────────────────────────────────────

interface IOViewProps {
  stdin: string;
  onStdinChange: (v: string) => void;
  runResult: RunResult | null;
  uiLang: UILang;
}

const IOView: React.FC<IOViewProps> = ({ stdin, onStdinChange, runResult, uiLang }) => {
  const T = makeT(uiLang);
  return (
    <div className="io-view">
      <section className="io-section">
        <div className="output-label">{T("inputStdin")}</div>
        <textarea
          className="stdin-textarea"
          value={stdin}
          onChange={(e) => onStdinChange(e.target.value)}
          placeholder={T("inputPlaceholder")}
          spellCheck={false}
        />
      </section>
      {runResult && (
        <section className="io-section">
          <div className="output-label">{T("outputStdout")}</div>
          <pre className="output-pre stdout io-output">
            {runResult.stdout || "(no output)"}
          </pre>
        </section>
      )}
    </div>
  );
};
