import React, { useCallback, useState } from "react";
import { FaFileUpload, FaPlus } from "react-icons/fa";
import "./EmptyState.css";
import { TbChristmasTreeFilled } from "react-icons/tb";

export default function EmptyState({
  onLoadClick,
  onNewClick,
  onFileDrop,
  snowEnabled,
  toggleSnow,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const fakeEvent = { target: { files: e.dataTransfer.files } };
        onFileDrop(fakeEvent);
        e.dataTransfer.clearData();
      }
    },
    [onFileDrop]
  );

  return (
    <div
      className={`empty-state drop-zone ${isDragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <TbChristmasTreeFilled
        className="empty-icon snow"
        onClick={toggleSnow}
        title="Feliz navidad 2025"
      />

      {/* // <svg
        //   xmlns="http://www.w3.org/2000/svg"
        //   width="120"
        //   height="120"
        //   fill="none"
        //   viewBox="0 0 24 24"
        //   stroke="currentColor"
        //   className="empty-icon"
        // >
        //   <path
        //     strokeLinecap="round"
        //     strokeLinejoin="round"
        //     strokeWidth="1.5"
        //     d="M12 4v16m8-8H4"
        //   />
        // </svg> */}

      <h2>Arrastra un archivo XML aquí</h2>
      <p>
        {isDragging && <span className="drag-hint"> Suelta para cargar</span>}
      </p>

      <div className="empty-actions">
        <button className="btn-primary" onClick={onLoadClick}>
          <FaFileUpload /> Cargar XML
        </button>
        <button className="btn-secondary" onClick={onNewClick}>
          <FaPlus /> Nuevo XML
        </button>
      </div>
    </div>
  );
}
