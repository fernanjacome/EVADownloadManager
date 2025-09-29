import React, { useState } from "react";
import {
  FaSave,
  FaUndo,
  FaEdit,
  FaEye,
  FaAlignLeft,
  FaCog,
} from "react-icons/fa";
import "./EditorToolbar.css";

export default function EditorToolbar({
  viewMode,
  editMode,
  setEditMode,
  onSave,
  onRestoreOriginal,
  onFormat,
  canSave,
  canRestoreOriginal,
  dirty,
  xmlDoc,
  setXmlDoc,
  setCode,
  setNotification, // 👈 se pasa desde App
  markDirty, // 👈 para marcar cambios
  generalCommit, // 👈 ref para exponer commits de General
}) {
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="editor-toolbar">
      {/* Guardar siempre */}
      <button
        className="toolbar-btn toolbar-btn-save"
        onClick={onSave}
        disabled={!canSave}
      >
        <FaSave /> Guardar
      </button>

      {/* Configuración General → abre modal */}
      <button
        className="toolbar-btn toolbar-btn-config"
        onClick={() => setOpenModal(true)}
      >
        <FaCog /> Configuración
      </button>

      {/* En modo code → Lectura/Edición */}
      {viewMode === "code" && (
        <button
          className="toolbar-btn toolbar-btn-toggle"
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? (
            <>
              <FaEye /> Lectura
            </>
          ) : (
            <>
              <FaEdit /> Edición
            </>
          )}
        </button>
      )}

      {/* En modo code → Formatear */}
      {viewMode === "code" && (
        <button
          className="toolbar-btn toolbar-btn-format"
          onClick={onFormat}
          disabled={!editMode}
        >
          <FaAlignLeft /> Formatear
        </button>
      )}

      {/* Restaurar → aplica siempre */}
      <button
        className="toolbar-btn toolbar-btn-restore"
        onClick={onRestoreOriginal}
        disabled={!canRestoreOriginal}
      >
        <FaUndo /> Restaurar original
      </button>

      {dirty && <span className="toolbar-dirty">● Cambios sin guardar</span>}
    </div>
  );
}
