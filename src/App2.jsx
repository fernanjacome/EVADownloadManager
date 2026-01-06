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
import ScreensPanel from "./components/screens/ScreensPanel";
import CompilerForm from "./components/compiler/CompilerForm";
import RemoteViewer from "./components/remote/RemoteViewer";

const DEFAULT_STATE = {
  xmlDoc: null,
  fileInfo: null,
  highlightId: null,
  code: "",
  originalCode: "",
  savedCode: "",
  splitView: false,
  activeEditor: "left",
  snowEnabled: false,
  foldStates: false,
  screensFolder: null,
  screensFolderInput: "",
  screensList: [],
  selectedScreen: null,
  viewMode: "code",
  sidebarWidth: 240,
  editorViewState: {
    cursor: 0,
    scrollTop: 0,
  },
  compilerState: {
    batName: "",
    imageName: "",
    imageId: "",
    consoleLines: [],
  },
  theme: "dark",
};

export default function App() {
  const saveTimeoutRef = useRef(null);

  const [xmlDoc, setXmlDoc] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [splitView, setSplitView] = useState(false);
  const [activeEditor, setActiveEditor] = useState("left");
  const [snowEnabled, setSnowEnabled] = useState(false);

  const christmasAudioRef = useRef(null);

  const [foldStates, setFoldStates] = useState(false);

  const [screensFolderInput, setScreensFolderInput] = useState(
    localStorage.getItem("path_screens")
  );

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "dark";
  });

  const lastStateRef = useRef(null);
  const hasHydratedRef = useRef(false);

  const persistStateNow = () => {
    const state = lastStateRef.current;
    if (!state) return;

    if (window.electronAPI?.saveAppState) {
      window.electronAPI.saveAppState(state);
    } else {
      localStorage.setItem("app_state_fallback", JSON.stringify(state));
    }
  };

  useEffect(() => {
    if (screensFolderInput) {
      localStorage.setItem("path_screens", screensFolderInput);
    }
  }, [screensFolderInput]);

  const [compilerState, setCompilerState] = useState({
    batName: "",
    imageName: "",
    imageId: "",
    consoleLines: [],
  });

  useEffect(() => {
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const [editorViewState, setEditorViewState] = useState({
    cursor: 0,
    scrollTop: 0,
  });

  const [title, setTitle] = useState("");
  const [viewMode, setViewMode] = useState("code");

  const [screensFolder, setScreensFolder] = useState(null);
  const [screensList, setScreensList] = useState([]);
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
    (async () => {
      let s = null;

      try {
        if (window.electronAPI?.loadAppState) {
          const res = await window.electronAPI.loadAppState();
          console.log(res);

          if (res?.success && res.data) {
            s = res.data;

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
              s.editorViewState || {
                cursor: 0,
                scrollTop: 0,
              }
            );

            setSidebarWidth(s.sidebarWidth || 240);
            setViewMode(s.viewMode || "code");
            setScreensFolder(s.screensFolder || null);
            setCompilerState(s.compilerState || compilerState);
          }
        }
      } catch (e) {
        console.error("Error cargando estado de la app:", e);
      } finally {
        lastStateRef.current = s
          ? {
              code: s.code || "",
              savedCode: s.savedCode || "",
              originalCode: s.originalCode || "",
              filePath: s.filePath || null,
              fileInfo: s.fileInfo || null,
              title: s.title || "",
              theme: s.theme || theme,
              splitView: !!s.splitView,
              activeEditor: s.activeEditor || "left",
              editorViewState: s.editorViewState || {
                cursor: 0,
                scrollTop: 0,
              },
              sidebarWidth: s.sidebarWidth || 240,
              viewMode: s.viewMode || "code",
              screensFolder: s.screensFolder || null,
              screensFolderInput: s.screensFolderInput || "",
              screensList: s.screensList || [],
              selectedScreen: s.selectedScreen || null,
              compilerState: s.compilerState || compilerState,
            }
          : {
              code: "",
              savedCode: "",
              originalCode: "",
              filePath: null,
              fileInfo: null,
              title: "",
              theme,
              splitView: false,
              activeEditor: "left",
              editorViewState: {
                cursor: 0,
                scrollTop: 0,
              },
              sidebarWidth: 240,
              viewMode: "code",
              screensFolder: null,
              screensFolderInput: screensFolderInput || "",
              screensList: [],
              selectedScreen: null,
              compilerState,
            };

        hasHydratedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
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

    const infoResult = await window.electronAPI.getFileInfo(path);

    let sizeKb = "";
    let lastMod = "";

    console.log(infoResult);

    if (infoResult.success) {
      sizeKb = (infoResult.info.size / 1024).toFixed(1) + " KB";
      lastMod = new Date(infoResult.info.lastModified).toLocaleString();
    }

    const result = await window.electronAPI.readFile(path);

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

      persistStateNow();

      if (window.electronAPI) {
        window.electronAPI.setWindowTitle(
          `${filePath.split("\\").pop()} - EVA Studio 2026`
        );
      }
    } else {
      if (window.electronAPI) {
        window.electronAPI.setWindowTitle("EVA Studio 2026");
      }
    }

    addNotification("success", "XML cargado correctamente.");
  };

  const handleNewXml = async () => {
    try {
      const url = new URL("../public/default.xml", import.meta.url).pathname;

      const response = await fetch();
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
    setFilePath("");
    setTitle("EVA Studio 2026");

    if (window.electronAPI) {
      window.electronAPI.setWindowTitle("EVA Studio 2026");
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

          message = ` Error de sintaxis en línea ${line}, columna ${column}`;
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

      if (filePath) {
        await saveToPath(filePath, code);
        return;
      }

      const newPath = await window.electronAPI.showSaveDialog({
        title: "Guardar XML",
        defaultPath: "archivo.xml",
        filters: [
          {
            name: "XML",
            extensions: ["xml"],
          },
        ],
      });

      if (!newPath) {
        addNotification("info", "Guardado cancelado.");
        return;
      }

      await saveToPath(newPath, code);

      setSavedCode(code);

      if (filePath && window.electronAPI?.writeFile) {
        const result = await window.electronAPI.writeFile(filePath, code);

        persistStateNow();

        console.log(result);

        if (!result.success) {
          addNotification(
            "error",
            "No se pudo guardar en disco: " + result.error
          );
          return;
        }

        addNotification("success", `Archivo actualizado: ${filePath}`);
      } else {
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

      setXmlDoc(restoredDoc);
      setCode(originalCode);

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

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          type,
          message,
        },
      ];
    });
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };
  useEffect(() => {
    const handleAppClose = () => {
      persistStateNow();

      setTimeout(() => {
        window.electronAPI?.windowControl("close");
      }, 50);
    };

    window.addEventListener("tryAppClose", handleAppClose);

    return () => window.removeEventListener("tryAppClose", handleAppClose);
  }, []);

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

      const realPath = file.path;

      setFilePath(realPath);

      const infoResult = await window.electronAPI.getFileInfo(realPath);

      let sizeKb = "";
      let lastMod = "";

      if (infoResult.success) {
        sizeKb = (infoResult.info.size / 1024).toFixed(1) + " KB";
        lastMod = new Date(infoResult.info.lastModified).toLocaleString();
      }

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

    const flakes = Array.from({ length: 90 }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * -h,
      r: Math.random() * 3 + 1.5,
      d: Math.random() * 1.5 + 0.5,
      drift: Math.random() * 0.8 - 0.4,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.5 + 0.4,
    }));

    function drawSnowflake(x, y, r, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#4AD6B3";
      ctx.lineWidth = 1;
      ctx.beginPath();

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
        f.x += Math.sin(f.phase) * 0.3 + f.drift;

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

  const handleFileDrop = async (files) => {
    const file = files[0];
    if (!file) return;

    console.log(file);

    const realPath = file.path;

    if (!realPath) {
      addNotification("error", "No se pudo obtener la ruta del archivo.");
      return;
    }

    setFilePath(realPath);

    const infoResult = await window.electronAPI.getFileInfo(realPath);

    if (!infoResult.success) {
      addNotification("error", "No se pudo obtener información del archivo.");
      return;
    }

    const result = await window.electronAPI.readFile(realPath);

    if (!result.success) {
      addNotification("error", "No se pudo leer el archivo.");
      return;
    }

    const xmlText = result.data;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    handleLoadXml(doc, {
      name: realPath.split("\\").pop(),
      size: infoResult.info.size,
      lastModified: infoResult.info.lastModified,
    });
  };

  useEffect(() => {
    if (!christmasAudioRef.current) {
      christmasAudioRef.current = new Audio("navidad.mp3");

      christmasAudioRef.current.loop = true;
      christmasAudioRef.current.volume = 0.05;
    }

    if (snowEnabled) {
      christmasAudioRef.current.currentTime = 0;
      christmasAudioRef.current.play().catch(() => {});
    } else {
      christmasAudioRef.current.pause();
    }
  }, [snowEnabled]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;

    lastStateRef.current = {
      code,
      savedCode,
      originalCode,
      filePath,
      fileInfo,
      title,
      theme,
      splitView,
      activeEditor,
      editorViewState,
      sidebarWidth,
      viewMode,
      screensFolder,
      screensFolderInput,
      screensList,
      selectedScreen,
      compilerState,
    };
  }, [
    code,
    savedCode,
    originalCode,
    filePath,
    theme,
    splitView,
    activeEditor,
    editorViewState,
    sidebarWidth,
    viewMode,
    screensFolder,
    screensFolderInput,
    screensList,
    selectedScreen,
    compilerState,
  ]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      persistStateNow();
      saveTimeoutRef.current = null;
    }, 500);
  }, [
    code,
    savedCode,
    originalCode,
    filePath,
    fileInfo,
    title,
    theme,
    splitView,
    activeEditor,
    editorViewState,
    sidebarWidth,
    viewMode,
    screensFolder,
    screensFolderInput,
    screensList,
    selectedScreen,
    compilerState,
  ]);

  const resetAppState = async () => {
    hasHydratedRef.current = false;

    localStorage.clear();

    setXmlDoc(DEFAULT_STATE.xmlDoc);
    setFileInfo(DEFAULT_STATE.fileInfo);
    setHighlightId(DEFAULT_STATE.highlightId);
    setCode(DEFAULT_STATE.code);
    setOriginalCode(DEFAULT_STATE.originalCode);
    setSavedCode(DEFAULT_STATE.savedCode);
    setSplitView(DEFAULT_STATE.splitView);
    setActiveEditor(DEFAULT_STATE.activeEditor);
    setSnowEnabled(DEFAULT_STATE.snowEnabled);
    setFoldStates(DEFAULT_STATE.foldStates);
    setScreensFolder(DEFAULT_STATE.screensFolder);
    setScreensFolderInput(DEFAULT_STATE.screensFolderInput);
    setScreensList(DEFAULT_STATE.screensList);
    setSelectedScreen(DEFAULT_STATE.selectedScreen);
    setViewMode(DEFAULT_STATE.viewMode);
    setSidebarWidth(DEFAULT_STATE.sidebarWidth);
    setEditorViewState(DEFAULT_STATE.editorViewState);
    setCompilerState(DEFAULT_STATE.compilerState);
    setTheme(DEFAULT_STATE.theme);
    setFilePath(null);
    setTitle("");
    setNotifications([]);

    lastStateRef.current = null;

    await window.electronAPI?.saveAppState?.(null);

    setTimeout(() => {
      hasHydratedRef.current = true;
    }, 0);
  };

  const saveToPath = async (path, content) => {
    const result = await window.electronAPI.writeFile(path, content);

    if (!result.success) {
      addNotification(
        "error",
        "No se pudo guardar el archivo: " + result.error
      );
      return false;
    }

    const infoResult = await window.electronAPI.getFileInfo(path);

    if (infoResult.success) {
      setFileInfo({
        name: path.split("\\").pop(),
        size: (infoResult.info.size / 1024).toFixed(1) + " KB",
        lastModified: new Date(infoResult.info.lastModified).toLocaleString(),
      });
    }

    setFilePath(path);
    setSavedCode(content);

    if (window.electronAPI) {
      window.electronAPI.setWindowTitle(
        `${path.split("\\").pop()} - EVA Studio 2026`
      );
    }

    persistStateNow();

    addNotification("success", "Archivo guardado correctamente.");

    return true;
  };
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;

      const minWidth = 160;
      const maxWidth = 500;

      setSidebarWidth((prev) => {
        const next = e.clientX;
        if (next < minWidth) return minWidth;
        if (next > maxWidth) return maxWidth;
        return next;
      });
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="app">
      <TitleBar
        fileName={filePath?.split("\\").pop()}
        theme={theme}
        setTheme={setTheme}
        snowEnabled={snowEnabled}
        toggleSnow={toggleSnow}
        onResetApp={resetAppState}
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
            setHighlightId({
              target: activeEditor,
              id,
            });
            setTimeout(() => setHighlightId(null), 0);
          }}
          style={{
            width: sidebarWidth,
          }}
        />

        <div
          className="sidebar-resizer"
          onMouseDown={() => (isResizingRef.current = true)}
        />

        <div className="editor-wrapper full">
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
                onFileDrop={handleFileDrop}
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

                <div className={`editor-div ${splitView ? "split" : ""}`}>
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
              </div>
            )}
          </div>

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
                onFileDrop={handleFileDrop}
              />
            )}
          </div>

          <div
            style={{
              display: viewMode === "remote" ? "block" : "none",
              height: "100%",
            }}
          >
            <RemoteViewer apiBaseUrl="https://192.168.10.241:5007" />
          </div>
        </div>
      </div>

      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
    </div>
  );
}
