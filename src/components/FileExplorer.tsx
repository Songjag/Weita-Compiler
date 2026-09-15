import React from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readFile, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { BuildResult, WorkspaceFile } from "../types";

interface FileExplorerProps {
  workspacePath: string | null;
  files: WorkspaceFile[];
  activePath: string;
  onWorkspaceChange: (path: string, files: WorkspaceFile[]) => void;
  onFilesChange: (files: WorkspaceFile[]) => void;
  onOpenFile: (path: string, content: string) => void;
  onOpenImage: (path: string, dataUrl: string) => void;
  onBuild: () => Promise<BuildResult | null>;
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
};

function imageMimeType(path: string): string | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_TYPES[extension] ?? null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function collectFiles(root: string, folder = root): Promise<WorkspaceFile[]> {
  const entries = await readDir(folder);
  const files: WorkspaceFile[] = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const path = `${folder}/${entry.name}`;
    const relativePath = path.slice(root.length + 1);
    if (entry.isDirectory) {
      files.push({ path, name: entry.name, relativePath, kind: "directory" });
      if (entry.name === "node_modules") continue;
      try {
        files.push(...await collectFiles(root, path));
      } catch {
        // Keep the folder visible when its contents are protected.
      }
    } else if (entry.isFile) {
      files.push({ path, name: entry.name, relativePath, kind: "file" });
    }
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  workspacePath, files, activePath, onWorkspaceChange, onFilesChange, onOpenFile, onOpenImage, onBuild,
}) => {
  const [message, setMessage] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selectedDirectory, setSelectedDirectory] = React.useState<string | null>(workspacePath);
  const [showMore, setShowMore] = React.useState(false);

  const showError = (error: unknown) => {
    setMessage(`Không thể đọc: ${String(error)}`);
  };

  const handleCreateFile = async () => {
    if (!workspacePath) return setMessage("Hãy mở thư mục trước");
    try {
      const folder = selectedDirectory ?? workspacePath;
      const selected = await save({
        title: "Tạo file mới",
        defaultPath: `${folder}/untitled.cpp`,
        filters: [{ name: "Source files", extensions: ["cpp", "c", "h", "hpp", "txt"] }],
      });
      if (!selected) return;
      await writeTextFile(selected, "");
      const name = selected.split("/").pop() ?? selected;
      const relativePath = selected.startsWith(`${workspacePath}/`)
        ? selected.slice(workspacePath.length + 1)
        : name;
      const nextFiles = [...files, { path: selected, name, relativePath, kind: "file" as const }]
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
      onFilesChange(nextFiles);
      onOpenFile(selected, "");
      setMessage(`Đã tạo ${name}`);
    } catch (error) {
      showError(error);
    }
  };

  const handleOpenFile = async () => {
    try {
      const selected = await open({ multiple: false, directory: false });
      if (typeof selected !== "string") return;
      const mimeType = imageMimeType(selected);
      if (mimeType) {
        const bytes = await readFile(selected);
        onOpenImage(selected, `data:${mimeType};base64,${bytesToBase64(bytes)}`);
      } else {
        onOpenFile(selected, await readTextFile(selected));
      }
    } catch (error) {
      showError(error);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({ multiple: false, directory: true });
      if (typeof selected !== "string") return;
      const nextFiles = await collectFiles(selected);
      setExpanded(new Set([selected]));
      setSelectedDirectory(selected);
      onWorkspaceChange(selected, nextFiles);
    } catch (error) {
      showError(error);
    }
  };

  const handleRefresh = async () => {
    if (!workspacePath) return setMessage("Hãy mở thư mục trước");
    try {
      onFilesChange(await collectFiles(workspacePath));
      setMessage("Đã làm mới Explorer");
    } catch (error) {
      showError(error);
    }
  };

  const handleFileClick = async (file: WorkspaceFile) => {
    if (file.kind === "directory") {
      setSelectedDirectory(file.path);
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(file.path)) next.delete(file.path);
        else next.add(file.path);
        return next;
      });
      return;
    }
    try {
      const mimeType = imageMimeType(file.path);
      if (mimeType) {
        const bytes = await readFile(file.path);
        onOpenImage(file.path, `data:${mimeType};base64,${bytesToBase64(bytes)}`);
      } else {
        onOpenFile(file.path, await readTextFile(file.path));
      }
    } catch (error) {
      showError(error);
    }
  };

  const isVisible = (file: WorkspaceFile) => {
    if (!workspacePath || file.relativePath === file.name) return true;
    const parts = file.relativePath.split("/");
    let parent = workspacePath;
    for (let index = 0; index < parts.length - 1; index += 1) {
      parent += `/${parts[index]}`;
      if (!expanded.has(parent)) return false;
    }
    return true;
  };

  const handleBuild = async () => {
    if (!workspacePath) return setMessage("Chưa chọn thư mục");
    const result = await onBuild();
    if (result) setMessage(result.success ? "Build thành công" : "Build thất bại");
  };

  const collapseAll = () => {
    setExpanded(new Set());
    setShowMore(false);
  };

  return <aside className="file-explorer">
    <div className="explorer-heading">
      <span>EXPLORER</span>
      <div className="explorer-toolbar">
        <button className="explorer-tool" onClick={handleOpenFile} title="Mở file" aria-label="Mở file"><span>▤</span><em>Mở file</em></button>
        <button className="explorer-tool" onClick={handleCreateFile} title="Tạo file mới trong folder đang chọn" aria-label="Tạo file mới"><span>＋</span><em>Tạo file</em></button>
        <button className="explorer-tool" onClick={handleOpenFolder} title="Mở folder" aria-label="Mở folder"><span>▣</span><em>Mở folder</em></button>
        <button className="explorer-tool" onClick={handleRefresh} title="Làm mới Explorer" aria-label="Làm mới Explorer"><span>↻</span><em>Làm mới</em></button>
        <button className="explorer-tool" onClick={handleBuild} disabled={!workspacePath} title="Build workspace" aria-label="Build workspace"><span>▶</span><em>Build</em></button>
        <button className="explorer-tool explorer-more" title="Thao tác khác" aria-label="Thao tác khác" onClick={() => setShowMore((visible) => !visible)}><span>•••</span><em>Thao tác khác</em></button>
        {showMore && <div className="explorer-menu">
          <button onClick={() => { setShowMore(false); void handleRefresh(); }}>↻ Làm mới</button>
          <button onClick={collapseAll}>⌃ Thu gọn tất cả thư mục</button>
        </div>}
      </div>
    </div>
    <div className="explorer-workspace" title={workspacePath ?? "Chưa mở workspace"}>
      <span className="workspace-chevron">{workspacePath ? "⌄" : "›"}</span>
      <span className="workspace-folder">▰</span>
      <span className="explorer-root">{workspacePath ? workspacePath.split("/").pop() : "Mở thư mục để bắt đầu"}</span>
    </div>
    <div className="explorer-files">
      {files.length === 0 ? <div className="explorer-empty">Mở một file hoặc thư mục để bắt đầu</div> : files.filter(isVisible).map((file) => {
        const depth = file.relativePath.split("/").length - 1;
        const isExpanded = expanded.has(file.path);
        return <button key={file.path} className={`explorer-file ${file.path === activePath ? "active" : ""}`} style={{ paddingLeft: `${8 + depth * 14}px` }} onClick={() => handleFileClick(file)}>
          <span className="file-kind">{file.kind === "directory" ? (isExpanded ? "▾" : "▸") : "·"}</span>{file.name}
        </button>;
      })}
    </div>
    {message && <div className="explorer-message">{message}</div>}
  </aside>;
};