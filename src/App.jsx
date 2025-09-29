import React, { useState, useMemo, useRef } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CodeEditor from "./components/CodeEditor";
import CardsEditor from "./components/CardsEditor";
import EditorToolbar from "./components/EditorToolbar"; // 👈 nuevo
import Notification from "./components/Notification";
import EmptyState from "./components/EmptyState";
import "./App.css";
import { serializeXML, formatXml, validateUniqueIds } from "./utils/xmlUtils";

export default function App() {
  const [xmlDoc, setXmlDoc] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [savedCode, setSavedCode] = useState("");

  const [viewMode, setViewMode] = useState("code"); // code | cards
  const fileInputRef = useRef(null);

  const dirty = useMemo(() => code !== savedCode, [code, savedCode]);

  // --- Handlers (cargar, guardar, restaurar, exportar) ---
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
      const doc = parser.parseFromString(reader.result, "text/xml");
      handleLoadXml(doc);
    };
    reader.readAsText(file);

    e.target.value = "";
  };

  const handleLoadXml = (doc) => {
    const errors = validateUniqueIds(doc);
    if (errors.length > 0) {
      setNotification({
        type: "error",
        message: "Se encontraron IDs duplicados:\n" + errors.join("\n"),
      });
      return;
    }

    const serialized = serializeXML(doc);
    setXmlDoc(doc);
    setCode(serialized);
    setOriginalCode(serialized);
    setSavedCode(serialized);
    setEditMode(false);

    setNotification({ type: "success", message: "XML cargado correctamente." });
  };

  const handleDeleteXml = () => {
    setXmlDoc(null);
    setFileInfo(null);
    setCode("");
    setOriginalCode("");
    setSavedCode("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setNotification({ type: "info", message: "Archivo XML eliminado." });
  };

  const handleSave = () => {
    try {
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(code, "text/xml");

      if (newDoc.getElementsByTagName("parsererror").length > 0) {
        setNotification({ type: "error", message: "XML inválido." });
        return;
      }

      const errors = validateUniqueIds(newDoc);
      if (errors.length > 0) {
        setNotification({
          type: "error",
          message: "IDs duplicados:\n" + errors.join("\n"),
        });
        return;
      }
      setXmlDoc(newDoc);
      setSavedCode(code);

      setNotification({ type: "success", message: "Cambios guardados." });
    } catch {
      setNotification({
        type: "error",
        message: "Error inesperado al guardar.",
      });
    }
  };

  const handleRestoreOriginal = () => {
    setCode(originalCode);
    setNotification({
      type: "info",
      message: "Restaurado al archivo original.",
    });
  };

  const handleExport = () => {
    try {
      const blob = new Blob([code], { type: "application/xml;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileInfo?.name || "archivo.xml";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setNotification({
        type: "success",
        message: "XML exportado correctamente.",
      });
    } catch {
      setNotification({ type: "error", message: "Error al exportar el XML." });
    }
  };

  return (
    <div className="app">
      <Header
        fileInfo={fileInfo}
        onLoadClick={() => fileInputRef.current?.click()}
        onDeleteXml={handleDeleteXml}
        hasXml={!!xmlDoc}
        onExport={handleExport}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="workspace">
        <Sidebar
          xmlDoc={xmlDoc}
          onSelect={(id) => {
            setHighlightId(id);
            setTimeout(() => setHighlightId(null), 0);
          }}
        />

        {!xmlDoc ? (
          <EmptyState onLoadClick={() => fileInputRef.current?.click()} />
        ) : (
          <div className="editor-wrapper">
            {/* 🔹 Toolbar centralizada */}
            <EditorToolbar
              viewMode={viewMode}
              editMode={editMode}
              setEditMode={setEditMode}
              onSave={handleSave}
              onRestoreOriginal={handleRestoreOriginal}
              onFormat={
                viewMode === "code"
                  ? () => {
                      const formatted = formatXml(code);
                      if (formatted) setCode(formatted);
                    }
                  : null
              }
              canSave={viewMode === "code" ? editMode && dirty : dirty}
              canRestoreOriginal={editMode && code !== originalCode}
              dirty={dirty}
              xmlDoc={xmlDoc}
              setXmlDoc={setXmlDoc}
              setCode={setCode}
              setNotification={setNotification}
              markDirty={() => setCode(code + " ")}
            />

            {viewMode === "code" ? (
              <CodeEditor
                code={code}
                onChange={setCode}
                highlightId={highlightId}
                editMode={editMode}
                onSave={handleSave}
                canSave={editMode && dirty}
              />
            ) : (
              <CardsEditor
                xmlDoc={xmlDoc}
                markDirty={() => setCode(code + " ")}
              />
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xml"
        hidden
        onChange={handleFileUpload}
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
