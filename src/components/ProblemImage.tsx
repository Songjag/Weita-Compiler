import React, { useRef, useState, useCallback } from "react";
import { makeT, UILang } from "../i18n/useI18n";

// ─── Image frame ──────────────────────────────────────────────────────────────

interface ProblemImageProps {
  image: string;
  onRemove: () => void;
  uiLang: UILang;
}

export const ProblemImage: React.FC<ProblemImageProps> = ({ image, onRemove, uiLang }) => {
  const [zoom, setZoom] = useState(1);
  const T = makeT(uiLang);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)));
  }, []);

  return (
    <div className="problem-frame">
      <div className="problem-header">
        <span className="problem-title">📄 {T("problemTitle")}</span>
        <div className="problem-actions">
          <button className="prob-btn" onClick={() => setZoom(1)} title={T("resetZoom")}>
            {Math.round(zoom * 100)}%
          </button>
          <button className="prob-btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>＋</button>
          <button className="prob-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>－</button>
          <button className="prob-btn prob-btn-remove" onClick={onRemove} title={T("removeImage")}>✕</button>
        </div>
      </div>

      <div className="problem-img-wrap" onWheel={handleWheel}>
        <img
          src={image}
          alt={T("problemTitle")}
          className="problem-img"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};

// ─── Drop Zone ────────────────────────────────────────────────────────────────

interface DropZoneProps {
  onImage: (src: string) => void;
  uiLang: UILang;
}

export const ProblemDropZone: React.FC<DropZoneProps> = ({ onImage, uiLang }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const T = makeT(uiLang);

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) onImage(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`problem-dropzone ${dragging ? "dragging" : ""}`}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      title={T("dragOrClick")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
      />
      <span className="dropzone-icon">🖼</span>
      <span className="dropzone-text">{T("addProblemImage")}</span>
    </div>
  );
};
