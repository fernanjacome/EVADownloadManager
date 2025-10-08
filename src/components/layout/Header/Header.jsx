import React, { useState } from "react";
import {
  FaUpload,
  FaFileExport,
  FaTrash,
  FaCode,
  FaThLarge,
} from "react-icons/fa";
import "./Header.css";
import ConfirmModal from "../../utils/ConfirmModal";

export default function Header({
  fileInfo,
  onLoadClick,
  onDeleteXml,
  hasXml,
  onExport,
  viewMode,
  setViewMode,
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  return (
    <header className="header-bar">
      <div className="header-title">
        <h2 className="header-title-text">EVA Download Manager</h2>
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
        <button className="header-btn" disabled={!hasXml} onClick={onExport}>
          <FaFileExport /> Exportar
        </button>
        <button
          className="header-btn header-btn-danger"
          onClick={() => setShowConfirmDelete(true)}
          disabled={!hasXml}
        >
          <FaTrash /> Eliminar
        </button>
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
