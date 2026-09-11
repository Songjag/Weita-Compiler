# WCompiler

Local C/C++ IDE — Tauri 2 + React + TypeScript + Monaco Editor.

---

## Đổi tên app

Khi muốn đổi tên từ **WCompiler** sang tên khác, sửa các file sau:

### 1. `src-tauri/tauri.conf.json`
```json
{
  "productName": "WCompiler",        // ← đổi tên này (tên cửa sổ + tên bundle)
  "identifier": "dev.wcompiler.app", // ← đổi thành dev.<tênmới>.app
  "app": {
    "windows": [
      {
        "title": "WCompiler"         // ← đổi tên này (tiêu đề thanh title bar)
      }
    ]
  }
}
```

### 2. `src-tauri/Cargo.toml`
```toml
[package]
name = "wcompiler"       # ← đổi tên binary

default-run = "wcompiler"  # ← đổi theo

[[bin]]
name = "wcompiler"       # ← đổi theo
```

### 3. `src/i18n/language.json`
```json
{
  "en": { "appName": "WCompiler" },   // ← tên hiển thị trong UI (EN)
  "vi": { "appName": "WCompiler" }    // ← tên hiển thị trong UI (VI)
}
```

### 4. `package.json`
```json
{
  "name": "wcompiler"   // ← tên npm package (không bắt buộc nhưng nên đồng bộ)
}
```

### 5. `build.sh`
```bash
APP_NAME="WCompiler"    # ← tên file output AppImage
```

### 6. `src-tauri/src/toolchain/mod.rs`
```rust
// Thư mục lưu toolchain GCC
.join("WCompiler")      // ← đổi tên thư mục data (~/.local/share/<tên>)
```

---

## Checklist đổi tên nhanh

Tìm và thay thế toàn bộ (case-sensitive):

| Tìm | Thay bằng |
|-----|-----------|
| `WCompiler` | `TênMới` |
| `wcompiler` | `tênmới` |
| `dev.wcompiler.app` | `dev.tênmới.app` |

Dùng lệnh:
```bash
# Ví dụ đổi sang "MyIDE"
grep -rl "WCompiler" src src-tauri/src src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json build.sh \
  | xargs sed -i 's/WCompiler/MyIDE/g'

grep -rl "wcompiler" src src-tauri/src src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json build.sh \
  | xargs sed -i 's/wcompiler/myide/g'
```

---

## Build

```bash
# Build AppImage → application/
./build.sh

# Chạy bản release
./run.sh

# Chạy dev mode (hot-reload)
./run.sh --dev
```

---

## Cấu trúc project

```
AppCodeOneCompiler/
├── src/                        # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Topbar.tsx          # Thanh tiêu đề: logo, language, run/stop, theme
│   │   ├── EditorPane.tsx      # Monaco Editor (C/C++, IntelliSense, theme)
│   │   ├── RightPanel.tsx      # Console + I/O panel (resizable)
│   │   ├── StatusBar.tsx       # Thanh trạng thái dưới cùng
│   │   ├── SettingsPanel.tsx   # Modal cài đặt
│   │   ├── ToolchainModal.tsx  # Modal quản lý compiler
│   │   ├── ProblemImage.tsx    # Frame ảnh đề bài (drag & drop)
│   │   └── Select.tsx          # Custom dropdown (theo theme)
│   ├── i18n/
│   │   ├── language.json       # ← chuỗi UI (EN + VI) — sửa tên ở đây
│   │   └── useI18n.ts          # Hook dịch
│   ├── store/
│   │   └── appStore.ts         # State toàn app (theme, font, language...)
│   ├── hooks/
│   │   └── useTauri.ts         # Bridge gọi Tauri commands
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # Entry point
│   └── styles.css              # CSS (dark/light theme variables)
│
├── src-tauri/                  # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── main.rs             # Entry point Tauri
│   │   ├── commands.rs         # Tauri commands (check_toolchain, run_code...)
│   │   ├── runner.rs           # Compile + execute C/C++ (timeout, output limit)
│   │   └── toolchain/
│   │       ├── mod.rs          # Data dir path — đổi tên thư mục ở đây
│   │       ├── detector.rs     # Detect OS, arch, distro, compiler
│   │       ├── downloader.rs   # HTTP download + SHA-256 verify
│   │       ├── extractor.rs    # Giải nén zip/tar.xz/tar.gz
│   │       ├── installer.rs    # Flow cài đặt toolchain
│   │       └── cpp.rs          # Manifest URL/version + compiler flags
│   ├── Cargo.toml              # ← đổi tên binary ở đây
│   └── tauri.conf.json         # ← đổi productName + title ở đây
│
├── application/                # Output AppImage sau khi build
├── build.sh                    # ← đổi APP_NAME ở đây
├── run.sh                      # Script chạy app
└── README.md                   # File này
```

---

## Thêm ngôn ngữ UI mới

Mở `src/i18n/language.json`, copy block `"en"` và dịch:

```json
{
  "en": { ... },
  "vi": { ... },
  "ja": {              // ← thêm ngôn ngữ mới
    "appName": "WCompiler",
    "run": "実行",
    ...
  }
}
```

Sau đó trong `src/i18n/useI18n.ts` thêm `"ja"` vào type `UILang`:
```ts
export type UILang = "en" | "vi" | "ja";
```

---

## Thay đổi toolchain URL / version

Sửa file `src-tauri/src/toolchain/cpp.rs`:

```rust
pub const WINDOWS_X86_64: ToolchainEntry = ToolchainEntry {
    compiler: "mingw64-gcc",
    version: "14.2.0",      // ← đổi version
    url: "https://...",     // ← đổi URL download
    sha256: "abc123...",    // ← đổi hash SHA-256
    archive_type: ArchiveType::ZipFile,
};
```
