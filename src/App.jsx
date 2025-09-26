import React, { useState, useMemo } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import Notification from "./components/Notification";
import "./App.css";

export default function App() {
  const [xmlDoc, setXmlDoc] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [notification, setNotification] = useState(null);

  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState(""); // archivo cargado
  const [savedCode, setSavedCode] = useState(""); // último guardado

  const dirty = useMemo(() => code !== savedCode, [code, savedCode]);

  const handleLoadXml = (doc) => {
    const serialized = new XMLSerializer().serializeToString(doc);
    setXmlDoc(doc);
    setCode(serialized);
    setOriginalCode(serialized);
    setSavedCode(serialized);
    setEditMode(false);
  };

  const handleSave = () => {
    try {
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(code, "text/xml");

      if (newDoc.getElementsByTagName("parsererror").length > 0) {
        setNotification({ type: "error", message: "XML inválido." });
        return;
      }

      if (!newDoc.documentElement) {
        setNotification({ type: "error", message: "Estructura XML inválida." });
        return;
      }

      setXmlDoc(newDoc);
      setSavedCode(code);
      setNotification({ type: "success", message: "Cambios guardados." });
    } catch (e) {
      setNotification({
        type: "error",
        message: "Error inesperado al guardar.",
      });
    }
  };

  const handleRestoreSaved = () => {
    setCode(savedCode);
    setNotification({
      type: "info",
      message: "Restaurado al último guardado.",
    });
  };

  const handleRestoreOriginal = () => {
    setCode(originalCode);
    setNotification({
      type: "info",
      message: "Restaurado al archivo original.",
    });
  };

  return (
    <div className="app">
      <Header
        onXmlLoaded={handleLoadXml}
        editMode={editMode}
        setEditMode={setEditMode}
      />

      <div className="workspace">
        <Sidebar
          xmlDoc={xmlDoc}
          onSelect={(id) => {
            setHighlightId(id);
            setTimeout(() => setHighlightId(null), 0);
          }}
        />

        <Editor
          code={code}
          onChange={setCode}
          highlightId={highlightId}
          editMode={editMode}
          setEditMode={setEditMode}
          onSave={handleSave}
          onRestoreSaved={handleRestoreSaved}
          onRestoreOriginal={handleRestoreOriginal}
          canSave={editMode && dirty}
          canRestoreSaved={editMode && dirty}
          canRestoreOriginal={editMode && code !== originalCode}
          dirty={dirty}
        />
      </div>

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
