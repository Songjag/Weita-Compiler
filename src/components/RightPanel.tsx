import React from "react";
import { RunResult } from "../types";
import { ProblemImage, ProblemDropZone } from "./ProblemImage";
import { makeT, UILang } from "../i18n/useI18n";

interface RightPanelProps {
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

  return (
    <div className="right-panel" style={{ width, minWidth: width, maxWidth: width }}>
      {problemImage && (
        <ProblemImage
          image={problemImage}
          onRemove={() => onSetProblemImage(null)}
          uiLang={uiLang}
        />
      )}

      <div className="panel-tabs">
        <span className="panel-title">{T("io")}</span>
        <div className="panel-tabs-spacer" />

        {!problemImage && (
          <ProblemDropZone onImage={onSetProblemImage} uiLang={uiLang} />
        )}

        <button className="panel-clear-btn" onClick={onClear}>
          ✕ {T("clear")}
        </button>
      </div>

      <IOView
        stdin={stdin}
        onStdinChange={onStdinChange}
        runResult={runResult}
        consoleOutput={consoleOutput}
        isRunning={isRunning}
        uiLang={uiLang}
      />
    </div>
  );
};

// ─── I/O View ─────────────────────────────────────────────────────────────────

interface IOViewProps {
  stdin: string;
  onStdinChange: (v: string) => void;
  runResult: RunResult | null;
  consoleOutput: string;
  isRunning: boolean;
  uiLang: UILang;
}

const IOView: React.FC<IOViewProps> = ({ stdin, onStdinChange, runResult, consoleOutput, isRunning, uiLang }) => {
  const T = makeT(uiLang);
  return (
    <div className="io-view">
      <section className="io-section">
        <div className="output-label">{T("inputStdin")}</div>
        <textarea
          className="stdin-textarea"
          value={stdin}
          onChange={(e) => onStdinChange(e.target.value)}
          placeholder={T("inputHint")}
          spellCheck={false}
        />
      </section>

      {isRunning && <div className="running-indicator"><span className="spinner" /> {T("running")}</div>}

      {(runResult || consoleOutput) && (
        <section className="io-section">
          <div className="output-label">{T("outputStdout")}</div>
          <pre className="output-pre stdout io-output">
            {consoleOutput || "(no output)"}
          </pre>
        </section>
      )}

      {runResult?.stderr && (
        <section className="io-section">
          <div className="output-label error-label">
            {runResult.status === "COMPILE_ERROR" ? T("compileError") : T("stderr")}
          </div>
          <pre className="output-pre stderr io-output">{runResult.stderr}</pre>
        </section>
      )}

      {!isRunning && !runResult && !consoleOutput && <div className="console-empty">{T("pressRunHint")}</div>}
    </div>
  );
};
