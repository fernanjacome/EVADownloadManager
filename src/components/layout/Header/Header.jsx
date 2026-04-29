import React, { useState } from "react";
import { FaUpload, FaTrash, FaLink, FaProjectDiagram } from "react-icons/fa";
import "./Header.css";
import ConfirmModal from "../../utils/ConfirmModal";
import { MdScreenshotMonitor } from "react-icons/md";
import { IoBuild, IoCodeSlash } from "react-icons/io5";

export default function Header({
  fileInfo,
  filePath,
  onLoadClick,
  onDeleteXml,
  hasXml,
  viewMode,
  setViewMode,
  visibleModules,
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  console.log(fileInfo);
  return (
    <header className="header-bar">
      <div className="header-title">
        <div className="header-title-group">
          {/* <FaRegSnowflake
            className={`xmas-icon ${snowEnabled ? "active" : ""}`}
            title="Feliz navidad 2025"
            onClick={toggleSnow}
          /> */}

          <h2 className="header-title-text">EVA Studio 2026</h2>
        </div>
        {fileInfo ? (
          <div className="header-file-info">
            <span>
              <strong>Archivo:</strong> {filePath}
            </span>
          </div>
        ) : (
          <span className="header-filename">Ningún archivo cargado</span>
        )}
      </div>

      <div className="header-actions">
        <button className="header-btn" onClick={onLoadClick}>
          <FaUpload /> Importar
        </button>
        {/* <button className="header-btn" disabled={!hasXml} onClick={onExport}>
          <FaFileExport /> Exportar
        </button> */}
        <button
          className="header-btn header-btn-danger"
          onClick={() => setShowConfirmDelete(true)}
          disabled={!hasXml}
        >
          <FaTrash /> Eliminar
        </button>
        <div className="mode-switch">
          {visibleModules?.code !== false && (
            <button
              className={`mode-btn ${viewMode === "code" ? "active" : ""}`}
              onClick={() => setViewMode("code")}
            >
              <IoCodeSlash /> XML
            </button>
          )}

          {visibleModules?.screens !== false && (
            <button
              className={`mode-btn ${viewMode === "screens" ? "active" : ""}`}
              onClick={() => setViewMode("screens")}
            >
              <MdScreenshotMonitor /> Pantallas
            </button>
          )}
          {visibleModules?.compiler !== false && (
            <button
              className={`mode-btn ${viewMode === "compiler" ? "active" : ""}`}
              onClick={() => setViewMode("compiler")}
            >
              <IoBuild /> Compilador
            </button>
          )}
          {visibleModules?.flows !== false && (
            <button
              className={`mode-btn ${viewMode === "flows" ? "active" : ""}`}
              onClick={() => setViewMode("flows")}
            >
              <FaProjectDiagram /> Flujos
            </button>
          )}
          {visibleModules?.remote !== false && (
            <button
              className={`mode-btn remote ${
                viewMode === "remote" ? "active" : ""
              }`}
              onClick={() => setViewMode("remote")}
            >
              <FaLink />
              Remoto
            </button>
          )}
        </div>

        <ConfirmModal
          isOpen={showConfirmDelete}
          onClose={() => setShowConfirmDelete(false)}
          onConfirm={onDeleteXml}
          title="Eliminar archivo"
          message="¿Seguro que quieres eliminar este archivo XML de la aplicación?"
        />
      </div>
    </header>
  );
}
