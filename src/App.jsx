import React, { useState, useMemo, useRef, useEffect } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CodeEditor from "./components/CodeEditor";
import EditorToolbar from "./components/EditorToolbar";
import EmptyState from "./components/EmptyState";
import "./App.css";
import { serializeXML, formatXml, validateUniqueIds } from "./utils/xmlUtils";
import NotificationContainer from "./components/NotificationContainer";
import TitleBar from "./components/TitleBar/TitleBar";

export default function App() {
  const [xmlDoc, setXmlDoc] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [savedCode, setSavedCode] = useState("");

  const [viewMode, setViewMode] = useState("code"); // code | cards
  const fileInputRef = useRef(null);

  const dirty = useMemo(() => code !== savedCode, [code, savedCode]);
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Bloquea Ctrl/Cmd + +/- o Ctrl/Cmd + 0 (reset zoom)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  // --- Handlers (cargar, guardar, restaurar, exportar) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(reader.result, "text/xml");
      handleLoadXml(doc, file); // pasamos el file
    };
    reader.readAsText(file);

    e.target.value = "";
  };

  const handleLoadXml = (doc, file = null) => {
    const errors = validateUniqueIds(doc);
    if (errors.length > 0) {
      addNotification(
        "error",
        "Se encontraron IDs duplicados:\n" + errors.join("\n")
      );
      return;
    }

    const serialized = serializeXML(doc);
    setXmlDoc(doc);
    setCode(serialized);
    setOriginalCode(serialized);
    setSavedCode(serialized);

    if (file) {
      setFileInfo({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        lastModified: new Date(file.lastModified).toLocaleString(),
      });

      if (window.electronAPI) {
        window.electronAPI.setWindowTitle(
          `${file.name} - EVA Download Manager`
        );
      }
    } else {
      if (window.electronAPI) {
        window.electronAPI.setWindowTitle("EVA Download Manager");
      }
    }

    addNotification("success", "XML cargado correctamente.");
  };
  const handleNewXml = async () => {
    try {
      const url = new URL("../public/default.xml", import.meta.url).pathname;
      const response = await fetch(`file://${url}`);
      const text = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");

      setFileInfo({
        name: "default.xml",
        size: `${(text.length / 1024).toFixed(2)} KB`,
        lastModified: new Date().toLocaleString(),
      });

      handleLoadXml(doc);
    } catch (err) {
      addNotification("error", "Error al crear nuevo XML.");
      console.error(err);
    }
  };

  const handleDeleteXml = () => {
    setXmlDoc(null);
    setFileInfo(null);
    setCode("");
    setOriginalCode("");
    setSavedCode("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (window.electronAPI) {
      window.electronAPI.setWindowTitle("EVA Download Manager");
    }

    addNotification("info", "Archivo XML eliminado.");
  };

  const handleSave = () => {
    try {
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(code, "text/xml");
      const parserError = newDoc.getElementsByTagName("parsererror")[0];

      if (parserError) {
        const errorText = parserError.textContent || "XML inválido.";
        let message = "XML inválido.";

        const match = errorText.match(/line\s+(\d+).*column\s+(\d+)/i);
        if (match) {
          const line = parseInt(match[1], 10);
          const column = parseInt(match[2], 10);
          message = `Error de sintaxis en línea ${line}, columna ${column}`;
        } else {
          message = errorText.split("\n")[0];
        }

        addNotification("error", message);
        return;
      }

      const errors = validateUniqueIds(newDoc);
      if (errors.length > 0) {
        addNotification("error", "IDs duplicados:\n" + errors.join("\n"));
        return;
      }

      setXmlDoc(newDoc);
      setSavedCode(code);
      addNotification("success", "Cambios guardados.");
    } catch (e) {
      addNotification("error", "Error inesperado al guardar.");
    }
  };

  const handleRestoreOriginal = () => {
    try {
      const parser = new DOMParser();
      const restoredDoc = parser.parseFromString(originalCode, "text/xml");

      const parserError = restoredDoc.getElementsByTagName("parsererror")[0];
      if (parserError) {
        addNotification("error", "Error al restaurar: XML inválido.");
        return;
      }

      setXmlDoc(restoredDoc); // 🔹 refresca Sidebar y demás
      setCode(originalCode); // 🔹 refresca CodeEditor
      addNotification("info", "Restaurado al archivo original.");
    } catch {
      addNotification("error", "Error inesperado al restaurar.");
    }
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
      addNotification("success", "XML exportado correctamente.");
    } catch {
      addNotification("error", "Error al exportar el XML.");
    }
  };

  const addNotification = (type, message) => {
    setNotifications((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.type === type && last.message === message) {
          return prev;
        }
      }
      return [...prev, { id: crypto.randomUUID(), type, message }];
    });
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="app">
      <TitleBar fileName={fileInfo?.name} />
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
          <EmptyState
            onLoadClick={() => fileInputRef.current?.click()}
            onNewClick={handleNewXml}
            onFileDrop={handleFileUpload}
          />
        ) : (
          <div className="editor-wrapper">
            {/* 🔹 Toolbar centralizada */}
            <EditorToolbar
              viewMode={viewMode}
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
              canSave={viewMode === "code" ? dirty : dirty}
              canRestoreOriginal={code !== originalCode}
              dirty={dirty}
              xmlDoc={xmlDoc}
              setXmlDoc={setXmlDoc}
              setCode={setCode}
              setNotification={addNotification}
              markDirty={() => setCode(code + " ")}
            />

            {viewMode === "code" ? (
              <CodeEditor
                code={code}
                onChange={setCode}
                highlightId={highlightId}
                onSave={handleSave}
                canSave={dirty}
              />
            ) : (
              <p>Work on it!!</p>
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

      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
    </div>
  );
}
