Tôi muốn xây dựng một Desktop IDE/Online Compiler chạy LOCAL, giao diện giống OneCompiler nhưng KHÔNG sử dụng API, KHÔNG AI, KHÔNG server.

STACK:
- Tauri 2
- Rust làm backend
- React + TypeScript làm frontend
- Monaco Editor
- Chỉ hỗ trợ C và C++
- Build sản phẩm cuối thành Windows .exe và Linux AppImage/deb nếu có thể

MỤC TIÊU:
Người dùng mở app lần đầu:
1. App tự phát hiện operating system và architecture.
2. Kiểm tra compiler C/C++ local.
3. Nếu compiler chưa tồn tại hoặc chưa được cấu hình:
   - tự động tải toolchain phù hợp
   - lưu vào thư mục riêng của app
   - giải nén nếu cần
   - cấu hình PATH/runtime cho process chạy compiler
4. Sau khi setup xong người dùng có thể viết code và nhấn Run.
5. Code được compile/run hoàn toàn LOCAL.

==================================================
1. HỖ TRỢ PLATFORM
==================================================

Ưu tiên:
- Windows x64
- Linux x64

Thiết kế code để sau này có thể mở rộng:
- Windows ARM64
- Linux ARM64

Khi app khởi động, Rust phải detect:

OS:
- Windows
- Linux

Architecture:
- x86_64
- aarch64

Không hard-code chỉ một platform.

Tạo module:

src-tauri/src/toolchain/
    mod.rs
    detector.rs
    downloader.rs
    extractor.rs
    installer.rs
    cpp.rs

==================================================
2. TOOLCHAIN MANAGEMENT
==================================================

Không yêu cầu người dùng phải tự cài GCC.

App phải có cơ chế:

detectCompiler()
→ compiler đã tồn tại?
→ nếu có:
      sử dụng compiler đó nếu hợp lệ
→ nếu không:
      download toolchain
      verify
      extract
      configure runtime
      test compiler
      save configuration

Ví dụ thư mục:

Windows:

%LOCALAPPDATA%/MyCompiler/
    toolchains/
        mingw64/
            bin/
                gcc.exe
                g++.exe
            ...
        llvm/
            bin/
                clang.exe
                clang++.exe

Linux:

~/.local/share/MyCompiler/
    toolchains/
        gcc/
        clang/

KHÔNG cài compiler vào System32 hoặc sửa PATH hệ thống nếu không cần thiết.

Ưu tiên sử dụng PATH riêng cho process của app:

PATH =
    toolchain/bin
    + existing PATH

Ví dụ Rust Command:

Command::new(gpp)
    .env("PATH", custom_path)
    ...

Không yêu cầu quyền Administrator nếu có thể tránh.

==================================================
3. WINDOWS TOOLCHAIN
==================================================

Trên Windows, ưu tiên một toolchain portable có thể:
- download
- extract
- chạy trực tiếp
- không cần installer
- không cần admin

Ưu tiên thiết kế provider:

WindowsToolchainProvider

Có thể sử dụng:
- MinGW-w64 portable
hoặc
- LLVM/Clang portable

Không tải file từ nguồn không xác định.

URL download phải được cấu hình tập trung trong code/config:

ToolchainManifest

Ví dụ concept:

{
    "platform": "windows",
    "arch": "x86_64",
    "compiler": "mingw64",
    "version": "...",
    "url": "...",
    "sha256": "..."
}

QUAN TRỌNG:
Không hard-code một URL download mà không kiểm tra.
Thiết kế hệ thống để version và URL có thể thay đổi.

Sau khi download:
1. lưu file vào cache
2. verify SHA-256
3. extract
4. tìm gcc.exe/g++.exe
5. chạy:

gcc --version
g++ --version

6. nếu thành công → đánh dấu toolchain READY.

Nếu archive có cấu trúc:

some-folder/
    bin/
    lib/
    include/

hãy tự động tìm thư mục chứa gcc.exe/g++.exe thay vì giả định chính xác root directory.

