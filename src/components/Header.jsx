import React, { useState } from "react";
import "./Header.css";

export default function Header({ onLoadClick }) {
  const [fileInfo, setFileInfo] = useState(null);

  return (
    <header className="header">
      <div className="title">
        <h2>EVA XML Manager</h2>
        {fileInfo ? (
          <div className="file-info">
            <span>
              <strong>Archivo:</strong> {fileInfo.name}
            </span>{" "}
            |{" "}
            <span>
              <strong>Tamaño:</strong> {fileInfo.size}
            </span>{" "}
            |{" "}
            <span>
              <strong>Última modificación:</strong> {fileInfo.lastModified}
            </span>
          </div>
        ) : (
          <span className="filename">Ningún archivo cargado</span>
        )}
      </div>

      <div className="actions">
        <button className="btn" onClick={onLoadClick}>
          Cargar XML
        </button>
        <button className="btn" disabled>
          Exportar
        </button>
        <label className="switch">
          <input type="checkbox" />
          <span className="slider"></span>
          <span className="label">Modo Texto</span>
        </label>
      </div>
    </header>
  );
}
