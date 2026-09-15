import React from "react";

interface ImagePreviewProps {
  fileName: string;
  source: string;
  onClose: () => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ fileName, source, onClose }) => (
  <div className="image-preview-pane">
    <div className="image-preview-toolbar">
      <span>{fileName}</span>
      <button onClick={onClose} title="Đóng ảnh">×</button>
    </div>
    <div className="image-preview-canvas">
      <img src={source} alt={fileName} />
    </div>
  </div>
);
