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
import GeneralConfigPanel from "./GeneralConfigPanel"; // 👈 nuevo

export default function EditorToolbar({
  viewMode,
  onSave,
  onRestoreOriginal,
  onFormat,
  canSave,
  canRestoreOriginal,
  dirty,
  xmlDoc,
  setXmlDoc,
  setCode,
  markDirty,
  setNotification,
}) {
  const [openPanel, setOpenPanel] = useState(false);

  return (
    <>
      <div className="editor-toolbar">
        <button
          className="toolbar-btn toolbar-btn-save"
          onClick={onSave}
          disabled={!canSave}
        >
          <FaSave /> Guardar
        </button>

        {viewMode === "code" && (
          <button className="toolbar-btn toolbar-btn-format" onClick={onFormat}>
            <FaAlignLeft /> Formatear
          </button>
        )}

        <button
          className="toolbar-btn toolbar-btn-restore"
          onClick={onRestoreOriginal}
          disabled={!canRestoreOriginal}
        >
          <FaUndo /> Restaurar original
        </button>
        <button
          className="toolbar-btn toolbar-btn-config"
          onClick={() => setOpenPanel(true)}
        >
          <FaCog /> Configuración
        </button>
        {dirty && <span className="toolbar-dirty">● Cambios sin guardar</span>}
      </div>

      {/* Panel de configuración */}
      {openPanel && (
        <GeneralConfigPanel
          xmlDoc={xmlDoc}
          setXmlDoc={setXmlDoc}
          setCode={setCode}
          onClose={() => setOpenPanel(false)}
          setNotification={setNotification} // 🔹 pasa el notifier
        />
      )}
    </>
  );
}