==================================================
4. LINUX TOOLCHAIN
==================================================

Linux phức tạp hơn Windows vì mỗi distro có package manager khác nhau.

KHÔNG tự ý dùng apt trên mọi Linux.

Detect distro từ:

/etc/os-release

Ví dụ:

Ubuntu/Debian
Arch
Fedora
openSUSE
...

Tạo abstraction:

LinuxToolchainProvider

Với Linux, ưu tiên:

1. Kiểm tra compiler có sẵn:

which gcc
which g++
which clang
which clang++

Nếu có compiler hợp lệ:
→ sử dụng compiler hệ thống.

Nếu không có:
→ xác định distro.

Có thể hỗ trợ package manager:

Debian/Ubuntu:
apt

Arch:
pacman

Fedora:
dnf

Nhưng KHÔNG chạy lệnh cài đặt với sudo một cách tự động mà không thông báo cho user.

Thiết kế flow:

Compiler missing
→ hiển thị UI:

"C/C++ compiler chưa được cài đặt."

Options:

[Install automatically]
[Choose compiler manually]

Nếu user chọn Install automatically:
→ chạy package manager phù hợp
→ kiểm tra gcc/g++
→ lưu trạng thái.

Nếu user không muốn package manager:
→ cho phép chọn toolchain portable/manual.

==================================================
5. C / C++ COMPILER
==================================================

Chỉ cần hỗ trợ:

C:
gcc

C++:
g++

Sau này có thể mở rộng:

clang
clang++

Language enum:

C
CPP

Mapping:

C:
    gcc

CPP:
    g++

KHÔNG cần Java, Rust, Python, Go ở phiên bản đầu tiên.

==================================================
6. COMPILER RUNNER
==================================================

Tạo Rust module:

runner.rs

API concept:

run_code(
    language,
    source_code,
    stdin,
    timeout
)

Flow:

source code
    ↓
create temporary directory
    ↓
write main.c / main.cpp
    ↓
compile
    ↓
if compile error:
    return stderr
    ↓
if compile success:
    execute binary
    ↓
provide stdin
    ↓
capture stdout
    ↓
capture stderr
    ↓
return result

Ví dụ C++:

g++ main.cpp -std=c++17 -O2 -pipe -o main

Ví dụ C:

gcc main.c -std=c17 -O2 -pipe -o main

Compiler flags phải được cấu hình thành constant/config để dễ thay đổi.

==================================================
7. TIMEOUT
==================================================

BẮT BUỘC có timeout.

Không được để:

while(true) {}

treo application.

Ví dụ default:

timeout = 3 seconds

Nếu process vượt quá timeout:

kill process
return:

status:
    "TIMEOUT"

Không block Tauri UI thread.

Process execution phải asynchronous.

==================================================
8. OUTPUT LIMIT
==================================================

BẮT BUỘC giới hạn stdout/stderr.

Ví dụ:

MAX_OUTPUT = 1 MB

Nếu chương trình spam output:

while(true)
    cout << "hello";

không được để app ăn RAM vô hạn.

Nếu vượt giới hạn:

kill process
return:

status:
    "OUTPUT_LIMIT_EXCEEDED"

==================================================
9. MEMORY / PROCESS SAFETY
==================================================

Thiết kế runner để có thể giới hạn:

- execution time
- stdout size
- stderr size
- process count nếu cần

Không chạy code bằng shell string kiểu:

sh -c "..."

hoặc:

cmd /c "..."

nếu không cần.

Ưu tiên truyền arguments trực tiếp vào Command.

Tránh command injection.

==================================================
10. STDIN / STDOUT / STDERR
==================================================

Frontend phải có:

Editor
Input
Console

Ví dụ UI:

┌───────────────────────────────┬───────────────────────┐
│                               │ Console | I/O         │
│                               │                       │
│       Monaco Editor           │ Input                 │
│                               │ ┌───────────────────┐ │
│       main.cpp                │ │ 10 20             │ │
│                               │ └───────────────────┘ │
│                               │                       │
│                               │ Output                │
│                               │ 30                    │
│                               │                       │
└───────────────────────────────┴───────────────────────┘

