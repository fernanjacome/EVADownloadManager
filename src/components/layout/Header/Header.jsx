import React, { useState } from "react";
import { FaUpload, FaTrash } from "react-icons/fa";
import "./Header.css";
import ConfirmModal from "../../utils/ConfirmModal";
import { MdScreenshotMonitor } from "react-icons/md";
import { IoBuild, IoCodeSlash } from "react-icons/io5";
import { FaRegSnowflake } from "react-icons/fa6";

export default function Header({
  fileInfo,
  onLoadClick,
  onDeleteXml,
  hasXml,
  viewMode,
  setViewMode,

  snowEnabled,
  toggleSnow,
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <header className="header-bar">
      <div className="header-title">
        <div className="header-title-group">
          <FaRegSnowflake
            className={`xmas-icon ${snowEnabled ? "active" : ""}`}
            title="Feliz navidad 2025"
            onClick={toggleSnow}
          />

          <h2 className="header-title-text">EVA Download Manager</h2>
        </div>
        {fileInfo ? (
          <div className="header-file-info">
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
          <button
            className={`mode-btn ${viewMode === "code" ? "active" : ""}`}
            onClick={() => setViewMode("code")}
          >
            <IoCodeSlash /> XML
          </button>

          <button
            className={`mode-btn ${viewMode === "screens" ? "active" : ""}`}
            onClick={() => setViewMode("screens")}
          >
            <MdScreenshotMonitor /> Pantallas
          </button>
          <button
            className={`mode-btn ${viewMode === "compiler" ? "active" : ""}`}
            onClick={() => setViewMode("compiler")}
          >
            <IoBuild /> Compilador
          </button>
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
