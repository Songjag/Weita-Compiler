#!/usr/bin/env bash
#─────────────────────────────────────────────────────────────
#  WCompiler — Run script
#  Chạy bản dev (hot-reload) hoặc bản release đã build sẵn
#
#  Cách dùng:
#    ./run.sh          → chạy bản release (đã build)
#    ./run.sh --dev    → chạy dev mode (hot-reload, cần 2 terminal)
#    ./run.sh --build  → build trước rồi chạy release
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

MODE="release"
[ "${1:-}" = "--dev" ]   && MODE="dev"
[ "${1:-}" = "--build" ] && MODE="build-run"

# ── Tìm binary release ────────────────────────────────────
find_binary() {
  for name in wcompiler localcompiler WCompiler LocalCompiler; do
    BIN="$ROOT/src-tauri/target/release/$name"
    [ -f "$BIN" ] && echo "$BIN" && return
  done
  echo ""
}

case "$MODE" in

  # ── Release mode ────────────────────────────────────────
  release)
    BINARY=$(find_binary)
    if [ -z "$BINARY" ]; then
      echo "✗ Binary not found. Run ./build.sh first."
      exit 1
    fi
    echo "▶ Running WCompiler (release)…"
    echo "  Binary: $BINARY"
    echo ""
    exec "$BINARY"
    ;;

  # ── Dev mode (hot-reload) ────────────────────────────────
  dev)
    echo "━━━ WCompiler Dev Mode ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "▶ Starting Tauri dev (Vite + Rust watch)…"
    echo "  Ctrl+C to stop."
    echo ""
    command -v npx >/dev/null 2>&1 || { echo "✗ npx not found"; exit 1; }
    npm install --prefer-offline 2>&1 | tail -2
    exec npx tauri dev
    ;;

  # ── Build then run ───────────────────────────────────────
  build-run)
    echo "▶ Building first…"
    bash "$ROOT/build.sh"
    echo ""
    BINARY=$(find_binary)
    if [ -z "$BINARY" ]; then
      echo "✗ Binary not found after build."
      exit 1
    fi
    echo "▶ Running WCompiler…"
    exec "$BINARY"
    ;;

esac
