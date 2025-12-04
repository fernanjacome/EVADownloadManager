import React, { useState, useMemo, useRef, useEffect } from "react";

import "./App.css";
import { serializeXML, formatXml, validateUniqueIds } from "./utils/xmlUtils";
import TitleBar from "./components/layout/TitleBar/TitleBar";
import Header from "./components/layout/Header/Header";
import Sidebar from "./components/layout/Sidebar/Sidebar";
import EmptyState from "./components/editor/EmptyState";
import EditorToolbar from "./components/editor/EditorToolbar";
import CodeEditor from "./components/editor/CodeEditor";
import NotificationContainer from "./components/utils/NotificationContainer";
import ConfirmModal from "./components/utils/ConfirmModal";

export default function App() {
  const [xmlDoc, setXmlDoc] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [splitView, setSplitView] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [activeEditor, setActiveEditor] = useState("left"); // "left" | "right"
  const [theme, setTheme] = useState("dark"); // "dark" | "light"

  const [viewMode, setViewMode] = useState("code"); // code | cards

  const [filePath, setFilePath] = useState(null);

  const dirty = useMemo(() => code !== savedCode, [code, savedCode]);

  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;

      const newWidth = e.clientX;
      if (newWidth > 120 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };

    const stopResize = () => {
      isResizingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("light-theme", theme === "light");
  }, [theme]);

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

  const handleOpenFile = async () => {
    const path = await window.electronAPI.openFileDialog();
    if (!path) return;

    setFilePath(path);

    //👇 obtener info real del SO
    const infoResult = await window.electronAPI.getFileInfo(path);
    let sizeKb = "";
    let lastMod = "";

    console.log(infoResult);

    if (infoResult.success) {
      sizeKb = (infoResult.info.size / 1024).toFixed(1) + " KB";
      lastMod = new Date(infoResult.info.lastModified).toLocaleString();
    }

    //👇 leer archivo
    const result = await window.electronAPI.readFile(path);
    if (!result.success) {
      addNotification("error", "No se pudo leer el archivo");
      return;
    }

    const xmlText = result.data;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    handleLoadXml(doc, {
      name: path,
      size: infoResult.info.size,
      lastModified: infoResult.info.lastModified,
    });
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
        size: file.size ? (file.size / 1024).toFixed(1) + " KB" : "",
        lastModified: file.lastModified
          ? new Date(file.lastModified).toLocaleString()
          : "",
      });

      if (window.electronAPI) {
        window.electronAPI.setWindowTitle(
          `${filePath.split("\\").pop()} - EVA Download Manager`
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

    if (window.electronAPI) {
      window.electronAPI.setWindowTitle("EVA Download Manager");
    }

    addNotification("info", "Archivo XML eliminado.");
  };
  const handleSave = async () => {
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

      // ✔️ TU LÓGICA ORIGINAL
      setXmlDoc(newDoc);
      setSavedCode(code);
      console.log(window.electronAPI?.writeFile);
      console.log(filePath);
      if (filePath && window.electronAPI?.writeFile) {
        const result = await window.electronAPI.writeFile(filePath, code);

        if (!result.success) {
          addNotification(
            "error",
            "No se pudo guardar en disco: " + result.error
          );
          return;
        }

        // Opcional: notificación visual específica para guardado real
        addNotification("success", `Archivo actualizado: ${filePath}`);
      } else {
        // Si no hay filePath → el archivo NO proviene de carga real
        addNotification(
          "info",
          "Cambios actualizados en memoria, pero el archivo no tiene ruta en disco."
        );
      }
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
  useEffect(() => {
    const handleAppClose = () => {
      if (code !== savedCode) {
        setShowConfirmExit(true); // abre modal personalizado
        return;
      }
      // si no hay cambios pendientes → cerrar directamente
      if (window.electronAPI) {
        window.electronAPI.windowControl("close");
      } else {
        window.close();
      }
    };

    window.addEventListener("tryAppClose", handleAppClose);
    return () => window.removeEventListener("tryAppClose", handleAppClose);
  }, [code, savedCode]);

  useEffect(() => {
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    window.addEventListener("drop", async (e) => {
      prevent(e);

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      // ruta real en disco — NO PROTEGIDA POR SANDBOX
      const realPath = file.path;
      setFilePath(realPath);

      // obtener metadata real
      const infoResult = await window.electronAPI.getFileInfo(realPath);
      let sizeKb = "";
      let lastMod = "";

      if (infoResult.success) {
        sizeKb = (infoResult.info.size / 1024).toFixed(1) + " KB";
        lastMod = new Date(infoResult.info.lastModified).toLocaleString();
      }

      // leer contenido
      const result = await window.electronAPI.readFile(realPath);
      if (!result.success) {
        addNotification("error", "No se pudo leer el archivo");
        return;
      }

      const xmlText = result.data;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");

      handleLoadXml(doc, {
        name: path.split("\\").pop(),
        size: infoResult.info.size,
        lastModified: infoResult.info.lastModified,
      });
    });

    return () => {
      window.removeEventListener("drop", prevent);
      window.removeEventListener("dragover", prevent);
    };
  }, []);

  return (
    <div className="app">
      <TitleBar
        fileName={filePath?.split("\\").pop()}
        theme={theme}
        setTheme={setTheme}
      />
      <Header
        fileInfo={fileInfo}
        onLoadClick={handleOpenFile}
        onDeleteXml={handleDeleteXml}
        hasXml={!!xmlDoc}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="workspace">
        <Sidebar
          xmlDoc={xmlDoc}
          onSelect={(id) => {
            setHighlightId({ target: activeEditor, id });
            setTimeout(() => setHighlightId(null), 0);
          }}
          style={{ width: sidebarWidth }}
        />

        <div
          className="sidebar-resizer"
          onMouseDown={() => (isResizingRef.current = true)}
        />

        {!xmlDoc ? (
          <EmptyState onLoadClick={handleOpenFile} onNewClick={handleNewXml} />
        ) : (
          <div className="editor-wrapper full">
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
              setSplitView={setSplitView}
              splitView={splitView}
              theme={theme}
              setTheme={setTheme}
            />

            {viewMode === "code" ? (
              <div className={`editor-wrapper ${splitView ? "split" : ""}`}>
                <CodeEditor
                  code={code}
                  onChange={setCode}
                  highlightId={highlightId}
                  onSave={handleSave}
                  canSave={dirty}
                  editable={true}
                  onFocus={(key) => setActiveEditor(key)}
                  syncKey="left"
                  theme={theme}
                />

                {splitView && (
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    highlightId={highlightId}
                    editable={true}
                    onFocus={(key) => setActiveEditor(key)}
                    syncKey="right"
                    theme={theme}
                  />
                )}
              </div>
            ) : (
              <p>Work on it!!</p>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showConfirmExit}
        onClose={() => setShowConfirmExit(false)}
        onConfirm={() => {
          setShowConfirmExit(false);
          if (window.electronAPI) {
            window.electronAPI.windowControl("close");
          } else {
            window.close();
          }
        }}
        title="Salir de la aplicación"
        message="Tienes cambios sin guardar. Si cierras ahora, podrías perderlos."
      />

      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
    </div>
  );
}
