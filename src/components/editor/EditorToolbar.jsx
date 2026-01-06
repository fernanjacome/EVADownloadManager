import React, { useState } from "react";
import { FaSave, FaUndo, FaAlignLeft, FaCog } from "react-icons/fa";
import "./EditorToolbar.css";
import GeneralConfigPanel from "./GeneralConfigPanel";
import ConfirmModal from "../utils/ConfirmModal";
import { BsLayoutSplit } from "react-icons/bs";
import ToolbarButton from "./ToolbarButton";

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
  setNotification,
  setSplitView,
  splitView,
}) {
  const [openPanel, setOpenPanel] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  return (
    <>
      <div className="editor-toolbar">
        <ToolbarButton
          icon={<FaSave />}
          label="Guardar"
          onClick={onSave}
          disabled={!canSave}
          title="Guardar (Ctrl+S)"
        />

        {viewMode === "code" && (
          <ToolbarButton
            icon={<FaAlignLeft />}
            label="Formatear"
            onClick={onFormat}
            title="Formatear XML"
          />
        )}

        <ToolbarButton
          icon={<FaCog />}
          label="General"
          onClick={() => setOpenPanel(true)}
        />

        <ToolbarButton
          icon={<BsLayoutSplit />}
          label={splitView ? "Una pantalla" : "Dividir"}
          onClick={() => setSplitView(!splitView)}
        />
        <ToolbarButton
          icon={<FaUndo />}
          label="Restaurar original"
          onClick={() => setShowConfirmRestore(true)}
          disabled={!canRestoreOriginal}
          title="Restaurar original"
        />

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
      <ConfirmModal
        isOpen={showConfirmRestore}
        onClose={() => setShowConfirmRestore(false)}
        onConfirm={onRestoreOriginal}
        title="Restaurar archivo"
        message="¿Seguro que quieres restaurar el archivo al estado original? Perderás los cambios no guardados."
      />
    </>
  );
}