Input của user được truyền vào stdin.

stdout:
→ Output panel

stderr:
→ Console/error panel

Exit code:
→ hiển thị trong Console.

==================================================
11. TAURI COMMANDS
==================================================

Tạo Tauri commands rõ ràng:

check_toolchain()
install_toolchain()
get_toolchain_status()
run_code()
stop_process()

Frontend gọi:

invoke("check_toolchain")
invoke("install_toolchain")
invoke("run_code", {...})

Không expose filesystem/process API trực tiếp cho frontend nếu không cần.

Rust phải chịu trách nhiệm:
- filesystem
- process
- compiler
- toolchain
- download
- extraction

==================================================
12. DOWNLOAD SYSTEM
==================================================

Tạo downloader abstraction:

trait Downloader

Yêu cầu:
- progress callback
- cancellation
- retry
- timeout
- file size
- SHA-256 verification

Frontend phải hiển thị:

Downloading C/C++ toolchain
██████████████░░░░ 72%

Sau download:

Verifying...
Extracting...
Testing compiler...
Ready!

Nếu lỗi:

Download failed
Hash verification failed
Extraction failed
Compiler test failed

Không được đánh dấu toolchain READY nếu chưa chạy test thành công.

==================================================
13. TOOLCHAIN VERSION
==================================================

Không hard-code logic version rải rác trong code.

Tạo:

toolchain_manifest.rs

hoặc JSON:

toolchains.json

Ví dụ:

{
    "windows-x86_64": {
        "compiler": "mingw64",
        "version": "...",
        "url": "...",
        "sha256": "..."
    },
    "linux-x86_64": {
        "compiler": "system",
        "version": null
    }
}

Khi cập nhật compiler:
chỉ cần thay manifest.

==================================================
14. UI
==================================================

UI lấy cảm hứng từ OneCompiler nhưng KHÔNG copy branding.

Layout:

Topbar:
- App name
- Language selector
- Run button
- Stop button
- Settings

Main:
- Monaco Editor
- Right panel

Right panel:
- Console
- Input
- Output

Bottom:
- compiler status
- execution time
- memory nếu có
- exit code

Dark theme mặc định.

UI phải responsive khi resize cửa sổ.

Có resizable split pane.

==================================================
15. EDITOR
==================================================

Dùng Monaco Editor.

C++ configuration:

language:
    cpp

C configuration:

language:
    c

Hỗ trợ:
- syntax highlighting
- line number
- minimap toggle
- Ctrl+S
- Ctrl+Enter → Run
- Ctrl+C → stop process nếu đang chạy

Không cần language server ở version đầu tiên.

==================================================
16. SETTINGS
==================================================

Tạo Settings:

Compiler:
    Auto
    GCC
    Clang

C++ standard:
    C++17
    C++20
    C++23

C standard:
    C11
    C17

Timeout:
    1s
    3s
    5s
    custom

Compiler path:
    Auto
    Custom

Toolchain:
    Installed version
    Location
    Reinstall
    Remove

==================================================
17. FIRST RUN
==================================================

Khi app mở lần đầu:

App startup
    ↓
detect OS
    ↓
detect architecture
    ↓
check compiler
    ↓
compiler available?
    ├── YES → Ready
    │
    └── NO
          ↓
      show setup screen
          ↓
      Install C/C++ toolchain
          ↓
      download
          ↓
      verify
          ↓
      extract
          ↓
      test
          ↓
      Ready

==================================================
18. ERROR HANDLING
==================================================

Không panic application vì compiler lỗi.

Tất cả lỗi phải trả về frontend dưới dạng structured error:

{
    "type": "COMPILER_NOT_FOUND",
    "message": "...",
    "details": "..."
}

Các error type:

COMPILER_NOT_FOUND
DOWNLOAD_FAILED
HASH_MISMATCH
EXTRACT_FAILED
COMPILER_TEST_FAILED
COMPILE_ERROR
RUNTIME_ERROR
TIMEOUT
OUTPUT_LIMIT_EXCEEDED
PROCESS_START_FAILED
UNKNOWN_ERROR

