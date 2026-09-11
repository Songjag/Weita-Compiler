import React, { useState, useRef, useEffect, useCallback } from "react";

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (val: string) => void;
  className?: string;
  minWidth?: number;
}

/**
 * Fully custom dropdown — uses only CSS variables so it matches
 * whatever data-theme is on <html>. No native <select> appearance.
 */
export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  className = "",
  minWidth = 90,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.value) === String(value));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keyboard navigation
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" && open) {
        e.preventDefault();
        const idx = options.findIndex((o) => String(o.value) === String(value));
        if (idx < options.length - 1) onChange(String(options[idx + 1].value));
      }
      if (e.key === "ArrowUp" && open) {
        e.preventDefault();
        const idx = options.findIndex((o) => String(o.value) === String(value));
        if (idx > 0) onChange(String(options[idx - 1].value));
      }
    },
    [open, options, value, onChange]
  );

  return (
    <div
      ref={ref}
      className={`wc-select ${open ? "open" : ""} ${className}`}
      style={{ minWidth }}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setOpen(false)}
    >
      {/* Trigger */}
      <div className="wc-select-trigger" onMouseDown={() => setOpen((o) => !o)}>
        <span className="wc-select-value">{selected?.label ?? ""}</span>
        <span className="wc-select-arrow">{open ? "▲" : "▼"}</span>
      </div>

      {/* Dropdown list */}
      {open && (
        <div className="wc-select-dropdown">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`wc-select-option ${String(opt.value) === String(value) ? "selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(String(opt.value));
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
