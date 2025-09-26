import React, { useState } from "react";
import "./Header.css";

export default function Header({ onXmlLoaded }) {
  const [fileInfo, setFileInfo] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileInfo({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      lastModified: new Date(file.lastModified).toLocaleString(),
    });

    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(reader.result, "text/xml");
      onXmlLoaded(xmlDoc);
    };
    reader.readAsText(file);
  };

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
        <label className="btn">
          Cargar XML
          <input type="file" accept=".xml" hidden onChange={handleFileUpload} />
        </label>

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