Frontend render error đẹp trong Console.

==================================================
19. WINDOWS PATH
==================================================

KHÔNG mặc định sửa System PATH của Windows.

Ưu tiên:

App-managed PATH.

Ví dụ:

existing PATH
+
C:\Users\<user>\AppData\Local\MyCompiler\toolchains\mingw64\bin

chỉ truyền PATH này cho compiler/runtime process.

Nếu có tính năng "Add compiler to system PATH":
→ phải là OPTION trong Settings
→ yêu cầu user xác nhận
→ không tự động thay đổi system environment.

==================================================
20. CROSS PLATFORM
==================================================

Tất cả code filesystem phải sử dụng Rust std::path / tauri path APIs.

Không viết:

"C:\\..."

rải rác trong code.

Không viết:

"/home/user/..."

rải rác trong code.

Dùng platform-specific module khi thực sự cần.

==================================================
21. PROJECT QUALITY
==================================================

Tôi muốn code production-oriented.

Yêu cầu:
- clean architecture
- async Rust
- error handling bằng Result
- không unwrap() ở những chỗ có thể fail
- logging
- typed frontend/backend interfaces
- không duplicate code
- module rõ ràng
- comments cho phần xử lý OS/process
- README đầy đủ

==================================================
22. BUILD
==================================================

Cuối cùng project phải build được:

Windows:
    .exe
    installer

Linux:
    AppImage
    hoặc deb

Tauri bundler phải được cấu hình.

Đặc biệt kiểm tra:

- fresh Windows machine
- fresh Linux machine
- không có GCC
- app tự setup compiler
- compile C
- compile C++
- stdin
- stdout
- stderr
- timeout
- compile error

==================================================
23. QUAN TRỌNG VỀ SECURITY
==================================================

Code do user nhập sẽ được compile/run LOCAL.

Không coi source code là trusted.

Runner phải:
- timeout
- output limit
- kill process
- tránh shell injection
- dùng temporary directory
- cleanup temporary files
- không chạy với administrator/root
- không tự động sudo
- không sửa system PATH mặc định

Thiết kế architecture để sau này có thể thêm sandbox tốt hơn.

==================================================
24. IMPLEMENTATION ORDER
==================================================

Đừng viết toàn bộ project một lần.

Làm theo thứ tự:

STEP 1:
Tạo Tauri + React + TypeScript project.

STEP 2:
Làm UI giống IDE:
- topbar
- Monaco
- right panel
- console
- stdin
- output

STEP 3:
Implement Rust run_code() với compiler local.

STEP 4:
Implement C/C++ detection.

STEP 5:
Implement Windows portable toolchain downloader/extractor.

STEP 6:
Implement Linux compiler detection + distro detection.

STEP 7:
Implement toolchain status/install UI.

STEP 8:
Implement timeout/output limit/process kill.

STEP 9:
Implement Settings.

STEP 10:
Build Windows .exe installer.

Sau MỖI STEP:
- cung cấp code hoàn chỉnh
- chỉ rõ file nào được tạo/sửa
- giải thích cách chạy
- đưa command để test
- không chuyển sang STEP tiếp theo nếu STEP hiện tại chưa build được.

==================================================
25. OUTPUT FORMAT CHO AI CODING AGENT
==================================================

Khi bắt đầu coding:

1. Phân tích architecture.
2. Tạo project structure.
3. Liệt kê các dependency cần cài.
4. Implement STEP 1.
5. Đưa toàn bộ code của các file mới/thay đổi.
6. Đưa command để chạy.
7. Đưa command để build.
8. Đưa checklist test.

Không giả định compiler hoặc dependency đã tồn tại.

Nếu có nhiều lựa chọn toolchain Windows, hãy giải thích lựa chọn nào phù hợp nhất với mục tiêu portable/local IDE trước khi implement.

Ưu tiên giải pháp không cần quyền Administrator và không sửa System PATH.