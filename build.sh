#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  WCompiler — Build AppImage → ~/APPLICATION
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

APP_NAME="WCompiler"
APP_VERSION="0.1.0"
RELEASE_DIR="$ROOT/src-tauri/target/release"
BUNDLE_DIR="$RELEASE_DIR/bundle/appimage"
APPDIR="$BUNDLE_DIR/${APP_NAME}.AppDir"
OUTPUT_APPIMAGE="$BUNDLE_DIR/${APP_NAME}_${APP_VERSION}_amd64.AppImage"
DEST_DIR="$ROOT/application"
LEGACY_DEST_DIR="$ROOT/APPLICATION"
CACHE_DIR="$HOME/.cache/tauri"

# ─────────────────────────────────────────────────────────────
echo ""
echo "━━━ WCompiler Build ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Prerequisites ──────────────────────────────────────
echo ""
echo "▶ [1/9] Checking prerequisites…"
for cmd in node npm cargo npx curl; do
  command -v "$cmd" >/dev/null 2>&1 \
    && echo "  ✓ $cmd $(${cmd} --version 2>&1 | head -1)" \
    || { echo "  ✗ $cmd not found"; exit 1; }
done

# ── 2. npm install ────────────────────────────────────────
echo ""
echo "▶ [2/9] Installing npm dependencies…"
npm install --prefer-offline 2>&1 | tail -2

# ── 3. Build frontend ─────────────────────────────────────
echo ""
echo "▶ [3/9] Building frontend…"
npm run build
echo "  ✓ dist/ ready"

# ── 4. Build Rust release binary ─────────────────────────
echo ""
echo "▶ [4/9] Building Rust binary (release)…"
echo "  (first build: a few minutes; subsequent: ~30s)"
echo ""

# Build binary only, skip the Tauri bundler (we handle AppImage ourselves).
npx tauri build --no-bundle

# Locate binary
BINARY=""
for name in wcompiler localcompiler WCompiler LocalCompiler; do
  candidate="$RELEASE_DIR/$name"
  if [ -f "$candidate" ] && [ -x "$candidate" ]; then
    BINARY="$candidate"
    break
  fi
done

[ -z "$BINARY" ] && { echo "  ✗ Binary not found in $RELEASE_DIR"; exit 1; }
echo "  ✓ Binary: $(basename "$BINARY") ($(du -sh "$BINARY" | cut -f1))"

# ── 5. Download tools ─────────────────────────────────────
echo ""
echo "▶ [5/9] Preparing AppImage tools…"
mkdir -p "$CACHE_DIR"

LINUXDEPLOY="$CACHE_DIR/linuxdeploy-x86_64.AppImage"
APPIMAGETOOL="$CACHE_DIR/appimagetool-x86_64.AppImage"

if [ ! -f "$LINUXDEPLOY" ]; then
  echo "  Downloading linuxdeploy…"
  curl -fsSL -o "$LINUXDEPLOY" \
    "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage"
fi
chmod +x "$LINUXDEPLOY"
echo "  ✓ linuxdeploy ready"

if [ ! -f "$APPIMAGETOOL" ]; then
  echo "  Downloading appimagetool…"
  curl -fsSL -o "$APPIMAGETOOL" \
    "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
fi
chmod +x "$APPIMAGETOOL"
echo "  ✓ appimagetool ready"

# ── 6. Build AppDir ───────────────────────────────────────
echo ""
echo "▶ [6/9] Building AppDir…"

rm -rf "$APPDIR"
mkdir -p \
  "$APPDIR/usr/bin" \
  "$APPDIR/usr/share/applications" \
  "$APPDIR/usr/share/icons/hicolor/128x128/apps" \
  "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Binary
cp "$BINARY" "$APPDIR/usr/bin/wcompiler"
chmod +x "$APPDIR/usr/bin/wcompiler"

# .desktop
cat > "$APPDIR/usr/share/applications/wcompiler.desktop" << 'DESK'
[Desktop Entry]
Name=WCompiler
Exec=wcompiler
Icon=wcompiler
Type=Application
Categories=Development;IDE;
Comment=Local C/C++ IDE
DESK
cp "$APPDIR/usr/share/applications/wcompiler.desktop" "$APPDIR/wcompiler.desktop"

# Icons
ICON128="$ROOT/src-tauri/icons/128x128.png"
ICON256="$ROOT/src-tauri/icons/128x128@2x.png"
[ -f "$ICON256" ] || ICON256="$ICON128"
cp "$ICON128" "$APPDIR/usr/share/icons/hicolor/128x128/apps/wcompiler.png"
cp "$ICON256" "$APPDIR/usr/share/icons/hicolor/256x256/apps/wcompiler.png"
cp "$ICON128" "$APPDIR/wcompiler.png"

# AppRun
ln -sf usr/bin/wcompiler "$APPDIR/AppRun"

echo "  ✓ AppDir ready"

# ── 7. Deploy shared libraries ────────────────────────────
echo ""
echo "▶ [7/9] Deploying shared libraries…"

# linuxdeploy may print strip warnings — ignore them, check exit separately
"$LINUXDEPLOY" --appdir "$APPDIR" 2>&1 | grep -Ev "Strip call|^$" || true

echo "  ✓ Libraries deployed"

# ── 8. Package AppImage ───────────────────────────────────
echo ""
echo "▶ [8/9] Packaging AppImage…"

rm -f "$OUTPUT_APPIMAGE"
ARCH=x86_64 "$APPIMAGETOOL" "$APPDIR" "$OUTPUT_APPIMAGE" 2>&1 \
  | grep -Ev "^$|squashfs|^\[" || true

[ -f "$OUTPUT_APPIMAGE" ] || { echo "  ✗ AppImage not created"; exit 1; }
chmod +x "$OUTPUT_APPIMAGE"
echo "  ✓ AppImage: $(du -sh "$OUTPUT_APPIMAGE" | cut -f1)"

# ── 9. Copy → ~/APPLICATION ──────────────────────────────
echo ""
echo "▶ [9/9] Copying to ~/APPLICATION…"

mkdir -p "$DEST_DIR"
FINAL="$DEST_DIR/${APP_NAME}_${APP_VERSION}_amd64.AppImage"
cp "$OUTPUT_APPIMAGE" "$FINAL"
chmod +x "$FINAL"

# Keep the legacy uppercase output directory in sync for existing launchers.
mkdir -p "$LEGACY_DEST_DIR"
cp "$OUTPUT_APPIMAGE" "$LEGACY_DEST_DIR/${APP_NAME}_${APP_VERSION}_amd64.AppImage"
chmod +x "$LEGACY_DEST_DIR/${APP_NAME}_${APP_VERSION}_amd64.AppImage"

# ─────────────────────────────────────────────────────────────
echo ""
echo "━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Output : $FINAL"
echo "  Size   : $(du -sh "$FINAL" | cut -f1)"
echo ""
echo "  Run    : $FINAL"
echo "  Or     : ./run.sh"
echo ""
