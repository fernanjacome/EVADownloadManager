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
import ScreensPanel from "./components/screens/ScreensPanel";
import CompilerForm from "./components/compiler/CompilerForm";

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
  const [snowEnabled, setSnowEnabled] = useState(false);
  const christmasAudioRef = useRef(null);
  const [screensFolderInput, setScreensFolderInput] = useState(
    localStorage.getItem("path_screens")
  );
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("path_screens", screensFolderInput);
  }, [screensFolderInput]);

  const [compilerState, setCompilerState] = useState({
    batName: "",
    imageName: "",
    imageId: "",
    consoleLines: [],
  });

  // "dark" | "light"
  useEffect(() => {
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const [editorViewState, setEditorViewState] = useState({
    cursor: 0,
    scrollTop: 0,
  });

  const [title, setTitle] = useState("");

  const [viewMode, setViewMode] = useState("code"); // code | screens
  // Carpeta donde están las pantallas HTML
  const [screensFolder, setScreensFolder] = useState(null);

  // Lista extraída del XML
  const [screensList, setScreensList] = useState([]);

  // Pantalla seleccionada
  const [selectedScreen, setSelectedScreen] = useState(null);

  const [filePath, setFilePath] = useState(null);
  const dirty = useMemo(() => code !== savedCode, [code, savedCode]);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizingRef = useRef(false);
  useEffect(() => {
    if (snowEnabled) {
      document.body.classList.add("xmas-lights-active");
    } else {
      document.body.classList.remove("xmas-lights-active");
    }
  }, [snowEnabled]);

  useEffect(() => {
    if (!screensFolder) {
      setScreensList([]);
      return;
    }

    const loadScreens = async () => {
      const result = await window.electronAPI.readFolder(screensFolder);
      if (result.success) {
        setScreensList(result.files);
      } else {
        setScreensList([]);
      }
    };

    loadScreens();
  }, [screensFolder]);

  useEffect(() => {
    // Cargar estado guardado al iniciar la app
    (async () => {
      try {
        if (window.electronAPI?.loadAppState) {
          const res = await window.electronAPI.loadAppState();
          if (res?.success && res.data) {
            const s = res.data;
            if (s.code) {
              setCode(s.code);
              setSavedCode(s.savedCode || "");
              setOriginalCode(s.originalCode || "");
              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(s.code, "text/xml");
                setXmlDoc(doc);
              } catch {}
            }

            setFilePath(s.filePath || null);
            setFileInfo(s.fileInfo || null);
            setScreensFolderInput(
              s.screensFolderInput || localStorage.getItem("path_screens")
            );
            if (s.theme) setTheme(s.theme);
            setSplitView(!!s.splitView);
            setActiveEditor(s.activeEditor || "left");
            setEditorViewState(
              s.editorViewState || { cursor: 0, scrollTop: 0 }
            );
            setSidebarWidth(s.sidebarWidth || 240);
            setViewMode(s.viewMode || "code");
            setScreensFolder(s.screensFolder || null);
            setScreensList(s.screensList || []);
            setSelectedScreen(s.selectedScreen || null);
            setCompilerState(s.compilerState || compilerState);
          } else if (!res?.success) {
            console.warn("No se pudo cargar estado guardado:", res?.error);
          }
        } else {
          // fallback si no hay electron: intentar cargar desde localStorage
          const fallback = localStorage.getItem("app_state_fallback");
          if (fallback) {
            const s = JSON.parse(fallback);
            if (s.code) {
              setCode(s.code);
              setSavedCode(s.savedCode || "");
              setOriginalCode(s.originalCode || "");
              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(s.code, "text/xml");
                setXmlDoc(doc);
              } catch {}
            }
          }
        }
      } catch (e) {
        console.error("Error cargando estado de la app:", e);
      }
    })();

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
  useEffect(() => {
    if (!filePath) return;

    const fileName = filePath.split("\\").pop();
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

    setTitle(nameWithoutExt);
  }, [filePath]);

  const snowFalling = (enabled) => {
    const existing = document.getElementById("snow-canvas");

    // 🔴 APAGAR NIEVE
    if (!enabled) {
      if (existing) existing.remove();
      return;
    }

    if (existing) existing.remove();

    const snow = document.createElement("canvas");
    snow.id = "snow-canvas";
    document.body.appendChild(snow);

    const ctx = snow.getContext("2d");
    let w = (snow.width = window.innerWidth);
    let h = (snow.height = window.innerHeight);

    window.addEventListener("resize", () => {
      w = snow.width = window.innerWidth;
      h = snow.height = window.innerHeight;
    });

    // ❄️ COPOS MÁS REALISTAS
    const flakes = Array.from({ length: 90 }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * -h,
      r: Math.random() * 3 + 1.5, // tamaños más variados
      d: Math.random() * 1.5 + 0.5, // velocidad vertical
      drift: Math.random() * 0.8 - 0.4, // viento lateral
      phase: Math.random() * Math.PI * 2, // oscilación
      opacity: Math.random() * 0.5 + 0.4, // profundidad visual
    }));

    function drawSnowflake(x, y, r, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#4AD6B3";
      ctx.lineWidth = 1;
      ctx.beginPath();

      // forma tipo copo ✳
      for (let i = 0; i < 6; i++) {
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + r * Math.cos((i * Math.PI) / 3),
          y + r * Math.sin((i * Math.PI) / 3)
        );
      }

      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      flakes.forEach((f) => {
        drawSnowflake(f.x, f.y, f.r, f.opacity);
      });

      move();
    }

    function move() {
      flakes.forEach((f) => {
        f.y += f.d;
        f.phase += 0.01;
        f.x += Math.sin(f.phase) * 0.3 + f.drift; // oscilación + viento

        if (f.y > h) {
          f.y = Math.random() * -100;
          f.x = Math.random() * w;
        }

        if (f.x > w) f.x = 0;
        if (f.x < 0) f.x = w;
      });
    }

    function update() {
      draw();
      requestAnimationFrame(update);
    }

    update();
  };
  const toggleSnow = () => {
    setSnowEnabled((prev) => {
      const next = !prev;
      snowFalling(next);
      return next;
    });
  };

  useEffect(() => {
    if (!christmasAudioRef.current) {
      christmasAudioRef.current = new Audio("navidad.mp3");
      christmasAudioRef.current.loop = true;
      christmasAudioRef.current.volume = 0.05; // suave, no molesto
    }

    if (snowEnabled) {
      christmasAudioRef.current.currentTime = 0;
      christmasAudioRef.current.play().catch(() => {});
    } else {
      christmasAudioRef.current.pause();
    }
  }, [snowEnabled]);

  // Autosave (debounced) del estado de la app cuando cambian valores relevantes
  useEffect(() => {
    const scheduleSave = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        persistStateNow();
        saveTimeoutRef.current = null;
      }, 1000);
    };

    scheduleSave();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    code,
    savedCode,
    originalCode,
    filePath,
    screensFolderInput,
    theme,
    splitView,
    activeEditor,
    JSON.stringify(editorViewState),
    sidebarWidth,
    viewMode,
    screensFolder,
    JSON.stringify(screensList),
    selectedScreen,
    JSON.stringify(compilerState),
  ]);

  // Guardar inmediatamente al cerrar la ventana
  useEffect(() => {
    const handler = () => {
      try {
        persistStateNow();
      } catch {}
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <div className="app">
      <TitleBar
        fileName={filePath?.split("\\").pop()}
        theme={theme}
        setTheme={setTheme}
        snowEnabled={snowEnabled}
        toggleSnow={toggleSnow}
      />
      {snowEnabled && <div className="xmas-cable-lights" />}
      {snowEnabled && <div className="xmas-cable-lights-down" />}
      {snowEnabled && (
        <div className="santa-sleigh">
          <img src="santa.gif" alt="Santa Claus" />
        </div>
      )}
      <Header
        fileInfo={fileInfo}
        onLoadClick={handleOpenFile}
        onDeleteXml={handleDeleteXml}
        hasXml={!!xmlDoc}
        viewMode={viewMode}
        setViewMode={setViewMode}
        xmlDoc={xmlDoc}
        snowEnabled={snowEnabled}
        toggleSnow={toggleSnow}
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

        <div className="editor-wrapper full">
          {/* ======================= CODE ======================= */}
          <div
            style={{
              display: viewMode === "code" ? "block" : "none",
              height: "100%",
            }}
          >
            {!xmlDoc ? (
              <EmptyState
                onLoadClick={handleOpenFile}
                onNewClick={handleNewXml}
                snowEnabled={snowEnabled}
                toggleSnow={toggleSnow}
              />
            ) : (
              <div className={`editor-wrapper ${splitView ? "split" : ""}`}>
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
                  canSave={dirty}
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

                <CodeEditor
                  code={code}
                  onChange={setCode}
                  highlightId={highlightId}
                  onSave={handleSave}
                  canSave={dirty}
                  editable={true}
                  onFocus={(key) => setActiveEditor(key)}
                  syncKey="left"
                  viewMode={viewMode}
                  theme={theme}
                  editorViewState={editorViewState}
                  setEditorViewState={setEditorViewState}
                />

                {splitView && (
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    highlightId={highlightId}
                    editable={true}
                    viewMode={viewMode}
                    onFocus={(key) => setActiveEditor(key)}
                    syncKey="right"
                    theme={theme}
                    editorViewState={editorViewState}
                    setEditorViewState={setEditorViewState}
                  />
                )}
              </div>
            )}
          </div>

          {/* ======================= SCREENS ======================= */}
          <div
            style={{
              display: viewMode === "screens" ? "block" : "none",
              height: "100%",
            }}
          >
            <ScreensPanel
              screensFolder={screensFolder}
              setScreensFolder={setScreensFolder}
              screensFolderInput={screensFolderInput}
              setScreensFolderInput={setScreensFolderInput}
              screensList={screensList}
              selectedScreen={selectedScreen}
              onSelectScreen={setSelectedScreen}
              setScreensList={setScreensList}
            />
          </div>

          {/* ======================= COMPILER ======================= */}
          <div
            style={{
              display: viewMode === "compiler" ? "block" : "none",
              height: "100%",
            }}
          >
            {xmlDoc ? (
              <CompilerForm
                xmlCode={code}
                notify={addNotification}
                xmlName={title}
                dirty={dirty}
                onSaveXml={handleSave}
                compilerState={compilerState}
                title={title}
                setCompilerState={setCompilerState}
              />
            ) : (
              <EmptyState
                onLoadClick={handleOpenFile}
                onNewClick={handleNewXml}
                snowEnabled={snowEnabled}
                toggleSnow={toggleSnow}
              />
            )}
          </div>
        </div>
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
