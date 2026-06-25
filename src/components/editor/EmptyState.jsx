import React, { useCallback, useRef, useState } from "react";
import { FaFileUpload, FaPlus } from "react-icons/fa";
import "./EmptyState.css";

export default function EmptyState({ onLoadClick, onNewClick, onFileDrop }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounter.current = 0;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      const file = files[0];

      if (!file.name.toLowerCase().endsWith(".xml")) {
        alert("Solo se permiten archivos XML");
        return;
      }

      onFileDrop(files);
      e.dataTransfer.clearData();
    },
    [onFileDrop]
  );

  return (
    <div
      className={`empty-state drop-zone${isDragging ? " dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="120"
        height="120"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="empty-icon"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M12 4v16m8-8H4"
        />
      </svg>

      <h2>Carga un archivo XML</h2>

      <p className="empty-hint">
        También puedes crear uno nuevo desde una plantilla
      </p>

      <div className="empty-actions">
        <button className="btn-primary" onClick={onLoadClick}>
          <FaFileUpload /> Cargar XML
        </button>
        <button className="btn-secondary" onClick={onNewClick}>
          <FaPlus /> Plantilla
        </button>
      </div>
    </div>
  );
}
